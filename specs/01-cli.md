# Spec 01 — CLI (`@clobby/cli`)

> Depende de: `00-overview.md`, `04-auth-device-flow.md`

## Purpose

Pacote npm único que o usuário roda com `npx @clobby/cli <command>`. Responsabilidades:

1. Detectar quais harnesses estão instaladas na máquina
2. Autenticar a máquina com a conta do usuário via device flow
3. Escrever configs de hook nos arquivos da harness (merge seguro, não destrutivo)
4. Permitir desinstalar/inspecionar/re-autenticar

## In Scope (MVP)

- Comandos: `install`, `uninstall`, `status`, `login`, `logout`
- Suporte a Claude Code apenas
- Plataformas: macOS, Linux, Windows (WSL recomendado mas deve funcionar nativo)
- Distribuição: npm público como `@clobby/cli`

## Out of Scope (MVP)

- Auto-update (npx sempre pega latest)
- Configuração de múltiplas contas na mesma máquina (só uma)
- Modo não-interativo (`--yes` pra CI) — adicionar depois
- Detecção de Codex/Cursor (módulo já existe mas retorna "not supported" com link pra roadmap)

## Package Metadata

```json
{
  "name": "@clobby/cli",
  "version": "0.1.0",
  "description": "Connect your agentic coding tools to the Clobby lobby.",
  "bin": { "clobby": "./dist/index.js" },
  "type": "module",
  "engines": { "node": ">=18" },
  "files": ["dist/"],
  "keywords": ["claude-code", "codex", "cursor", "lobby"],
  "license": "MIT"
}
```

Invocação esperada:
- `npx @clobby/cli install` (primeira vez, sem instalação global)
- Após `npm i -g @clobby/cli`, disponível como `clobby install`

## Directory Structure

```
packages/cli/
├── src/
│   ├── index.ts              # entry, CLI setup com commander
│   ├── commands/
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   ├── status.ts
│   │   ├── login.ts
│   │   └── logout.ts
│   ├── harnesses/
│   │   ├── types.ts          # interface Harness
│   │   ├── claude-code.ts    # impl Claude Code
│   │   └── registry.ts       # lista de harnesses suportadas
│   ├── auth/
│   │   ├── device-flow.ts    # startFlow(), pollForToken()
│   │   └── storage.ts        # read/write ~/.config/clobby/auth.json
│   ├── api/
│   │   └── client.ts         # wrapper fetch com Authorization header
│   ├── utils/
│   │   ├── json-merge.ts     # deep merge preservando hooks existentes
│   │   ├── paths.ts          # resolve ~/.config/clobby/, ~/.claude/, etc
│   │   └── logger.ts         # prefixos coloridos, spinners
│   └── config.ts             # API_URL, APP_URL constants (env overridable)
├── tests/
│   ├── json-merge.test.ts
│   └── harnesses/claude-code.test.ts
├── package.json
└── tsconfig.json
```

## Commands

### `clobby install`

Fluxo:

1. **Detect harnesses.** Itera `harnesses/registry.ts`. Para cada uma: `harness.detect()` retorna `{ installed: boolean, configPath: string }`. Imprime lista:
   ```
   ✓ Claude Code detected (~/.claude/settings.json)
   ✗ Codex CLI not detected (support coming soon)
   ✗ Cursor not detected (support coming soon)
   ```
2. **Check auth.** Se não há token em `~/.config/clobby/auth.json`, inicia device flow (ver `04-auth-device-flow.md`). Se já há token, valida com `GET /api/me`. Se inválido, força re-login.
3. **Confirm prompt.** "Install hooks in Claude Code? (Y/n)" usando `@clack/prompts`.
4. **Write hooks.** Chama `harness.installHooks({ token, apiUrl })`. Faz merge no `settings.json` preservando hooks existentes. Backup antes em `settings.json.clobby-backup.<timestamp>`.
5. **Test.** POST `/api/hooks/test` com token. Espera 200. Se falhar, rollback do backup e mostra erro.
6. **Success.**
   ```
   ✓ Hooks installed for Claude Code
   ✓ Connection verified
   
   You're in! Open https://clobby.app to see the lobby.
   Run `clobby status` anytime to check your setup.
   ```

### `clobby uninstall`

1. Lista harnesses onde Clobby hooks estão instalados
2. Confirma remoção
3. Para cada uma: `harness.removeHooks()` — remove apenas as entradas cujo `url` aponta pro API URL do Clobby. Preserva o resto.
4. Opcionalmente revoga o token server-side (`DELETE /api/cli-tokens/current`)
5. Remove `~/.config/clobby/auth.json` se usuário confirmar

### `clobby status`

Output:
```
Clobby CLI v0.1.0

Account
  logged in as @yourhandle

Harnesses
  ✓ Claude Code — hooks installed (3 events)
  ✗ Codex CLI — not supported yet
  ✗ Cursor — not supported yet

Last event sent
  SessionStart at 2026-04-22T18:30:12Z (ok)
```

Não faz escrita em disco. Só leitura.

### `clobby login`

Força device flow de novo (útil se trocou de conta). Substitui token atual.

### `clobby logout`

Remove `~/.config/clobby/auth.json`. Não remove hooks (o usuário pode querer reconectar). Avisa que hooks vão falhar até novo login.

## Harness Interface

```ts
// src/harnesses/types.ts
export interface Harness {
  id: "claude_code" | "codex" | "cursor";
  displayName: string;

  detect(): Promise<DetectResult>;
  isInstalled(): Promise<boolean>;
  installHooks(params: InstallParams): Promise<InstallResult>;
  removeHooks(): Promise<RemoveResult>;
  listInstalledHooks(): Promise<InstalledHook[]>;
}

export interface DetectResult {
  installed: boolean;
  configPath: string | null;
  version?: string;
}

export interface InstallParams {
  token: string;      // bearer token pro Authorization header
  apiUrl: string;     // base URL, ex https://clobby.app
}

export interface InstallResult {
  eventsInstalled: string[];   // ["SessionStart", "Stop", "Notification"]
  backupPath: string;
}
```

## Claude Code Implementation

**Config path:** `~/.claude/settings.json` (global). MVP não toca em project-level `.claude/settings.json`.

**Detecção:** verifica existência do diretório `~/.claude/`. Se existe mas `settings.json` não, cria vazio.

**Hooks instalados (3 eventos):**

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "http",
        "url": "https://clobby.app/api/hooks/session-start",
        "headers": { "Authorization": "Bearer <TOKEN>" }
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "http",
        "url": "https://clobby.app/api/hooks/stop",
        "headers": { "Authorization": "Bearer <TOKEN>" }
      }]
    }],
    "Notification": [{
      "hooks": [{
        "type": "http",
        "url": "https://clobby.app/api/hooks/notification",
        "headers": { "Authorization": "Bearer <TOKEN>" }
      }]
    }]
  }
}
```

**Merge rule:** se `settings.json.hooks[EventName]` já existe e contém outros hooks, **appendar** nosso matcher group ao array existente. **Nunca** sobrescrever. Identificar nossos hooks pelo prefixo da URL (`https://clobby.app/api/hooks/`).

**Remove rule:** remover apenas matcher groups cujo inner `hooks[].url` começa com nosso API URL. Se o array ficar vazio, remover o evento. Se `hooks` ficar vazio, remover a chave `hooks` inteira.

## Auth Storage

Arquivo: `~/.config/clobby/auth.json` (ou `%APPDATA%\clobby\auth.json` no Windows).

```json
{
  "version": 1,
  "apiUrl": "https://clobby.app",
  "token": "clobby_live_xxxxxxxxxxxx",
  "userId": "uuid",
  "username": "yourhandle",
  "createdAt": "2026-04-22T18:00:00Z"
}
```

Permissões: `0600` (user read/write only). Em Windows, melhor esforço com ACL.

## Environment Overrides

Úteis pra dev local:
- `CLOBBY_API_URL` — override do endpoint (default `https://clobby.app`)
- `CLOBBY_APP_URL` — override da URL web (default `https://clobby.app`)
- `CLOBBY_CONFIG_DIR` — override do diretório de config

## Error Handling

Exit codes:
- `0` — sucesso
- `1` — erro genérico
- `2` — não autenticado
- `3` — harness detectada mas config inválida/corrompida (instrui rodar backup manual)
- `4` — erro de rede

Mensagens sempre humanas, nunca stack trace cru. Em modo `--verbose`, imprime debug.

## Testing

Nível MVP mínimo:

- **Unit:** `json-merge.ts` (crítico, regressão = perder hooks do usuário), `claude-code.installHooks` com fixtures de `settings.json` em vários estados (vazio / já com hooks / corrompido).
- **Integration:** CLI roda contra backend mockado (MSW ou simples server local), verifica device flow end-to-end.
- **Não testar:** UI do CLI (prompts), detalhes visuais. Custos de teste não compensam.

## Acceptance Criteria

- [ ] `npx @clobby/cli install` funciona em máquina limpa com Claude Code instalado
- [ ] Merge não destrói hooks pré-existentes do usuário (teste com fixture que tenha outros hooks de outras ferramentas, tipo GitButler)
- [ ] `uninstall` remove apenas hooks do Clobby, preserva outros
- [ ] Device flow completa em <30s em caminho feliz
- [ ] Backup do `settings.json` existe após install e pode ser restaurado manualmente
- [ ] Token é salvo com permissão 0600 em Unix
- [ ] Funciona em Node 18, 20, 22
- [ ] Pacote publicado tem <500KB (sem devDeps no tarball)

## Open Questions

- [ ] Usar `@clack/prompts` ou `inquirer`? (recomendação: @clack, mais moderno)
- [ ] Compilar pra ESM ou CJS? (recomendação: ESM com `type: module`, compatível com Node 18+)
- [ ] Bundler pro dist: `tsup` ou `tsc` puro? (recomendação: `tsup` pra single file bundle)
