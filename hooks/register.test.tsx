import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PANE = {
  plugin: 'matrix-dashboard',
  component: 'Pane',
  requestId: 'matrix',
  props: {
    title: 'Matrix',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

function engine(on: Parameters<TestBody>[1]): { themes: unknown[] } {
  const themes: unknown[] = []
  on('theme.set', (_, e) => {
    themes.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  let now = 1_700_000_000_000
  on('clock.now', () => ({ value: (now += 1000) }))
  on('clock.every', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'matrix' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 40_000, window: 200_000, percent: 20 }, rateLimits: [], cost: { usd: 0.5 } },
  }))
  on('tool.call', () => ({ result: {} }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return { themes }
}

test('the look is set at session start with the rain scene', async ($, on) => {
  const { themes } = engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(themes.length).toBe(1)
  const look = themes[0] as { backdrop?: { scene?: string }; colors?: unknown }
  expect(look.backdrop?.scene).toBe('digital-rain')
  expect(look.colors).toBeDefined()
})

test('the pane counts a turn and a tool call, on every surface', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'ls', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls -la' })
  await $.turn.complete({ turnId: 't1', answer: 'done', durationMs: 1200, isAborted: false, reason: 'answer' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /TURNS/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /✓ Bash/ }))?.text).toBe('✓ Bash ls -la')
    expect(await ui.find({ type: 'Text', text: /20%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the backdrop draws the rain on desktop and leaves the terminal alone', async ($, on) => {
  engine(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const desktop = await $.ui.mount({
    plugin: 'matrix-dashboard',
    component: 'Backdrop',
    requestId: 'backdrop',
    surface: 'desktop',
    props: { scene: 'digital-rain', plugin: 'matrix-dashboard', glass: { blur: 12, opacity: 0.58 } },
  })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  await desktop.unmount()
})
