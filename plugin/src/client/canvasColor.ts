/** Match the actual sidebar backdrop behind the iframe, not the OS/titlebar pixels.
 * Only six hex digits cross the child boundary; no DOM, CSS URL, or session data.
 */
/** Mirror the child's contrast threshold for the pre-ACK parent-only preview. */
export function labelColorForCanvas(hex: string): string {
  const linear = [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .18 ? '#171717' : '#ffffff'
}

export function canvasColorBehind(element: Element | null): string {
  const chain: Element[] = []
  for (let node = element; node && chain.length < 32; node = node.parentElement) chain.push(node)
  const out = [246, 248, 251] // old isolated canvas when no opaque ancestor is available
  for (const node of chain.reverse()) {
    const css = getComputedStyle(node).backgroundColor
    const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(css)
    if (!match) continue
    const red = Number(match[1]), green = Number(match[2]), blue = Number(match[3]), alpha = match[4] === undefined ? 1 : Number(match[4])
    if ([red, green, blue].some(value => value > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) continue
    for (const [index, channel] of [red, green, blue].entries()) out[index] = Math.round(channel * alpha + out[index] * (1 - alpha))
  }
  return '#' + out.map(value => value.toString(16).padStart(2, '0')).join('')
}
