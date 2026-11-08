import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Only browser tests use this resolver; never treat a missing browser as a pass. */
export function resolveBrowserExecutable(chromium) {
  const isFile = path => { try { return statSync(path).isFile() } catch { return false } }
  const requested = process.env.DSH_CHROME_PATH
  if (requested !== undefined) {
    const path = resolve(requested)
    if (isFile(path)) return path
    throw new Error(`DSH_CHROME_PATH points to a missing browser: ${path}. Set DSH_CHROME_PATH to a Chrome/Chromium executable.`)
  }

  const cent = 'CentBrowser/Application/chrome.exe'
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  const cached = (() => {
    try {
      return readdirSync(cache).filter(name => /^chromium-\d+$/.test(name))
        .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
        .flatMap(name => ['chrome-win64', 'chrome-win'].map(dir => join(cache, name, dir, 'chrome.exe')))
    } catch { return [] }
  })()
  const candidates = [
    ...[process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']]
      .filter(Boolean).map(base => join(base, cent)),
    ...'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(drive => join(`${drive}:/`, '百分', cent)),
    chromium.executablePath(),
    ...cached,
  ]
  const found = candidates.find(isFile)
  if (found) return found
  throw new Error('No browser executable found (CentBrowser or Playwright Chromium cache). Set DSH_CHROME_PATH to the full path of a Chrome/Chromium executable, then rerun the test.')
}
