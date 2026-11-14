// Digital rain: columns of glyphs falling down a black-green screen, the way a
// phosphor terminal would draw them. Two layers give depth: a far layer of small,
// dim, slow columns and a near layer of larger, brighter, faster ones. Each
// column is one <text> of <tspan> glyphs with a bright head and a tail that
// fades. The motion is CSS inside the SVG's own <style>; with reduced motion
// every column rests spread across the screen as a still picture.
// Pure string building, no imports, the same string on every call.

const WIDTH = 1600
const HEIGHT = 1000
const GLYPHS =
  'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789Z:・"=*+-<>¦|ç'

/** A repeatable number in [0, 1) from two integers, so every build draws the same rain. */
function hashUnit(index: number, salt: number): number {
  let value = (Math.imul(index | 0, 374761393) + Math.imul(salt | 0, 668265263)) | 0
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  value ^= value >>> 16
  return (value >>> 0) / 4294967296
}

function pick(index: number, salt: number): string {
  const at = Math.floor(hashUnit(index, salt) * GLYPHS.length)
  return GLYPHS.charAt(at)
}

function escapeGlyph(glyph: string): string {
  if (glyph === '<') return '&lt;'
  if (glyph === '>') return '&gt;'
  if (glyph === '"') return '&quot;'
  return glyph
}

type Layer = {
  name: string
  columns: number
  fontSize: number
  lineHeight: number
  minGlyphs: number
  maxGlyphs: number
  minSeconds: number
  maxSeconds: number
  salt: number
  /** Opacity of the whole layer: the far layer sits back. */
  opacity: number
}

const FAR: Layer = {
  name: 'far',
  columns: 46,
  fontSize: 17,
  lineHeight: 20,
  minGlyphs: 10,
  maxGlyphs: 24,
  minSeconds: 14,
  maxSeconds: 24,
  salt: 11,
  opacity: 0.42,
}

const NEAR: Layer = {
  name: 'near',
  columns: 30,
  fontSize: 25,
  lineHeight: 29,
  minGlyphs: 14,
  maxGlyphs: 34,
  minSeconds: 7,
  maxSeconds: 13,
  salt: 71,
  opacity: 1,
}

/** The tail's brightness class by its distance from the head: 0 is the head. */
function tailClass(fromHead: number, length: number): string {
  if (fromHead === 0) return 'h'
  const t = fromHead / length
  if (t < 0.18) return 'a'
  if (t < 0.4) return 'b'
  if (t < 0.65) return 'c'
  return 'd'
}

function column(layer: Layer, index: number): string {
  const slot = WIDTH / layer.columns
  const jitter = (hashUnit(index, layer.salt + 1) - 0.5) * slot * 0.6
  const x = Math.round(index * slot + slot / 2 + jitter)
  const count =
    layer.minGlyphs + Math.floor(hashUnit(index, layer.salt + 2) * (layer.maxGlyphs - layer.minGlyphs))
  const seconds =
    layer.minSeconds + hashUnit(index, layer.salt + 3) * (layer.maxSeconds - layer.minSeconds)
  const delay = -hashUnit(index, layer.salt + 4) * seconds
  const tall = count * layer.lineHeight
  // At rest (reduced motion) the column's head sits somewhere on screen, each
  // column at a different height, so the still picture reads as rain too.
  const restHead = Math.round(hashUnit(index, layer.salt + 5) * (HEIGHT + tall * 0.5))
  const restY = restHead - tall

  let spans = ''
  for (let g = 0; g < count; g += 1) {
    // Glyphs are written bottom-up in brightness: the head is the lowest glyph.
    const fromHead = count - 1 - g
    const glyph = escapeGlyph(pick(index * 101 + g, layer.salt + 6))
    const cls = tailClass(fromHead, count)
    // Some glyphs in the tail flicker: they swap brightness on a short cycle.
    const flicker = hashUnit(index * 101 + g, layer.salt + 7) < 0.14 && cls !== 'h'
    const dy = g === 0 ? 0 : layer.lineHeight
    spans += `<tspan x="0" dy="${dy}" class="${cls}${flicker ? ' f' : ''}">${glyph}</tspan>`
  }

  const duration = Math.round(seconds * 10) / 10
  const start = Math.round(delay * 10) / 10

  return (
    `<g transform="translate(${x} 0)">` +
    `<g class="c" style="transform:translateY(${restY}px);animation:fall-${layer.name} ${duration}s linear ${start}s infinite">` +
    `<text x="0" y="0" font-size="${layer.fontSize}">${spans}</text>` +
    `</g></g>`
  )
}

function layer(layer: Layer): string {
  let out = `<g opacity="${layer.opacity}" class="${layer.name}">`
  for (let index = 0; index < layer.columns; index += 1) {
    out += column(layer, index)
  }
  return out + '</g>'
}

const FAR_TRAVEL = FAR.maxGlyphs * FAR.lineHeight
const NEAR_TRAVEL = NEAR.maxGlyphs * NEAR.lineHeight

const STYLE =
  `<style>` +
  `text{font-family:"Menlo","SF Mono","Consolas","DejaVu Sans Mono",monospace;text-anchor:middle;fill:#00ff41}` +
  `.h{fill:#e9fff0}` +
  `.a{fill:#8dffa8;fill-opacity:.95}` +
  `.b{fill:#2fe05e;fill-opacity:.85}` +
  `.c{fill:#15b544;fill-opacity:.6}` +
  `.d{fill:#0b7a2e;fill-opacity:.35}` +
  `.f{animation:flick 1.3s steps(2,end) infinite}` +
  `.near .f{animation-duration:.9s}` +
  `@keyframes flick{0%{fill-opacity:.9}50%{fill-opacity:.25}100%{fill-opacity:.9}}` +
  `@keyframes fall-far{from{transform:translateY(-${FAR_TRAVEL}px)}to{transform:translateY(${HEIGHT + 40}px)}}` +
  `@keyframes fall-near{from{transform:translateY(-${NEAR_TRAVEL}px)}to{transform:translateY(${HEIGHT + 60}px)}}` +
  `@media (prefers-reduced-motion: reduce){*{animation:none!important}}` +
  `</style>`

const GROUND =
  `<defs>` +
  `<radialGradient id="glow" cx="50%" cy="45%" r="70%">` +
  `<stop offset="0" stop-color="#06180d"/><stop offset="1" stop-color="#010402"/>` +
  `</radialGradient>` +
  `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#010402" stop-opacity=".85"/>` +
  `<stop offset=".25" stop-color="#010402" stop-opacity="0"/>` +
  `<stop offset=".8" stop-color="#010402" stop-opacity="0"/>` +
  `<stop offset="1" stop-color="#010402" stop-opacity=".7"/>` +
  `</linearGradient>` +
  `<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">` +
  `<rect width="4" height="2" fill="#000" fill-opacity=".18"/>` +
  `</pattern>` +
  `</defs>` +
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>`

const OVER =
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>` +
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scan)"/>`

let built: string | undefined

/** The whole scene, built once per load. */
export function digitalRainSvg(): string {
  if (built === undefined) {
    built =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">` +
      STYLE +
      GROUND +
      layer(FAR) +
      layer(NEAR) +
      OVER +
      `</svg>`
  }
  return built
}
