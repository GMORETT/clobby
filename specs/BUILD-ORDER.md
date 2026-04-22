# Clobby — Build Order

> Guia linear de construção. Execute de cima pra baixo. Cada Fatia tem comandos exatos, o que prompter pra IA, e um **checkpoint de validação** no fim — só avance quando o checkpoint passar.

## Pré-requisitos (instalar antes de começar)

- [ ] Node.js ≥ 20 (`node -v`)
- [ ] pnpm ≥ 9 (`npm i -g pnpm`)
- [ ] Git configurado
- [ ] Conta no GitHub
- [ ] Conta no Supabase (https://supabase.com — free tier)
- [ ] Conta na Vercel (https://vercel.com — free tier)
- [ ] Claude Code instalado e funcional (`claude --version`)
- [ ] Editor: VS Code, Cursor ou você rodando via Claude Code mesmo
- [ ] Supabase CLI instalada: `brew install supabase/tap/supabase` (mac) ou equivalente

**Dica:** crie uma pasta `~/projects/clobby/` e trabalhe dentro dela. Todos os comandos assumem que você tá na raiz do projeto.

---

## Fatia 0 — Fundação (monorepo + deploy vazio)

**Meta:** ter um monorepo com Next.js rodando local, CLI que compila, e um deploy na Vercel que responde "Hello World". Sem features.

### Passos

**0.1 — Criar repo**

```bash
mkdir clobby && cd clobby
git init
pnpm init
```

Edite o `package.json` raiz:
```json
{
  "name": "clobby",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  }
}
```

Crie `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Crie `.gitignore`:
```
node_modules
.next
dist
.env
.env.local
.vercel
.DS_Store
```

**0.2 — Criar apps/web (Next.js)**

```bash
mkdir apps && cd apps
pnpm create next-app@latest web --ts --tailwind --app --src-dir=false --turbopack --import-alias="@/*" --no-eslint
cd ../..
pnpm install
```

(Se o create-next-app pedir confirmações, aceite os defaults sugeridos acima.)

Testa: `pnpm dev` → abre `http://localhost:3000`, vê a landing padrão do Next.

**0.3 — Criar packages/cli (stub)**

```bash
mkdir -p packages/cli/src
cd packages/cli
pnpm init
```

`packages/cli/package.json`:
```json
{
  "name": "@clobby/cli",
  "version": "0.0.1",
  "type": "module",
  "bin": { "clobby": "./dist/index.js" },
  "scripts": {
    "build": "tsup src/index.ts --format esm --clean --dts",
    "dev": "tsup src/index.ts --format esm --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/cli/src/index.ts`:
```ts
#!/usr/bin/env node
console.log("clobby cli v0.0.1 — hello");
```

Volta pra raiz e instala:
```bash
cd ../..
pnpm install
pnpm --filter @clobby/cli build
node packages/cli/dist/index.js
```

Deve imprimir `clobby cli v0.0.1 — hello`.

**0.4 — Commit inicial + Git remote**

```bash
git add .
git commit -m "chore: initial monorepo scaffolding"
```

Criar repo vazio no GitHub, depois:
```bash
git remote add origin git@github.com:seuuser/clobby.git
git push -u origin main
```

**0.5 — Deploy na Vercel**

Pela UI da Vercel: "New Project" → importar o repo GitHub. Config:
- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (auto)
- **Build Command:** deixa default
- **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`

Deploy. Depois que passar, acessa a URL `*.vercel.app`.

**0.6 — Criar Supabase project**

Pela UI do Supabase: "New Project". Anote:
- Project URL
- `anon` key (pública)
- `service_role` key (secreta, **nunca** commitar)

Não aplica nada ainda — só cria o projeto.

### Checkpoint Fatia 0 ✅

- [ ] `pnpm dev` roda Next.js em localhost:3000
- [ ] `node packages/cli/dist/index.js` imprime "hello"
- [ ] Vercel deploy público responde com a landing default do Next
- [ ] Supabase project existe com as 3 credenciais anotadas num lugar seguro

---

## Fatia 1 — DB + Auth web + lobby placeholder

**Meta:** logar via GitHub OAuth, ver um `/lobby` que cumprimenta pelo username. Fim.

### Passos

**1.1 — Configurar Supabase local com CLI**

```bash
cd apps/web
supabase init
supabase link --project-ref <seu-project-ref>  # vem da URL do Supabase
```

Isso cria `apps/web/supabase/`. As migrations vão aqui.

**1.2 — Escrever a migration inicial**

Pede pra IA:

> Leia `specs/02-backend.md` seção "Data Model". Crie a migration `apps/web/supabase/migrations/0001_init.sql` com as tabelas `users`, `cli_tokens`, `device_codes`, `presence`, `chat_messages` e os tipos `harness_t` e `presence_status_t`. Adicione trigger que popula `public.users` quando um row é criado em `auth.users`, usando `raw_user_meta_data->>'user_name'` como username (com fallback único se colidir).

Revisa o SQL que ela gerou contra a spec.

**1.3 — Aplicar migration**

```bash
supabase db push
```

Verifica no Supabase Studio (UI web) que as tabelas estão lá.

**1.4 — Escrever migration de RLS**

Pede pra IA:

> Crie `apps/web/supabase/migrations/0002_rls.sql` ativando RLS em todas as tabelas com as policies descritas em `specs/02-backend.md` seção "RLS".

Aplica: `supabase db push`.

**1.5 — Configurar GitHub OAuth no Supabase**

GitHub → Settings → Developer settings → OAuth Apps → New:
- Homepage URL: `https://<seuapp>.vercel.app`
- Callback URL: `https://<seu-supabase>.supabase.co/auth/v1/callback`

Copia Client ID e Client Secret, cola no Supabase Studio → Authentication → Providers → GitHub.

**1.6 — Env vars no Next.js**

`apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Na Vercel, adicionar as mesmas vars em Settings → Environment Variables, mas `NEXT_PUBLIC_APP_URL` = URL de produção.

**1.7 — Instalar Supabase libs**

```bash
pnpm --filter web add @supabase/supabase-js @supabase/ssr
```

**1.8 — Criar clients e middleware**

Pede pra IA:

> Leia `specs/02-backend.md` seção "Auth Layers". Crie:
> - `apps/web/lib/supabase/server.ts` (createServerClient com cookies, pra Server Components e route handlers)
> - `apps/web/lib/supabase/admin.ts` (service role, só server-side)
> - `apps/web/lib/supabase/client.ts` (browser client)
> - `apps/web/middleware.ts` que protege `/lobby`, `/install`, `/status` (redireciona `/login?next=...` se não logado) e deixa `/`, `/login`, `/auth/cli`, `/api/*` livres.

**1.9 — Páginas de auth**

Pede pra IA:

> Crie:
> - `apps/web/app/login/page.tsx`: botão "Continue with GitHub" que chama `supabase.auth.signInWithOAuth({ provider: 'github' })`. Preserva `?next=...` no redirectTo.
> - `apps/web/app/auth/callback/route.ts`: exchange code → session, redireciona pro `next` (ou `/install` se for primeiro login — cheque se `public.users.created_at > now() - interval '1 minute'` como heurística).
> - `apps/web/app/page.tsx`: landing simples (seção hero + CTA "Get started" → /login).
> - `apps/web/app/lobby/page.tsx`: Server Component que lê user do supabase e renderiza `<h1>Hello, @{username}</h1>` + link de logout.

**1.10 — Testa**

```bash
pnpm dev
```

- Abre `localhost:3000` → landing.
- Click "Get started" → `/login`.
- Click "Continue with GitHub" → OAuth → volta.
- Deveria ir pra `/install` (primeira vez) ou `/lobby`.
- `/lobby` mostra seu username.
- Supabase Studio → `public.users` tem seu row.

Deploy na Vercel (push pra main). Repete o teste em produção.

### Checkpoint Fatia 1 ✅

- [ ] Login GitHub funciona local e produção
- [ ] `public.users` populado via trigger (não via código no frontend)
- [ ] `/lobby` protegido (logout + acessar redireciona pra login)
- [ ] Middleware preserva `?next=` no redirect

---

## Fatia 2 — Device flow end-to-end (a mais crítica)

**Meta:** `node packages/cli/dist/index.js login` abre o browser, eu autorizo, terminal recebe token, token funciona em `/api/me`.

### Passos

**2.1 — Schemas compartilhados**

Cria `packages/schemas`:
```bash
mkdir -p packages/schemas/src
cd packages/schemas
pnpm init
```

`packages/schemas/package.json`:
```json
{
  "name": "@clobby/schemas",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.23.0" }
}
```

Instala zod: `pnpm install` na raiz.

Pede pra IA:

> Leia `specs/04-auth-device-flow.md`. Crie `packages/schemas/src/device-flow.ts` exportando zod schemas e tipos pra: StartResponse, PollRequest, PollResponse (discriminated union pending/ok), ConfirmRequest. Re-exporte tudo de `packages/schemas/src/index.ts`.

Adiciona `@clobby/schemas` como dep em `apps/web` e `packages/cli`:
```bash
pnpm --filter web add @clobby/schemas@workspace:*
pnpm --filter @clobby/cli add @clobby/schemas@workspace:*
```

**2.2 — Endpoints de device flow**

Pede pra IA:

> Leia `specs/02-backend.md` (seção Endpoints auth/cli) e `specs/04-auth-device-flow.md` (todo o doc, prestando atenção em "Storage: Plaintext Token Temporário" — implemente a opção 4 com AES-GCM).
>
> Crie:
> - `apps/web/lib/auth/device-code.ts`: gera code no formato XXX-XXX-XXX com charset Crockford base32 filtrado; `encryptToken(plaintext, code)` e `decryptToken(enc, code)` usando AES-256-GCM com chave = sha256(code + DEVICE_CODE_ENCRYPTION_SECRET).
> - `apps/web/lib/auth/cli-token.ts`: gera plaintext `clobby_live_<32 base62>` e hash sha256.
> - `apps/web/app/api/auth/cli/start/route.ts`: POST, sem auth, retorna payload spec 02.
> - `apps/web/app/api/auth/cli/confirm/route.ts`: POST, auth web, recebe `{ code }`, valida, gera cli_token, cifra plaintext no device_code.
> - `apps/web/app/api/auth/cli/poll/route.ts`: POST, sem auth, decifra e retorna token uma única vez.
> - `apps/web/app/api/me/route.ts`: GET, aceita bearer token **OU** cookie web. Retorna `{ id, username, avatar_color }`.
>
> Use zod schemas de `@clobby/schemas` em todas as validações.

Adiciona `DEVICE_CODE_ENCRYPTION_SECRET` no `.env.local` e Vercel:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**2.3 — Página `/auth/cli`**

Pede pra IA:

> Leia `specs/03-frontend.md` seção `/auth/cli?code=ABC-DEF-GHI`. Crie `apps/web/app/auth/cli/page.tsx`: se não logado, redireciona pra /login preservando query. Se logado, mostra o code (vindo da query) + botão "Authorize" que faz POST em `/api/auth/cli/confirm`. Em sucesso: "✓ Authorized! Return to your terminal."

**2.4 — CLI: comando `login`**

Pede pra IA:

> Leia `specs/01-cli.md` (estrutura geral) e `specs/04-auth-device-flow.md` (seção CLI Behavior).
>
> Reestruture `packages/cli/src/`:
> - `src/index.ts`: commander, só registra o comando `login` por enquanto
> - `src/config.ts`: API_URL e APP_URL com override via env
> - `src/api/client.ts`: wrapper fetch com Authorization header
> - `src/auth/storage.ts`: read/write `~/.config/clobby/auth.json` com chmod 0600
> - `src/auth/device-flow.ts`: startFlow() e pollForToken() conforme spec
> - `src/commands/login.ts`: implementa o comando
>
> Use zod de `@clobby/schemas`. Use `open` (npm) pra abrir browser. Use `@clack/prompts` pra spinner. Implemente fallback de URL manual se `open` falha.

Instala deps:
```bash
pnpm --filter @clobby/cli add open @clack/prompts commander
```

Build e testa:
```bash
CLOBBY_API_URL=http://localhost:3000 CLOBBY_APP_URL=http://localhost:3000 \
  node packages/cli/dist/index.js login
```

Fluxo esperado: spinner → browser abre em `/auth/cli?code=XXX` → autorizo → spinner vira "Authorized" → token salvo em `~/.config/clobby/auth.json`.

**2.5 — Teste do token**

```bash
TOKEN=$(jq -r .token ~/.config/clobby/auth.json)
curl http://localhost:3000/api/me -H "Authorization: Bearer $TOKEN"
```

Deve retornar `{ id, username, avatar_color }`.

### Checkpoint Fatia 2 ✅

- [ ] `clobby login` local → abre browser → autoriza → volta token em <30s
- [ ] Token em `~/.config/clobby/auth.json` com perm 0600 (`ls -l`)
- [ ] `curl /api/me` com bearer funciona
- [ ] Rodar `clobby login` 2ª vez com code usado → mensagem de erro limpa
- [ ] Code expirado (espera 15min ou edita DB pra expirar) → erro limpo
- [ ] Deploy em prod: repetir fluxo com `CLOBBY_API_URL=https://seu.vercel.app`

> **Se essa fatia der problema, NÃO avance.** Device flow ruim = toda a arquitetura ruim.

---

## Fatia 3 — Hook endpoints + presence no lobby

**Meta:** você dispara curl simulando hook, vê bolinha mudar no `/lobby` em tempo real.

### Passos

**3.1 — Hook endpoints**

Pede pra IA:

> Leia `specs/02-backend.md` seção "Endpoints de hook". Crie:
> - `apps/web/lib/auth/verify-cli-token.ts` (spec fornece impl)
> - `apps/web/app/api/hooks/session-start/route.ts`
> - `apps/web/app/api/hooks/stop/route.ts`
> - `apps/web/app/api/hooks/notification/route.ts`
> - `apps/web/app/api/hooks/test/route.ts`
>
> Todos validam bearer token. session-start upserta presence com status=working. stop → idle. notification → needs_input. test retorna { ok, user }.

**3.2 — Habilitar Realtime no Supabase**

Supabase Studio → Database → Replication → liga replicação pra `presence` e `chat_messages`.

**3.3 — Lobby com presence**

Pede pra IA:

> Leia `specs/03-frontend.md` seções "Pages → /lobby" e "State Management". Crie:
> - `apps/web/app/api/presence/route.ts`: GET snapshot (filtrado por last_event_at > now() - 10min)
> - `apps/web/app/lobby/_hooks/useLobbyPresence.ts`: hook descrito na spec
> - `apps/web/app/lobby/_components/AvatarBubble.tsx`: bolinha com cor, iniciais, status border (working = pulse amarelo, needs_input = vermelho pulsante, idle = verde)
> - `apps/web/app/lobby/_components/PresenceGrid.tsx`: grid responsivo das bolinhas, ordenação spec
> - Atualiza `apps/web/app/lobby/page.tsx` pra Client Component que usa o hook
>
> Paleta de cores conforme spec 03.

Instala se precisar: `pnpm --filter web add @tanstack/react-query` (opcional MVP, pode usar fetch puro).

**3.4 — Teste manual via curl**

```bash
TOKEN=$(jq -r .token ~/.config/clobby/auth.json)

# session-start (bolinha amarela)
curl -X POST http://localhost:3000/api/hooks/session-start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-1"}'

# notification (bolinha vermelha)
curl -X POST http://localhost:3000/api/hooks/notification \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-1","message":"need input"}'

# stop (bolinha verde)
curl -X POST http://localhost:3000/api/hooks/stop \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-1"}'
```

Mantém `/lobby` aberto enquanto dispara — vê bolinha mudar ao vivo.

### Checkpoint Fatia 3 ✅

- [ ] Hook sem token → 401
- [ ] Hook com token inválido → 401
- [ ] Curl muda bolinha no lobby em <1s (Realtime funcionando)
- [ ] Presence com `last_event_at` > 10min não aparece no lobby
- [ ] Abrir 2 abas com mesma conta → ambas atualizam

---

## Fatia 4 — CLI install + Claude Code de verdade

**Meta:** `npx @clobby/cli install` integra com Claude Code real. Rodo `claude` em qualquer repo, vejo minha bolinha virar amarela sozinha, e verde quando ele termina.

### Passos

**4.1 — Harness: Claude Code**

Pede pra IA:

> Leia `specs/01-cli.md` seções "Harness Interface" e "Claude Code Implementation". Crie:
> - `packages/cli/src/harnesses/types.ts`: interface Harness, DetectResult, InstallParams, InstallResult
> - `packages/cli/src/harnesses/claude-code.ts`: impl completa (detect, installHooks, removeHooks, listInstalledHooks) lendo/escrevendo `~/.claude/settings.json`
> - `packages/cli/src/harnesses/registry.ts`: array com claude-code (e stubs "not supported" pra codex/cursor)
> - `packages/cli/src/utils/json-merge.ts`: merge seguro descrito na spec (nunca sobrescrever hooks existentes, backup antes)
> - `packages/cli/src/utils/paths.ts`: resolve config dirs por OS
>
> A remove só deve apagar matcher groups cujo url começa com nosso API URL.

**4.2 — Testes do merge (crítico)**

Pede pra IA:

> Crie `packages/cli/tests/json-merge.test.ts` com fixtures:
> - settings.json vazio
> - settings.json com hooks só do Clobby
> - settings.json com hooks de outras ferramentas (ex: GitButler conforme spec 01)
> - settings.json com hooks mistos
>
> Teste install + uninstall em todos. Afirme que após uninstall os hooks de outras ferramentas estão intactos.

Instala: `pnpm --filter @clobby/cli add -D vitest` e adiciona script `"test": "vitest run"`.

**4.3 — Comandos install/uninstall/status**

Pede pra IA:

> Leia `specs/01-cli.md` seções `clobby install`, `uninstall`, `status`. Implemente:
> - `packages/cli/src/commands/install.ts`
> - `packages/cli/src/commands/uninstall.ts`
> - `packages/cli/src/commands/status.ts`
> - `packages/cli/src/commands/logout.ts`
> - Registra tudo em `src/index.ts`
>
> install: detecta harnesses → faz login se precisar → confirma com user → faz backup → escreve hooks → POST /api/hooks/test → sucesso.

**4.4 — Testa contra Claude Code real**

```bash
# Desinstala qualquer coisa anterior
node packages/cli/dist/index.js uninstall

# Instala contra local
CLOBBY_API_URL=http://localhost:3000 \
CLOBBY_APP_URL=http://localhost:3000 \
  node packages/cli/dist/index.js install

# Verifica settings.json
cat ~/.claude/settings.json | jq .hooks
```

Agora rodar Claude Code em qualquer repo:
```bash
cd ~/algum-projeto
claude
> pede pra ele fazer qualquer coisa
```

Enquanto ele pensa, abre `http://localhost:3000/lobby` em outra aba — bolinha deveria estar amarela. Quando ele termina de responder → verde.

Se ele pedir permissão ou input → vermelho.

**4.5 — Desinstala e verifica**

```bash
node packages/cli/dist/index.js uninstall
cat ~/.claude/settings.json | jq .hooks   # sem hooks do Clobby
```

### Checkpoint Fatia 4 ✅

- [ ] `clobby install` escreve hooks sem tocar em hooks pré-existentes
- [ ] Backup em `settings.json.clobby-backup.<ts>` foi criado
- [ ] Rodar Claude Code real: bolinha muda amarelo → verde automaticamente
- [ ] `clobby status` mostra "Claude Code — hooks installed (3 events)"
- [ ] `clobby uninstall` remove SÓ nossos hooks, deixa outros intactos
- [ ] Teste de fixture com hooks do GitButler passa

> **🎉 Esse é o momento mágico.** A partir daqui, o produto existe de verdade — tudo mais é melhoria.

---

## Fatia 5 — Chat

**Meta:** duas abas com contas diferentes conversam em tempo real.

### Passos

**5.1 — Endpoints**

Pede pra IA:

> Leia `specs/02-backend.md` seção chat. Crie:
> - `apps/web/app/api/chat/messages/route.ts`: GET (últimas N) e POST (envia, valida 1-500 chars trimmed)
>
> Use zod. Rate limit pode ficar stub por enquanto.

**5.2 — UI de chat**

Pede pra IA:

> Leia `specs/03-frontend.md` seção "Chat panel" e "useLobbyChat". Crie:
> - `apps/web/app/lobby/_hooks/useLobbyChat.ts`
> - `apps/web/app/lobby/_components/ChatInput.tsx` (Enter envia, Shift+Enter quebra, contador quando >450)
> - `apps/web/app/lobby/_components/ChatMessage.tsx`
> - `apps/web/app/lobby/_components/Chat.tsx` (lista scrollável + input, auto-scroll se no fundo)
> - Integra no `lobby/page.tsx` com layout split (PresenceGrid | Chat)

**5.3 — Teste**

Abre 2 navegadores (ou um normal + um anônimo com outra conta GitHub). Chat deve sincronizar em <1s.

### Checkpoint Fatia 5 ✅

- [ ] Mensagem entregue em <1s entre abas
- [ ] Reload mantém histórico (últimas 50)
- [ ] Mensagem vazia ou >500 chars rejeitada
- [ ] Enter envia, Shift+Enter quebra linha
- [ ] Cor da bolinha do autor bate com `avatar_color`

---

## Fatia 6 — Polish

**Meta:** produto não embaraçoso pra mostrar. Cada item abaixo é independente — pode fazer em qualquer ordem, ou pular o que não importa pra você.

### Itens

**6.1 — Rate limiting**
- Upstash Redis conta free, `@upstash/ratelimit`, conforme spec 02
- Aplica nos endpoints listados

**6.2 — Crons de cleanup**
- Vercel Cron em `/api/cron/cleanup-*` com `CRON_SECRET`
- `vercel.json` com schedule

**6.3 — Som de notificação + toggle**
- `/public/sounds/idle.mp3` (gera um pop curto em qualquer gerador online)
- Toca quando meu status vai pra `idle`. Toggle em localStorage.

**6.4 — Estados de erro**
- Banner "Reconnecting..." quando Realtime cai
- Toast em 500/timeout
- CLI: mensagens humanas, exit codes da spec

**6.5 — Mensagens de erro do CLI**
- Sem stack trace cru
- `--verbose` pra debug

**6.6 — Dark mode lock + fonte**
- Tailwind `dark` forçado no `<html>`
- Fonte monospace pro lobby (JetBrains Mono ou Geist Mono)

**6.7 — Landing bonita**
- Hero com screenshot/GIF do lobby
- Seção "How it works" (3 passos)
- Footer com GitHub link

**6.8 — Acceptance criteria das specs**
- Roda por cada spec os checkboxes
- Anota os que falham como issues

### Checkpoint Fatia 6 ✅

- [ ] Você mesmo mostraria pra um amigo dev sem constrangimento
- [ ] Todos os checkboxes das specs passam (ou têm issue aberta)

---

## Fatia 7 — Launch

### Passos

**7.1 — Publicar CLI**

```bash
cd packages/cli
# primeiro pacote público no seu scope? npm cria o scope automaticamente se for seu username
# se você quer scope @clobby custom, precisa criar uma org no npm
npm login
pnpm build
npm publish --access public
```

Testa: `npx @clobby/cli@latest status` numa máquina limpa (ou `npm uninstall -g @clobby/cli && npx @clobby/cli login`).

**7.2 — Domínio customizado**

Compra domínio, aponta pra Vercel via CNAME, atualiza env vars:
- `NEXT_PUBLIC_APP_URL=https://clobby.xyz`
- Ajusta callback URL do GitHub OAuth pra domínio novo

CLI já aponta pra `NEXT_PUBLIC_APP_URL` implícito via `config.ts`. Rebuilda e republica `@clobby/cli` com versão nova.

**7.3 — Smoke test end-to-end**

Máquina limpa (VM ou máquina de um amigo):
```bash
npx @clobby/cli@latest install
```

Instala, loga, hooka Claude Code, abre lobby, bolinha aparece. Se passou aqui, pode lançar.

**7.4 — Anúncio**

Post no Twitter dev / Hacker News Show HN / comunidade do Claude Code. Link pra página de install com GIF do fluxo.

### Checkpoint Fatia 7 ✅

- [ ] `npx @clobby/cli` funciona de uma máquina limpa (sem repo local)
- [ ] Domínio custom serve HTTPS
- [ ] Login em prod gera user novo sem erros
- [ ] GIF gravado do fluxo inteiro pra divulgação

---

## Workflow sugerido por fatia

Em cada sessão de trabalho com a IA (Claude Code/Cursor), siga este padrão:

1. **Abrir o prompt com contexto focado**:
   ```
   Estou na Fatia X do specs/BUILD-ORDER.md. 
   Já completei checkpoints das Fatias anteriores (X-1, X-2...).
   
   Leia:
   - specs/BUILD-ORDER.md seção "Fatia X"
   - [specs específicas listadas na fatia]
   
   Implemente o passo X.Y. Ao terminar, rode o teste de validação 
   do passo e me diga o resultado.
   ```

2. **Uma fatia por sessão quando possível.** Muda de fatia = abre sessão nova pra contexto limpo.

3. **Se falhar o checkpoint**, não avance. Escreva o que falhou em `NOTES.md`, debug até passar.

4. **Commita por passo** (X.1, X.2...), não por fatia. Se der ruim, reverter é mais fácil.

5. **Atualiza a spec antes do código se algo mudou.** Spec é verdade.

---

## Estimativa de tempo (muito rough)

Assumindo você codando com Claude Code pra gerar, revisar, ajustar:

| Fatia | Estimativa       | Bloqueadores prováveis                     |
| ----- | ---------------- | ------------------------------------------ |
| 0     | 1-2 horas        | Contas e config inicial                    |
| 1     | 3-5 horas        | GitHub OAuth setup, trigger do user        |
| 2     | 6-10 horas       | Device flow tem muita parte móvel          |
| 3     | 3-5 horas        | Supabase Realtime subscription            |
| 4     | 4-6 horas        | JSON merge edge cases                      |
| 5     | 2-3 horas        | Relativamente simples depois de 3 pronto   |
| 6     | 4-8 horas        | Depende de quanto polish                   |
| 7     | 1-2 horas        | Se tudo correu bem antes                   |

**Total: 24-41 horas.** Distribui em 2-4 semanas de side project.

---

## Quando pedir ajuda

- **Device flow não fecha:** revisa logs do Next em `/api/auth/cli/poll` — código já foi usado? Código expirou?
- **Realtime não atualiza:** checa Replication habilitada no Supabase Studio pra tabela certa
- **RLS bloqueando legit:** testa no Studio SQL editor logado como usuário; se passa lá mas não no app, é cookie/session
- **Hook do Claude Code não dispara:** `cat ~/.claude/settings.json | jq .hooks` — a config tá escrita? Logs do Next recebem request? Se não, bug de config. Se recebem mas retornam erro, bug server.

---

## Não-objetivos deste documento

- Não ensina React/Next/Supabase básico. Se algo do comando não fizer sentido, pause e leia a doc oficial.
- Não cobre Codex/Cursor — quando o MVP tá no ar e validado, aí adiciona.
- Não cobre testes automatizados além do essencial. Adiciona depois se o produto pegar.
