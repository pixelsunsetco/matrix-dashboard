import { atom, read, update } from 'claude-code'
import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { digitalRainSvg } from './rain'
import type { Stats, ToolCall } from '../types'

const PLUGIN = 'matrix-dashboard'
const PANE = 'matrix'
const SCENE = 'digital-rain'
const COMMAND = 'matrix'
const FEED_KEPT = 40
const TICK_MS = 10_000

// Phosphor greens on near-black. Dark only: the idea has no light mode.
const GREEN = '#00ff41'
const BRIGHT = '#c8ffd4'
const MID = '#39d35f'
const DIM = '#1f8a3c'
const RED = '#ff5a5a'
const AMBER = '#e3c04a'

const { theme, problems } = makeColors({
  label: 'Matrix',
  only: 'dark',
  roles: { accent: '#19e54a', danger: '#ff4d4d', success: '#5cf08a', warning: '#d9b63d', pro: '#2cc9c9' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#020705',
        'surface-1': '#061009',
        'surface-2': '#0a170e',
        'surface-3': '#102516',
        'text-primary': '#a6ffb8',
        'text-secondary': '#6de389',
        'text-muted': '#43b562',
      },
    },
    git: {
      added: '#4df07a',
      removed: '#ff5e5e',
      modified: '#d9c24a',
      merged: '#2cc9c9',
      closed: '#ff5e5e',
      conflicting: '#ff9a3d',
      draft: '#43b562',
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: { blur: 12, tint: '#020805', opacity: 0.58 } },
}

const FRESH: Stats = {
  startedAt: 0,
  now: 0,
  turns: 0,
  calls: 0,
  errors: 0,
  byTool: {},
  feed: [],
  phase: 'idle' as const,
}

// Change the tag when a field changes: it declines what an earlier version stored.
const stats = atom({ plugin: 'matrix-dashboard', key: 'stats' } as const, FRESH, {
  shape: 'stats-1',
})

/** One short line on what a tool call does, from its own input. */
function detailOf(e: Record<string, unknown>): string {
  const first = (keys: string[]): string => {
    for (const key of keys) {
      const value = e[key]
      if (typeof value === 'string' && value.length > 0) return value
    }
    return ''
  }
  const text = first(['command', 'file_path', 'pattern', 'query', 'url', 'description', 'prompt', 'skill'])
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function uptime(from: number, to: number): string {
  if (from === 0 || to < from) return '00:00:00'
  const seconds = Math.floor((to - from) / 1000)
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

function bar(fraction: number, width: number): string {
  const on = Math.max(0, Math.min(width, Math.round(fraction * width)))
  return '█'.repeat(on) + '░'.repeat(width - on)
}

function tokens(n: number | undefined): string {
  if (n === undefined) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

function statusLine(s: Stats): string {
  const ctx = s.contextPercent === undefined ? '' : ` · ctx ${Math.round(s.contextPercent)}%`
  const phase = s.phase === 'idle' ? 'standby' : s.phase === 'thinking' ? 'thinking' : 'tool'
  return `◉ MATRIX ${phase} · ${s.turns} turns · ${s.calls} calls${ctx}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    const set = await $.theme.set(LOOK)
    if (!set.isDrawn) {
      $.ui.log(`${PLUGIN}: ${set.reason}`)
    }

    await $.command.register({
      name: COMMAND,
      description: 'Open the Matrix dashboard pane; "theme off" or "theme on" clears or restores the look',
      argumentHint: '[theme off|theme on|reset]',
    })

    const now = await $.clock.now()
    await update($, stats, s => ({
      ...s,
      startedAt: s.startedAt === 0 ? now : s.startedAt,
      now,
      phase: 'idle' as const,
      feed: s.feed.map(call => (call.state === 'runs' ? { ...call, state: 'done' as const } : call)),
    }))
    $.ui.status(statusLine(await read($, stats)))

    $.clock.every(TICK_MS, () => {
      // A tick that lands after the session is gone has nothing to write to.
      void (async () => {
        const at = await $.clock.now()
        await update($, stats, s => ({ ...s, now: at }))
      })().catch(() => undefined)
    })

    // The pane docks beside the chat where the surface has a sidebar.
    void $.ui.open({ id: PANE, title: 'Matrix' })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const args = e.args.trim().toLowerCase()

    if (args === 'theme off') {
      await $.theme.clear()
      return { text: 'Matrix look cleared. The dashboard pane stays. Type /matrix theme on to bring the look back.' }
    }
    if (args === 'theme on') {
      const set = await $.theme.set(LOOK)
      return { text: set.isDrawn ? 'Matrix look restored.' : `Matrix look set. ${set.reason}` }
    }
    if (args === 'reset') {
      const now = await $.clock.now()
      await update($, stats, () => ({ ...FRESH, startedAt: now, now }))
      $.ui.status(statusLine(await read($, stats)))
      return { text: 'Matrix dashboard counters reset.' }
    }

    const opened = await $.ui.open({ id: PANE, title: 'Matrix' })
    return {
      text: opened.isPlaced ? 'Matrix dashboard opened.' : 'Matrix dashboard requested; this surface draws no pane right now.',
    }
  })

  on('turn.start', async ($, e, next) => {
    await update($, stats, s => ({ ...s, turns: s.turns + 1, phase: 'thinking' as const }))
    $.ui.status(statusLine(await read($, stats)))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    let contextPercent: number | undefined
    let contextTokens: number | undefined
    let contextWindow: number | undefined
    let costUsd: number | undefined
    try {
      const usage = await $.session.usage()
      contextPercent = usage.context.percent
      contextTokens = usage.context.tokens
      contextWindow = usage.context.window
      costUsd = usage.cost?.usd
    } catch {
      // A host with no usage figures: the dashboard shows dashes.
    }
    await update($, stats, s => ({
      ...s,
      phase: 'idle' as const,
      lastTurnMs: e.durationMs,
      contextPercent: contextPercent ?? s.contextPercent,
      contextTokens: contextTokens ?? s.contextTokens,
      contextWindow: contextWindow ?? s.contextWindow,
      costUsd: costUsd ?? s.costUsd,
    }))
    $.ui.status(statusLine(await read($, stats)))
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const at = await $.clock.now()
    const call: ToolCall = {
      id: e.tool_use_id,
      tool: e.tool,
      detail: detailOf(e as unknown as Record<string, unknown>),
      state: 'runs',
      at,
    }
    await update($, stats, s => ({
      ...s,
      calls: s.calls + 1,
      phase: 'tool' as const,
      byTool: { ...s.byTool, [e.tool]: (s.byTool[e.tool] ?? 0) + 1 },
      feed: [...s.feed, call].slice(-FEED_KEPT),
    }))
    $.ui.status(statusLine(await read($, stats)))

    const ran = await next(e)
    const failed = ran.deny !== undefined || ran.isError === true

    await update($, stats, s => ({
      ...s,
      errors: failed ? s.errors + 1 : s.errors,
      phase: 'thinking' as const,
      feed: s.feed.map(one => (one.id === call.id ? { ...one, state: failed ? ('error' as const) : ('done' as const) } : one)),
    }))

    return ran
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.props.plugin !== PLUGIN || e.props.scene !== SCENE) {
      return next(e)
    }
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={digitalRainSvg()} alt="Digital rain: green glyphs falling down a black screen" isInteractive />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, stats)
    const columns = Math.max(20, e.props.bodyColumns)
    const isWidget = e.props.placement === 'widget'
    const rows = e.viewport?.rows ?? 30

    const phaseText = s.phase === 'idle' ? 'STANDBY' : s.phase === 'thinking' ? 'THINKING' : 'TOOL RUN'
    const phaseColor = s.phase === 'idle' ? DIM : s.phase === 'thinking' ? GREEN : AMBER
    const ctxPct = s.contextPercent ?? (s.contextTokens !== undefined && s.contextWindow ? (s.contextTokens / s.contextWindow) * 100 : undefined)
    const barWidth = Math.max(8, Math.min(30, columns - 14))

    if (isWidget) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color={GREEN} weight="bold" mono>
            ◉ MATRIX <Text color={phaseColor}>{phaseText}</Text>
          </Text>
          <Text color={MID} mono tabular>
            {s.turns} turns · {s.calls} calls · {s.errors} err
          </Text>
          <Text color={MID} mono tabular>
            ctx {ctxPct === undefined ? '--' : `${Math.round(ctxPct)}%`} · up {uptime(s.startedAt, s.now)}
          </Text>
        </Box>
      )
    }

    const top = Object.entries(s.byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    const topMax = top.length > 0 ? top[0]![1] : 1
    const nameWidth = Math.min(16, Math.max(4, ...top.map(([name]) => name.length)))
    const toolBar = Math.max(6, Math.min(24, columns - nameWidth - 8))

    // Rows the fixed sections take; the feed gets the rest.
    const fixedRows = 14 + top.length
    const feedRoom = Math.max(3, rows - fixedRows)
    const feed = s.feed.slice(-feedRoom).reverse()

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text color={GREEN} weight="bold" mono>
            ◉ THE MATRIX
          </Text>
          <Text color={DIM} mono tabular>
            up {uptime(s.startedAt, s.now)}
          </Text>
        </Box>
        <Text color={DIM} mono>
          {'─'.repeat(Math.max(10, columns - 2))}
        </Text>

        <Box flexDirection="row" gap={2}>
          <Text color={MID} mono>
            STATUS <Text color={phaseColor} weight="bold">{phaseText}</Text>
          </Text>
          <Text color={MID} mono tabular>
            TURNS <Text color={BRIGHT}>{s.turns}</Text>
          </Text>
          <Text color={MID} mono tabular>
            CALLS <Text color={BRIGHT}>{s.calls}</Text>
          </Text>
          <Text color={MID} mono tabular>
            ERR <Text color={s.errors > 0 ? RED : BRIGHT}>{s.errors}</Text>
          </Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color={MID} mono>
            CONTEXT
          </Text>
          <Text color={ctxPct !== undefined && ctxPct > 80 ? AMBER : GREEN} mono tabular>
            {bar((ctxPct ?? 0) / 100, barWidth)} {ctxPct === undefined ? '--' : `${Math.round(ctxPct)}%`}
          </Text>
          <Text color={DIM} mono tabular>
            {tokens(s.contextTokens)} / {tokens(s.contextWindow)} tokens
            {s.costUsd !== undefined ? ` · $${s.costUsd.toFixed(2)}` : ''}
            {s.lastTurnMs !== undefined ? ` · last turn ${(s.lastTurnMs / 1000).toFixed(1)}s` : ''}
          </Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color={MID} mono>
            TOP TOOLS
          </Text>
          {top.length === 0 && (
            <Text color={DIM} mono>
              no tool calls yet
            </Text>
          )}
          {top.map(([name, count]) => (
            <Text color={GREEN} mono tabular>
              <Text color={BRIGHT}>{name.slice(0, nameWidth).padEnd(nameWidth)}</Text> {bar(count / topMax, toolBar)} {count}
            </Text>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text color={MID} mono>
            FEED
          </Text>
          {feed.length === 0 && (
            <Text color={DIM} mono>
              waiting for the first call
            </Text>
          )}
          {feed.map(call => (
            <Text color={call.state === 'error' ? RED : call.state === 'runs' ? BRIGHT : DIM} mono wrap="truncate-end">
              {call.state === 'runs' ? '▶' : call.state === 'error' ? '✖' : '✓'} {call.tool}
              {call.detail ? ` ${call.detail}` : ''}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
