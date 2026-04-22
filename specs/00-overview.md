# Clobby — Overview & Arquitetura

> Spec raiz. Leia antes de qualquer outra. Define vocabulário, arquitetura e fluxos end-to-end que as outras specs referenciam.

## Purpose

Clobby é um lobby social web para usuários de agentic coding tools (Claude Code, Codex, Cursor). Enquanto o agente executa uma task longa, o usuário é direcionado pro lobby, onde vê outros usuários no mesmo estado ("esperando a IA") e pode conversar. Quando o agente termina, o lobby notifica o usuário pra voltar ao terminal.

**Tese do produto:** tempo ocioso esperando agentes virou parte da rotina de devs modernos. Transformar isso em espaço social é útil (notificação de conclusão) e divertido (comunidade compartilhada da experiência).

## MVP Scope

**In scope:**
- Integração com **Claude Code apenas** (via hooks HTTP nativos)
- Presença em tempo real (lista de usuários online com status: `working` / `idle` / `needs-input`)
- Chat global único (sem salas)
- Avatares = bolinhas coloridas com username
- CLI de instalação (`npx @clobby/cli install`) com device flow de auth
- Deploy numa única stack: Next.js full-stack em Vercel + Supabase

**Out of scope (MVP):**
- Integração com Codex ou Cursor (arquitetura preparada, implementação depois)
- Salas temáticas, mini-games, avatares pixel art
- Notificação desktop/mobile (lobby só notifica in-browser)
- Redirecionamento automático pra harness (limitação do browser — usuário volta manualmente)
- Moderação de chat, filtros, bans
- Analytics, billing, admin panel
- Mobile-first (desktop OK, responsivo básico)

## Stack Decisions

| Camada       | Escolha                           | Razão                                                               |
| ------------ | --------------------------------- | ------------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router) + React   | Stack mais comum, tooling maduro, deploy 1-clique na Vercel         |
| Styling      | Tailwind CSS v4                   | Já integrado no Next, zero config                                   |
| Backend      | Next.js API Routes                | Mesmo projeto, mesmo deploy, simplifica dev                         |
| DB           | Supabase Postgres                 | Free tier generoso, row-level security, Postgres full               |
| Auth (web)   | Supabase Auth (GitHub OAuth only) | Dev-friendly, zero password handling                                |
| Realtime     | Supabase Realtime                 | WebSocket managed, funciona com Vercel serverless                   |
| CLI          | TypeScript + commander + @clack   | Padrão npm, UX polida                                               |
| CLI distrib. | `@clobby/cli` no npm público      | Zero aprovação, `npx` funciona direto                               |
| Validation   | zod                               | Type-safe schemas compartilhados entre CLI e backend                |
| Lang         | TypeScript em tudo                | Compartilhar tipos CLI ↔ backend                                    |

## Glossary

- **Harness:** o agentic coding tool (Claude Code, Codex, Cursor). No MVP, só Claude Code.
- **Hook:** callback disparado pela harness em eventos de ciclo de vida (session start, stop, etc).
- **CLI Token:** bearer token long-lived que o CLI usa pra autenticar requisições de hook. Um por (usuário × máquina).
- **Device Code:** código curto temporário (15min) usado no device flow pra parear CLI com conta web.
- **Presence Status:** estado atual do usuário: `working` (agente rodando), `needs-input` (agente pediu input), `idle` (agente terminou ou sem sessão).
- **Session (realtime):** uma conexão ativa de um usuário ao Supabase Realtime channel do lobby.

## Entidades (Data Model)

Nomes em snake_case (padrão Postgres). Detalhes de schema estão em `02-backend.md`.

- `users` — perfil público (deriva do auth.users do Supabase)
- `cli_tokens` — tokens long-lived emitidos pro CLI
- `device_codes` — device flow em progresso (temp)
- `presence` — estado atual do usuário (tabela regular, atualizada por hooks; Realtime inscreve em `postgres_changes`)
- `chat_messages` — histórico do chat global

Todas têm `harness` como campo onde aplicável (enum `claude_code` | `codex` | `cursor`), mesmo que MVP só use `claude_code`.

## Fluxos End-to-End

### Fluxo 1: Instalação

```
[Usuário no browser]              [Terminal]                  [Backend]
     |                                |                            |
     | 1. Cria conta via GitHub       |                            |
     |-------------------------------------------------------→  auth.users
     |                                |                            |
     | 2. Vê página /install          |                            |
     |                                |                            |
     | 3. Copia: npx @clobby/cli install                           |
     |                                |                            |
     |                                | 4. Roda comando             |
     |                                | 5. CLI detecta ~/.claude    |
     |                                | 6. POST /auth/cli/start  →  gera device_code
     |                                | 7. Abre browser em          |
     |                                |    /auth/cli?code=ABC       |
     | 8. Vê "Autorizar CLI?"         |                            |
     | 9. Clica Confirm ───────────────────────────────────────→ marca code confirmed,
     |                                |                            gera cli_token
     |                                | 10. Poll retorna token ←──  
     |                                | 11. Salva em ~/.config/clobby/auth.json
     |                                | 12. Escreve hooks em        |
     |                                |     ~/.claude/settings.json |
     |                                | 13. Envia evento de teste → valida conexão
     |                                | 14. Imprime ✓ Done          |
```

### Fluxo 2: Uso (sessão Claude Code)

```
[Claude Code]                     [Backend]                  [Lobby Web]
     |                                |                            |
     | 1. Usuário roda `claude`       |                            |
     | 2. SessionStart hook fires     |                            |
     |    POST /hooks/session-start ─→ upsert presence:             |
     |    (com cli_token no header)    status='working'             |
     |                                 broadcast via Realtime  ───→ bolinha fica amarela
     |                                |                            |
     | 3. Agente executa (segundos a minutos)                       |
     |                                |                            |
     |                                |                            | Usuário no lobby:
     |                                |                            | - vê outros users
     |                                |                            | - manda msg no chat
     |                                |                            | - vê quem tá working
     |                                |                            |
     | 4. Stop hook fires             |                            |
     |    POST /hooks/stop ─────────→ upsert presence:              |
     |                                 status='idle'                |
     |                                 broadcast via Realtime  ───→ bolinha fica verde,
     |                                                              toca som, badge
     | 5. Usuário volta pro terminal  |                            |
```

### Fluxo 3: Notification (agente pede input)

Claude Code dispara hook `Notification` quando precisa de input humano no meio da execução. Backend marca status como `needs-input` → lobby renderiza em vermelho com indicador piscante → usuário sabe que precisa voltar.

## Cross-cutting Concerns

### Segurança
- `cli_token` guardado hash-only no DB (bcrypt). Cliente armazena em arquivo com `chmod 600`.
- `device_code` expira em 15min, uso único.
- Rate limit em todos endpoints de hook (100 req/min por token).
- HTTPS obrigatório, hooks só aceitam requests com `Authorization: Bearer <token>`.

### Observabilidade
- Log estruturado (Vercel logs) em cada hook recebido: `{user_id, event, harness, timestamp, latency_ms}`.
- Métricas básicas: eventos recebidos/min, usuários ativos, mensagens de chat/min. Grafana pode vir depois.

### Extensibilidade (Codex, Cursor)
- Endpoints de hook são genéricos: `/api/hooks/[event]` aceita payload padronizado com `harness` identificado pelo token.
- Cada harness tem seu módulo em `src/harnesses/` no CLI que sabe detectar instalação, escrever config, e remover.
- UI do lobby já mostra badge de harness na bolinha (vai ficar útil quando tiver mais de um).

## Spec Index

| Spec                        | Responsabilidade                                       |
| --------------------------- | ------------------------------------------------------ |
| `00-overview.md` (este)     | Arquitetura, glossário, fluxos                         |
| `01-cli.md`                 | Pacote `@clobby/cli`: comandos, detecção, auth local   |
| `02-backend.md`             | API routes, DB schema, endpoints de hook, validação    |
| `03-frontend.md`            | Lobby web: UI, presença, chat, páginas de auth/install |
| `04-auth-device-flow.md`    | Device flow completo (CLI ↔ Web ↔ Backend)             |

## Non-negotiables

Estas decisões NÃO mudam sem revisitar todas as specs:

1. **Só um chat global no MVP.** Sem salas, sem DMs.
2. **Hooks HTTP direto** do Claude Code, sem daemon local intermediário.
3. **Device flow** pra auth, nunca pedir pro usuário colar token manualmente.
4. **Supabase Realtime** como canal realtime, não rolar WebSocket caseiro.
5. **TypeScript everywhere.** Sem JS puro.
6. **Zero segredo no cliente.** CLI nunca tem service role key; só user-scoped bearer token.

## Open Questions

- [ ] Nome final do produto (usando "Clobby" como placeholder)
- [ ] Domínio final (usando `clobby.app` como placeholder)
- [ ] Onboarding: pedir username customizado ou usar GitHub handle direto? (assumindo GitHub handle por default, editável no profile)
