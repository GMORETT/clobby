# @gmorett/clobby

CLI for [Clobby](https://clobby.vercel.app) — the lobby for people waiting on agents.

While your AI codes, hang out with other devs doing the same. See who's heads-down,
who's stuck, who's idle.

## Install

```sh
npx @gmorett/clobby install
```

This:

1. Opens a browser window to authenticate with GitHub
2. Detects your agentic tools (Claude Desktop, Claude Code CLI)
3. Sets up a tiny background daemon (for Claude Desktop) or hooks (for Claude Code CLI)
4. Registers the daemon to start on login

No copy-paste, no manual check-in. Your status updates automatically when your
agent starts working, finishes, or goes idle.

## Commands

```sh
clobby install        # Set up auth + daemon/hooks
clobby status         # Check what's installed and running
clobby uninstall      # Remove daemon, hooks, and saved credentials
clobby login          # Re-authenticate without reinstalling
```

## How status is detected

- **Claude Desktop**: a background daemon tails `~/Library/Logs/Claude/main.log`
  (macOS) or `%APPDATA%\Claude\logs\main.log` (Windows) and detects session
  start / stop events.
- **Claude Code CLI**: session-start and stop hooks are registered in
  `~/.claude/settings.json`.

Only events are sent — never prompt content, never file contents, never code.

## Privacy

- Your GitHub username and avatar color are visible in the lobby.
- Your status is one of: `working`, `needs_input`, `idle`. That's it.
- Log files are read locally. Nothing from the logs leaves your machine except
  the two event types listed above.

## Requirements

- Node.js 20+
- macOS or Windows (Linux support coming)

## Uninstall

```sh
npx @gmorett/clobby uninstall
```

Removes the daemon, startup registration, Claude Code hooks, and
`~/.config/clobby/auth.json`.

## License

MIT
