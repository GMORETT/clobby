# Clobby

The lobby for people waiting on agents. Monorepo.

## Structure

```
apps/
  web/          Next.js 16 app (landing, login, lobby, API routes) — deploys to Vercel
packages/
  cli/          @gmorett/clobby — CLI + background daemon (published to npm)
  schemas/      Shared zod schemas (bundled into CLI at build time)
```

## Dev

```sh
pnpm install
pnpm dev              # runs web on :3000
pnpm --filter @gmorett/clobby dev   # watch build of CLI
```

Supabase project config is in `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEVICE_CODE_ENCRYPTION_SECRET=  # 32+ char random string
```

## Release

### Web

Push to main → Vercel deploys. Set `NEXT_PUBLIC_SITE_URL` in prod env vars.

### CLI

```sh
cd packages/cli
pnpm build
npm publish --access public
```

Bumps: update `version` in `packages/cli/package.json`. Follow semver.

## Architecture notes

- **Presence** (who's online + status): `presence` table in Supabase.
  Realtime via `postgres_changes` on `authenticated` role (SELECT policy
  required — see migrations).
- **Chat**: `chat_messages` table. Same pattern. Rate limited in-memory
  (1/s, 10/10s, 60/min) in `lib/rate-limit.ts`.
- **Agent detection**:
  - Claude Code CLI: `~/.claude/settings.json` hooks → POST to
    `/api/hooks/session-start` and `/api/hooks/stop`.
  - Claude Desktop: background daemon (`packages/cli/src/daemon.ts`) tails
    `%APPDATA%\Claude\logs\main.log` (Windows) or
    `~/Library/Logs/Claude/main.log` (macOS), detects
    `LocalSessions.sendMessage` and `[Stop hook] Query completed`.
  - Registered to start on login via Startup folder (Windows) or
    LaunchAgent plist (macOS).
- **CLI auth**: device-code flow → token stored in
  `~/.config/clobby/auth.json`, sent as Bearer to hook endpoints.
