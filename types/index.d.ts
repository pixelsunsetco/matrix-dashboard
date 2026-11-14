export type ToolCall = {
  id: string
  tool: string
  /** A short note on what the call did: a command, a path, a pattern. */
  detail: string
  state: 'runs' | 'done' | 'error'
  at: number
}

export type Stats = {
  /** When the dashboard first started counting, in ms since the epoch. */
  startedAt: number
  /** The clock's last tick, so uptime moves while nothing else happens. */
  now: number
  turns: number
  calls: number
  errors: number
  /** Calls per tool name. */
  byTool: Record<string, number>
  /** The newest calls last; at most 40 kept. */
  feed: ToolCall[]
  /** The model's context window, read after each turn. */
  contextPercent?: number
  contextTokens?: number
  contextWindow?: number
  costUsd?: number
  lastTurnMs?: number
  /** What the session is doing now. */
  phase: 'idle' | 'thinking' | 'tool'
}

declare module 'claude-code' {
  interface PluginState {
    'matrix-dashboard': { stats: Shaped<Stats> }
  }
}
