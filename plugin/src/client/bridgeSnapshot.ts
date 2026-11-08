/** Parent-only projection for the display-only cross-site Bot child.
 * Never spread a DSH session, status, or projection object across the boundary.
 */
import type { AgentRow } from './agents'
import type { AvatarLook } from './look'
import { ACTIVITY } from '../isolation/protocol.mjs'

const OPAQUE = /^[a-f0-9]{32}$/

type RotationItem = { state: string; plays: number }

export interface SnapshotInput {
  shownIds: readonly string[]
  agentById: ReadonlyMap<string, AgentRow>
  kidsCount: ReadonlyMap<string, number>
  tokenFor: (sessionId: string) => string
  lookFor: (sessionId: string) => AvatarLook
  botSize: number
  customizer: boolean
  editTarget?: string
  fps: number
  dwellMs: number
  rotation: Record<string, readonly RotationItem[]>
  cols: number
  rows: number
}

/** Only generic aliases and random, stable per-frame row tokens may leave this function. */
export function snapshotForChild(input: SnapshotInput) {
  const { shownIds, agentById, kidsCount, tokenFor, lookFor, botSize, customizer, editTarget, fps, dwellMs, rotation, cols, rows } = input
  if (!Array.isArray(shownIds) || shownIds.length > 9 || new Set(shownIds).size !== shownIds.length) return null
  if (!Number.isInteger(cols) || cols < 1 || cols > 3 || !Number.isInteger(rows) || rows < 1 || rows > 3 || cols * rows < shownIds.length) return null
  if (!Number.isInteger(botSize) || botSize < 16 || botSize > 512) return null
  const projected = shownIds.map((sessionId, index) => {
    const opaque = tokenFor(sessionId)
    if (typeof opaque !== 'string' || !OPAQUE.test(opaque) || opaque === sessionId) return null
    const agent = agentById.get(sessionId)
    const look = lookFor(sessionId)
    return {
      id: opaque,
      name: index === 0 ? '当前会话' : `监控 ${index + 1}`,
      activity: agent?.activity ?? 'idle',
      changedAt: agent?.changedAt ?? 0,
      isChild: agent?.isChild ?? false,
      childCount: kidsCount.get(sessionId) ?? 0,
      pose: customizer && (editTarget === sessionId || (editTarget === undefined && index === 0)),
      look: { shape: look.shape, color: look.color, expression: look.expression, size: botSize }
    }
  })
  const safeRows = projected.filter((row): row is NonNullable<typeof row> => row !== null)
  if (safeRows.length !== projected.length) return null
  const tokenList = safeRows.map((row) => row.id)
  if (new Set(tokenList).size !== tokenList.length) return null
  // Copy only the 13 known activities and the two visual fields per animation.
  const safeRotation = Object.fromEntries(ACTIVITY.map((activity) => [
    activity,
    rotation[activity]?.map((item) => ({ state: item.state, plays: item.plays }))
  ]))
  return { rows: safeRows, ui: { fps, dwellMs, rotation: safeRotation, cols, rows } }
}
