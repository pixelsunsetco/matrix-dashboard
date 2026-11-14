# Matrix dashboard

A Matrix look for Claude Code in the Claude desktop app, built on the pattern of the theme-examples plugin.

What it does:

- Paints a phosphor-green, dark-only color theme over the whole app: near-black green surfaces, bright green text, green accent, with red, amber and teal kept for danger, warning and code.
- Draws digital rain behind the chat: two layers of falling katakana and digits with bright heads and fading tails, behind frosted dark-green panels. The rain rests as a still picture when the system asks for reduced motion.
- Opens a Matrix dashboard pane beside the chat with the session's status, turn and tool call counts, context window use, cost, a chart of the most-used tools and a live feed of tool calls. Minimized to a widget it shows a three-line glance.
- Pins a status line under the prompt: phase, turns, calls and context percent.

Commands:

- `/matrix` opens the dashboard pane.
- `/matrix theme off` clears the look and keeps the pane. `/matrix theme on` restores it.
- `/matrix reset` zeroes the counters.

It keeps its counters in session state, reads the session's usage figures after each turn, and sends nothing anywhere. The terminal and editors draw no look; the pane and status line still work there.

## Install the mod

At the prompt of a Claude Code terminal session:

```
/plugin install matrix-dashboard --marketplace pixelsunsetco/matrix-dashboard
```

Answer `y` to add the marketplace, then choose a scope. The user scope loads the mod in every session.

From a shell:

```
claude plugin install matrix-dashboard --marketplace pixelsunsetco/matrix-dashboard
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, then Add marketplace with `pixelsunsetco/matrix-dashboard`, then Add plugin.
