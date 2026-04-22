# Spec 02 — Backend (API + DB)

> Depende de: `00-overview.md`, `04-auth-device-flow.md`

## Purpose

Camada servidor do Clobby. Responsabilidades:

1. Expor endpoints HTTP pros hooks da harness (entrada de eventos)
2. Expor endpoints REST pra frontend (auth web, chat send, presence query)
3. Persistir estado em Postgres (Supabase)
4. Disparar broadcasts via Supabase Realtime quando presence muda ou chat recebe mensagem
5. Validar/autenticar toda entrada

Implementação: **Next.js 15 App Router API Routes** (`app/api/.../route.ts`). Deploy: Vercel.

## In Scope (MVP)

- Endpoints de hook: `/api/hooks/session-start`, `/api/hooks/stop`, `/api/hooks/notification`, `/api/hooks/test`
- Endpoints de auth/device flow: `/api/auth/cli/start`, `/api/auth/cli/confirm`, `/api/auth/cli/poll`
- Endpoints REST do lobby: `/api/me`, `/api/chat/messages` (GET últimas N, POST enviar), `/api/presence` (GET snapshot)
- Schema Postgres com RLS configurado
- Cleanup job (via Supabase pg_cron ou Vercel Cron) pra expirar device codes e presences stale

## Out of Scope (MVP)

- Admin endpoints
- Rate limiting sofisticado (usar plugin/middleware trivial)
- Webhooks pra terceiros
- File uploads
- i18n dos erros

## Data Model

Todos os timestamps são `timestamptz`. IDs são `uuid` gerados server-side (`gen_random_uuid()`).

### `users`

Perfil público. Linkado 1:1 com `auth.users` (Supabase).

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,                -- default: GitHub handle
  avatar_color text not null default '#6366f1', -- hex, escolhido na criação
  created_at timestamptz not null default now()
);
```

Trigger: ao criar row em `auth.users`, criar row correspondente em `public.users` copiando GitHub `user_metadata.user_name` como username (com fallback único se colidir).

### `cli_tokens`

Tokens bearer long-lived emitidos pro CLI. **Nunca** retornados após emissão — só o hash.

```sql
create table public.cli_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,              -- sha256 do token em plaintext
  token_prefix text not null,                   -- primeiros 12 chars pra display (clobby_live_abc)
  label text,                                   -- ex: "MacBook Pro"
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index on public.cli_tokens(token_hash);
```

Formato do token em plaintext: `clobby_live_<32 chars random base62>`.

### `device_codes`

Device flow transitório.

```sql
create table public.device_codes (
  code text primary key,                        -- ex: "ABC-DEF-GHI" (user-friendly, 9 chars)
  user_id uuid references public.users(id),    -- null até ser confirmado
  confirmed_at timestamptz,
  consumed_at timestamptz,                      -- null até o CLI fazer poll e receber o token
  expires_at timestamptz not null,              -- now() + 15min
  cli_token_id uuid references public.cli_tokens(id),
  created_at timestamptz not null default now()
);
```

### `presence`

Estado atual do usuário. **Uma row por (user_id, harness).**

```sql
create type harness_t as enum ('claude_code', 'codex', 'cursor');
create type presence_status_t as enum ('working', 'needs_input', 'idle');

create table public.presence (
  user_id uuid not null references public.users(id) on delete cascade,
  harness harness_t not null,
  status presence_status_t not null,
  session_id text,                              -- id da sessão da harness (opaque)
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  primary key (user_id, harness)
);

create index on public.presence(last_event_at);
```

Linha considerada "stale" se `last_event_at < now() - interval '10 minutes'`. Stale rows são ocultas da UI e limpas via cron.

### `chat_messages`

```sql
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index on public.chat_messages(created_at desc);
```

MVP: sem edição, sem delete do próprio, sem reply.

## RLS (Row Level Security)

**Tudo ligado**, mesmo pra MVP.

- `users`: SELECT público (any authenticated). UPDATE só pra dono.
- `cli_tokens`: SELECT só pro dono. INSERT/UPDATE/DELETE só via server (service role).
- `device_codes`: sem acesso cliente. Só via server.
- `presence`: SELECT público. INSERT/UPDATE só via server (hooks endpoints rodam com service role).
- `chat_messages`: SELECT público (any authenticated). INSERT só via endpoint (que valida e injeta user_id). Nunca expor direct insert client-side.

## Auth Layers

Três tipos de request, três formas de autenticar:

1. **Web (frontend):** Supabase Auth cookie. `createServerClient()` na API route. Endpoints `/api/chat/*`, `/api/me`, `/api/auth/cli/confirm`.
2. **CLI (hooks):** `Authorization: Bearer <cli_token>`. Middleware procura hash no DB, carrega user. Endpoints `/api/hooks/*`.
3. **CLI (device flow):** sem auth no `start` e `poll`. `confirm` usa auth web.

Middleware de bearer token em `lib/auth/verify-cli-token.ts`:

```ts
export async function verifyCliToken(req: Request): Promise<{ user: User; tokenId: string } | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const plaintext = header.slice(7);
  const hash = sha256(plaintext);
  const { data } = await supabaseAdmin
    .from("cli_tokens")
    .select("id, user_id, revoked_at, users(*)")
    .eq("token_hash", hash)
    .single();
  if (!data || data.revoked_at) return null;
  // fire-and-forget last_used_at update
  supabaseAdmin.from("cli_tokens").update({ last_used_at: new Date() }).eq("id", data.id);
  return { user: data.users, tokenId: data.id };
}
```

## Endpoints

Todos os payloads validados com **zod**. Schemas em `lib/schemas/` compartilhados com CLI (importados via workspace).

### `POST /api/hooks/session-start`

Auth: bearer CLI token.
Payload (enviado pelo Claude Code):
```ts
{
  session_id: string,
  transcript_path?: string,
  source?: string
}
```
Ação: upsert em `presence` com `(user_id, harness='claude_code', status='working', session_id, started_at=now(), last_event_at=now())`. Retorna 204.

### `POST /api/hooks/stop`

Auth: bearer CLI token.
Payload: `{ session_id: string, ...rest }`.
Ação: update `presence` para `status='idle', last_event_at=now()`. Retorna 204.

### `POST /api/hooks/notification`

Auth: bearer CLI token.
Payload: `{ session_id: string, message?: string, type?: string }`.
Ação: update `presence` para `status='needs_input', last_event_at=now()`. Retorna 204.

### `POST /api/hooks/test`

Auth: bearer CLI token.
Usado pelo CLI após install pra validar conectividade. **Não** altera presence. Retorna `{ ok: true, user: { id, username } }`.

### `POST /api/auth/cli/start`

Sem auth. Body vazio.
Ação: gera `device_code` com formato `XXX-XXX-XXX` (letras maiúsculas + dígitos, 9 chars), `expires_at = now() + 15min`. Retorna:
```ts
{
  code: "ABC-DEF-GHI",
  verification_url: "https://clobby.app/auth/cli",
  verification_url_complete: "https://clobby.app/auth/cli?code=ABC-DEF-GHI",
  poll_url: "https://clobby.app/api/auth/cli/poll",
  interval_seconds: 2,
  expires_in: 900
}
```

### `POST /api/auth/cli/confirm`

Auth: web session (Supabase cookie).
Body: `{ code: string }`.
Ação:
1. Busca `device_code` pelo code. Se expirado ou já confirmado, retorna erro.
2. Gera novo plaintext token `clobby_live_<random>`, grava hash em `cli_tokens` com `user_id = session.user.id, label = <hostname se vier, senão null>`.
3. Marca device_code: `confirmed_at=now(), user_id, cli_token_id`.
4. Retorna `{ ok: true }`.

**O token plaintext nunca é retornado pra esse endpoint.** Só vai pro CLI via poll.

### `POST /api/auth/cli/poll`

Sem auth. Body: `{ code: string }`.
Ação:
- Se code não existe ou expirou: 404.
- Se ainda não confirmado: `{ status: "pending" }`.
- Se confirmado mas não consumido: lê `cli_token_id`, recupera plaintext (armazenado temporariamente em `device_codes.pending_token` coluna extra cifrada; ver 04-auth-device-flow pra detalhes), marca `consumed_at=now()`, retorna `{ status: "ok", token, user_id, username, api_url }`.
- Se já consumido: 410 Gone (código único).

### `GET /api/me`

Auth: web session OU bearer CLI token (dual).
Retorna `{ id, username, avatar_color }`.

### `GET /api/chat/messages?limit=50&before=<iso>`

Auth: web session.
Retorna últimas N mensagens ordenadas desc. `limit` max 100.

### `POST /api/chat/messages`

Auth: web session.
Body: `{ content: string }` (trimmed, 1-500 chars).
Ação: insert em `chat_messages` com `user_id = session.user.id`. Supabase Realtime já propaga via `postgres_changes`. Retorna `{ id, created_at }`.

### `GET /api/presence`

Auth: web session.
Retorna snapshot atual: lista de `{ user_id, username, avatar_color, harness, status, last_event_at }` filtrado por `last_event_at > now() - 10min`.

## Realtime

Setup no Supabase dashboard:

- Publication `supabase_realtime` inclui tabelas `presence` e `chat_messages`.
- Frontend se inscreve em:
  - `postgres_changes` na tabela `presence` (event: `*`) — renderiza bolinhas
  - `postgres_changes` na tabela `chat_messages` (event: `INSERT`) — renderiza mensagens novas

Frontend **não** usa broadcast channel; tudo via postgres_changes pra garantir ordem e consistência.

## Cron / Cleanup

Dois jobs periódicos (Vercel Cron + Next.js route, ou Supabase pg_cron):

### `DELETE /api/cron/cleanup-device-codes` (a cada 5 min)
```sql
delete from device_codes where expires_at < now() - interval '1 hour';
```

### `DELETE /api/cron/cleanup-stale-presence` (a cada 2 min)
```sql
delete from presence where last_event_at < now() - interval '10 minutes';
```

Auth dos crons: header `Authorization: Bearer <CRON_SECRET>` configurado em env var.

## Rate Limiting (MVP mínimo)

Em memória com `@upstash/ratelimit` + Upstash Redis (free tier) OU implementação caseira na mesa Postgres:

- `/api/hooks/*`: 120 req/min por `cli_token_id`
- `/api/chat/messages POST`: 20 msg/min por `user_id`
- `/api/auth/cli/poll`: 60 req/min por IP
- `/api/auth/cli/start`: 10 req/min por IP

Respostas 429 com header `Retry-After`.

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=https://clobby.app
CRON_SECRET=<random 32 bytes base64>

# Opcional rate limit
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Directory Structure

```
app/
├── api/
│   ├── hooks/
│   │   ├── session-start/route.ts
│   │   ├── stop/route.ts
│   │   ├── notification/route.ts
│   │   └── test/route.ts
│   ├── auth/cli/
│   │   ├── start/route.ts
│   │   ├── confirm/route.ts
│   │   └── poll/route.ts
│   ├── chat/messages/route.ts
│   ├── presence/route.ts
│   ├── me/route.ts
│   └── cron/
│       ├── cleanup-device-codes/route.ts
│       └── cleanup-stale-presence/route.ts
├── (auth)/login/page.tsx
├── (auth)/auth/cli/page.tsx       # confirmação device flow
├── lobby/page.tsx
├── install/page.tsx
└── page.tsx                        # landing simples

lib/
├── supabase/
│   ├── server.ts                   # createServerClient com cookies
│   ├── admin.ts                    # service role, só no server
│   └── client.ts                   # browser client
├── auth/
│   ├── verify-cli-token.ts
│   └── hash-token.ts
├── schemas/
│   ├── hook-payloads.ts
│   └── device-flow.ts
└── rate-limit.ts

supabase/
├── migrations/
│   ├── 0001_init.sql
│   └── 0002_rls.sql
└── seed.sql
```

## Acceptance Criteria

- [ ] Todas as migrations aplicam limpo em DB Postgres vazio
- [ ] Hook recebe payload → presence atualiza em <200ms p95 → frontend recebe via Realtime em <500ms p95
- [ ] Token revogado retorna 401 imediatamente
- [ ] Device code usado 2x retorna 410 na segunda
- [ ] Device code expirado (>15min) é rejeitado no confirm
- [ ] RLS bloqueia user A de ver `cli_tokens` de user B (teste explícito)
- [ ] Presence stale é limpa e não aparece em `GET /api/presence`
- [ ] Rate limit 429 aparece após exceder thresholds configurados
- [ ] Todas API routes validam com zod e retornam 400 com detalhes em caso de payload inválido

## Open Questions

- [ ] Usar Supabase pg_cron ou Vercel Cron? (recomendação: Vercel Cron pra ficar tudo no mesmo deploy)
- [ ] Persistir token plaintext no device_code é arriscado — melhor gerar o token no `confirm` e passar por canal criptografado? Ver `04-auth-device-flow.md` pra decisão final.
