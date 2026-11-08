// grokbot/plugin/src/host/isolationStatic.ts
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
var ISOLATION_PORT = 49383;
var HOST = "127.0.0.1:49383";
var ASSETS = Object.freeze({ "/": "index.html", "/app.js": "app.js", "/owner.js": "owner.js" });
var DEFAULT_ISOLATION_ASSETS = fileURLToPath(new URL("./offscreen/", import.meta.url));
function isolationStaticVerdict(method, url, host) {
  if (host !== HOST) return 403;
  if (method !== "GET") return 405;
  return Object.prototype.hasOwnProperty.call(ASSETS, url ?? "") ? 200 : 404;
}
function createIsolationStaticServer(options = {}) {
  const assetDir = resolve(options.assetDir ?? DEFAULT_ISOLATION_ASSETS);
  const factory = options.createServer ?? createServer;
  return factory((req, res) => {
    const verdict = isolationStaticVerdict(req.method, req.url, req.headers.host);
    if (verdict !== 200) {
      res.writeHead(verdict, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end("not available");
      return;
    }
    const name2 = ASSETS[req.url];
    const full = resolve(assetDir, name2);
    if (!full.startsWith(assetDir + sep)) {
      res.writeHead(503, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end("asset unavailable");
      return;
    }
    let body;
    try {
      body = (options.readAsset ?? readFileSync)(full);
    } catch {
      res.writeHead(503, { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      res.end("asset unavailable");
      return;
    }
    res.writeHead(200, {
      "Content-Type": name2.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
      "Content-Length": body.byteLength,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors dsh-app://app",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    res.end(body);
  });
}
function registerIsolationStatic(ctx, options = {}) {
  ctx.effect(() => {
    const server = createIsolationStaticServer(options);
    let disposed = false;
    server.on("error", (error) => {
      if (disposed) return;
      options.onError?.(error);
      if (server.listening) server.close();
    });
    server.listen(ISOLATION_PORT, "127.0.0.1");
    return () => {
      disposed = true;
      try {
        server.close();
      } catch (error) {
        if (error.code !== "ERR_SERVER_NOT_RUNNING") throw error;
      }
    };
  }, "offscreen static loopback lifecycle");
}

// grokbot/plugin/src/host/index.ts
var KEY = "agentsBot";
var STATE_VERSION = 2;
function shape(check, what) {
  return {
    parse(value) {
      if (!check(value)) throw new Error(`agentsBot ${what} failed validation`);
      return value;
    }
  };
}
var isTime = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
var isCount = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var stateSchema = shape(
  (v) => isPlainObject(v) && isPlainObject(v.calls) && isPlainObject(v.jobs) && isCount(v.bg) && typeof v.compacting === "boolean" && isTime(v.errorAt),
  "state"
);
var viewSchema = shape(
  (v) => isPlainObject(v) && (v.tool === null || typeof v.tool === "string") && isCount(v.tools) && isCount(v.bg) && typeof v.compacting === "boolean" && isTime(v.errorAt),
  "view"
);
function init() {
  return {
    /** 在跑的工具：callId → { name, at }。允许并发，所以是表不是单值。 */
    calls: {},
    /** 已登记的任务：jobId → { callId, orphaned }。 */
    jobs: {},
    /** 后台任务数：结果已返回、任务仍在跑的那些。 */
    bg: 0,
    /** 是否正在压缩上下文。 */
    compacting: false,
    /** 最近一次最终模型请求失败的日志时刻（0 = 无待提示错误）。 */
    errorAt: 0
  };
}
function isProviderTurnFailure(reason) {
  if (reason?.kind !== "error") return false;
  const failure = reason.error;
  if (failure === null || typeof failure !== "object") return false;
  if (Number.isInteger(failure.status) && failure.status >= 400 && failure.status <= 599) return true;
  return typeof failure.code === "string" && failure.code.length > 0 && failure.code !== "TOOL_ACTIVATION_FAILED" && failure.code !== "UNKNOWN";
}
function applyEvent(state, event) {
  switch (event.type) {
    case "tool/call": {
      const callId = event.data?.callId;
      const name2 = event.data?.name;
      if (typeof callId !== "string" || typeof name2 !== "string") return state;
      return {
        ...state,
        calls: { ...state.calls, [callId]: { name: name2, at: event.time } }
      };
    }
    case "tool/result": {
      const callId = event.data?.message?.toolCallId;
      const calls = { ...state.calls };
      if (typeof callId === "string") delete calls[callId];
      let bg = state.bg;
      const jobs = { ...state.jobs };
      if (typeof callId === "string") {
        for (const [jobId, job] of Object.entries(state.jobs)) {
          if (job.callId !== callId || job.orphaned) continue;
          jobs[jobId] = { ...job, orphaned: true };
          bg += 1;
        }
      }
      return {
        ...state,
        calls,
        jobs,
        bg
      };
    }
    case "job/registered": {
      const jobId = event.data?.jobId;
      const callId = event.data?.toolCall?.callId;
      if (typeof jobId !== "string") return state;
      if (state.jobs[jobId] !== void 0) return state;
      return {
        ...state,
        jobs: { ...state.jobs, [jobId]: { callId: typeof callId === "string" ? callId : null, orphaned: false } }
      };
    }
    case "job/settled": {
      const jobId = event.data?.jobId;
      if (typeof jobId !== "string") return state;
      const job = state.jobs[jobId];
      if (job === void 0) return state;
      const jobs = { ...state.jobs };
      delete jobs[jobId];
      return { ...state, jobs, bg: job.orphaned ? Math.max(0, state.bg - 1) : state.bg };
    }
    case "compaction/start":
      return state.compacting ? state : { ...state, compacting: true };
    case "compaction/end":
      return state.compacting ? { ...state, compacting: false } : state;
    case "turn/end": {
      const failed = isProviderTurnFailure(event.data?.reason);
      const recovered = event.data?.reason?.kind === "completed" && state.errorAt !== 0;
      const jobs = {};
      for (const [jobId, job] of Object.entries(state.jobs)) if (job.orphaned) jobs[jobId] = job;
      const clean = Object.keys(state.calls).length === 0 && !state.compacting && Object.keys(jobs).length === Object.keys(state.jobs).length;
      if (!failed && !recovered && clean) return state;
      return {
        ...state,
        calls: {},
        jobs,
        compacting: false,
        errorAt: failed ? event.time : recovered ? 0 : state.errorAt
      };
    }
    default:
      return state;
  }
}
function viewOf(state) {
  let tool = null;
  let tools = 0;
  let newest = -1;
  for (const call of Object.values(state.calls)) {
    tools += 1;
    if (call.at >= newest) {
      newest = call.at;
      tool = call.name;
    }
  }
  return {
    tool,
    tools,
    bg: state.bg,
    compacting: state.compacting,
    errorAt: state.errorAt
  };
}
var agentsBotProjection = {
  key: KEY,
  stateVersion: STATE_VERSION,
  stateSchema,
  init,
  apply: applyEvent,
  wire: { viewSchema, view: viewOf }
};
var name = "dsh-agents-bot";
var inject = [];
function apply(ctx) {
  registerIsolationStatic(ctx, { onError: (error) => console.warn("[dsh-agents-bot] isolated canvas unavailable:", error.code ?? "listen failed") });
  ctx.inject(["sessionProjections"], (scope) => {
    scope.sessionProjections.register(agentsBotProjection);
  });
}
export {
  agentsBotProjection,
  apply,
  inject,
  name
};
