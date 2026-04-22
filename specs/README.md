# Clobby — Specs

Specs de desenvolvimento orientado por spec (SDD) do Clobby.

**Pra construir, abra [BUILD-ORDER.md](./BUILD-ORDER.md).** É o guia linear com comandos e checkpoints. As specs abaixo são a fonte de verdade; o BUILD-ORDER é o roteiro.

Ordem de **leitura** das specs:

1. **[00-overview.md](./00-overview.md)** — Arquitetura, decisões de stack, glossário, fluxos end-to-end. **Leia primeiro.**
2. **[01-cli.md](./01-cli.md)** — Pacote `@clobby/cli` (instalação, hooks, auth local)
3. **[02-backend.md](./02-backend.md)** — API, DB schema, endpoints de hook, Realtime
4. **[03-frontend.md](./03-frontend.md)** — Lobby web (presença, chat, páginas)
5. **[04-auth-device-flow.md](./04-auth-device-flow.md)** — Device flow detalhado (atravessa CLI + Web + Backend)
6. **[BUILD-ORDER.md](./BUILD-ORDER.md)** — Guia de construção linear em 8 fatias com checkpoints de teste

## Como usar estas specs

**Com agentic coding (Claude Code, Codex, Cursor):** aponte o agente pra essas specs antes de cada task. Exemplo de prompt:

```
Leia specs/00-overview.md e specs/01-cli.md. Implemente o comando 
`install` do CLI conforme spec, incluindo testes. Siga os critérios 
de aceitação. Se alguma decisão não está clara, liste perguntas antes 
de codar.
```

**Quando algo muda:** atualize a spec **antes** do código. Specs são fonte de verdade. Commit da spec vira issue/PR pra implementar.

## Princípios

- **MVP funcional, arquitetura escalável.** Cada simplificação do MVP foi escolhida pra não travar refinamento depois.
- **Non-goals explícitos.** Cada spec lista o que NÃO faz pra evitar scope creep.
- **Acceptance criteria checkáveis.** Teste binário por item.
- **Open questions em aberto.** O que ainda precisa decidir está marcado com `[ ]` no fim de cada spec.

## Ordem sugerida de implementação

1. Setup do repo (monorepo com pnpm workspaces: `apps/web`, `packages/cli`, `packages/schemas`)
2. Supabase project: aplicar migrations (spec 02)
3. Backend: endpoints de auth device flow + hooks (specs 02, 04)
4. CLI: detecção + device flow + install (specs 01, 04)
5. Frontend: login + /install + /auth/cli (spec 03)
6. Frontend: /lobby com presença e chat (spec 03)
7. End-to-end: rodar Claude Code de verdade e ver bolinha atualizar

Cada passo vira um marco. Não pular ordem — o lobby sem hooks funcionando é teatro.

## Placeholders

Trocar antes de publicar:
- Nome "Clobby" → nome final
- `clobby.app` → domínio real
- `@clobby/cli` → scope npm real

## Status

- [ ] Specs escritas
- [ ] Setup inicial do repo
- [ ] Backend API routes
- [ ] Supabase schema aplicado
- [ ] CLI publicado no npm (privado pra testes)
- [ ] Frontend deployed em staging
- [ ] End-to-end validado com Claude Code real
- [ ] Launch público
