# Spec 04 — Auth Device Flow

> Depende de: `00-overview.md`. Referenciado por `01-cli.md`, `02-backend.md`, `03-frontend.md`.

## Purpose

Permitir que o CLI (rodando no terminal, sem browser embutido) seja pareado com uma conta web **sem o usuário colar token manualmente**. Usa o pattern OAuth 2.0 Device Authorization Grant adaptado pra nosso caso.

## Requirements (MVP)

- Usuário digita `npx @clobby/cli install` no terminal
- Um browser abre em URL do Clobby com código visível
- Usuário já logado (ou loga) e aprova o device
- CLI recebe token e continua instalação
- Tempo total em caminho feliz: < 30 segundos
- Nunca pedir pro usuário copiar/colar token

## Non-Goals (MVP)

- Flow sem browser (ex: só terminal input) — não vamos fazer
- QR code pra mobile — não vamos fazer (todos os usuários tão no desktop)
- PKCE (temos controle do backend e canal seguro, device code atomic já protege)

## Alto Nível

```
CLI                         Browser                 Backend
 |                             |                       |
 | POST /auth/cli/start ─────────────────────────────→ gera device_code
 | ← { code, verification_url, ... }                   |
 |                             |                       |
 | print "Open https://clobby.app/auth/cli?code=ABC"   |
 | + abre browser              |                       |
 |                             |                       |
 |  ---- spawn polling loop ---|                       |
 | POST /auth/cli/poll { code }───────────────────────→ ainda pending
 | ← { status: "pending" }     |                       |
 | sleep 2s                    |                       |
 |                             | GET /auth/cli?code=ABC |
 |                             | (logado, vê UI)        |
 |                             |                        |
 |                             | click "Authorize"       |
 |                             | POST /auth/cli/confirm ─→ valida, gera cli_token,
 |                             |                           grava no DB, armazena
 |                             |                           plaintext cifrado em
 |                             |                           device_codes temp
 |                             | ← { ok: true }          |
 |                             | show "✓ Authorized"     |
 |                             |                         |
 | POST /auth/cli/poll { code }────────────────────────→ confirmed, retorna token
 | ← { status: "ok", token, user_id, username }         |
 | salva em ~/.config/clobby/auth.json                  |
 | continua install...                                  |
```

## Device Code Format

- 9 caracteres, formato `XXX-XXX-XXX`
- Charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (Crockford base32 sem 0/O/1/I pra evitar confusão visual)
- Entropia: 32^9 ≈ 35 bits, aceitável pra código de vida curta com rate limit no poll

## CLI Token Format

- `clobby_live_<32 chars base62>`
- Entropia: 62^32 ≈ 190 bits
- Prefixo `clobby_live_` facilita detecção em git/logs e leaked token scanning (GitHub secret scanning partners suportam custom patterns)

## Storage: Plaintext Token Temporário

**Problema:** o token plaintext é gerado no `confirm` mas retornado no `poll` que vem depois. Precisa ser armazenado temporariamente em algum lugar entre os dois requests.

**Opções avaliadas:**

1. **Armazenar em memória (Redis):** requer Redis infra. Extra dependência.
2. **Armazenar plaintext em `device_codes.pending_token`:** simples mas ruim (plaintext no DB mesmo que por 15 min).
3. **Gerar token no `poll`, não no `confirm`:** problema — o `poll` não tem auth. Precisaria passar `user_id` via device_code, mas aí qualquer um com o code teria token.
4. ⭐ **Armazenar plaintext cifrado com chave derivada do code:** chave = `sha256(device_code + SERVER_SECRET)`. Plaintext cifrado com AES-GCM. Só quem apresenta o `code` correto no poll pode descriptografar. Code é atomic (consumed_at marca uso único). Nunca vaza do DB sozinho.

**Escolha MVP:** opção 4. Simples, sem infra extra, seguro o suficiente.

Schema adicional em `device_codes`:
```sql
alter table device_codes add column encrypted_token text; -- base64(iv || ciphertext || tag)
```

Implementação:
```ts
function encryptToken(plaintext: string, code: string): string {
  const key = sha256(code + process.env.DEVICE_CODE_ENCRYPTION_SECRET);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

function decryptToken(encrypted: string, code: string): string {
  const key = sha256(code + process.env.DEVICE_CODE_ENCRYPTION_SECRET);
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(-16);
  const ct = buf.subarray(12, -16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

## CLI Behavior

### Start

```ts
const { code, verification_url_complete, interval_seconds, expires_in } =
  await api.post("/api/auth/cli/start");

console.log(`
Opening browser to authorize this device.

If the browser doesn't open, visit:
  ${verification_url_complete}

Verification code: ${code}
`);

await open(verification_url_complete); // `open` npm package

const token = await pollForToken(code, interval_seconds, expires_in);
```

### Poll Loop

```ts
async function pollForToken(code: string, intervalSec: number, expiresInSec: number) {
  const deadline = Date.now() + expiresInSec * 1000;
  const spinner = createSpinner("Waiting for authorization...");
  
  while (Date.now() < deadline) {
    await sleep(intervalSec * 1000);
    const resp = await api.post("/api/auth/cli/poll", { code });
    
    if (resp.status === "ok") {
      spinner.succeed("Authorized");
      return resp;
    }
    if (resp.status === "pending") continue;
    
    throw new Error(`Unexpected status: ${resp.status}`);
  }
  
  spinner.fail("Authorization timed out");
  throw new Error("Device code expired. Run install again.");
}
```

Cancelamento: Ctrl+C aborta o loop limpo (nenhum estado no servidor precisa limpar; code expira sozinho).

## Backend Endpoints (resumo, detalhes em 02-backend.md)

### `POST /api/auth/cli/start`
- Sem auth
- Gera `code`, `expires_at = now() + 15min`
- Grava row em `device_codes`
- Retorna `{ code, verification_url, verification_url_complete, poll_url, interval_seconds: 2, expires_in: 900 }`

### `POST /api/auth/cli/confirm`
- Auth: web session
- Body: `{ code }`
- Validações:
  - Code existe
  - `expires_at > now()`
  - `confirmed_at is null`
- Ações atomicamente (transação):
  1. Gera plaintext `clobby_live_xxx`
  2. Insert em `cli_tokens` com hash, retorna `token_id`
  3. Update em `device_codes`: `confirmed_at=now(), user_id=session.user.id, cli_token_id=token_id, encrypted_token=encrypt(plaintext, code)`
- Retorna `{ ok: true }`

### `POST /api/auth/cli/poll`
- Sem auth
- Body: `{ code }`
- Respostas:
  - Code inexistente ou expirado (> 15min): 404
  - `confirmed_at is null`: `{ status: "pending" }` (200)
  - `confirmed_at set, consumed_at null`: decifra `encrypted_token` usando code, marca `consumed_at=now()`, **apaga `encrypted_token`**, retorna `{ status: "ok", token, user_id, username, api_url }`
  - `consumed_at set`: 410 Gone, `{ error: "Code already used" }`

## Rate Limiting

Crítico neste fluxo:

- `/start`: 10/min por IP (prevent code generation spam)
- `/poll`: 60/min por IP + 30/min por `code` (protege contra bruteforce do code)
- `/confirm`: 20/min por user_id (protege contra accidental double-click)

## Security Model

### Ameaças consideradas e mitigações

| Ameaça                                           | Mitigação                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Atacante observa URL `?code=XXX` em over-shoulder | Code expira em 15min, uso único, não dá pra reutilizar                     |
| Atacante adivinha code por bruteforce            | Rate limit 30/min por code, 35 bits de entropia → tempo médio pra achar ~2 anos |
| DB dump vaza `encrypted_token`                   | Cifrado com chave derivada do code, code não está no dump                   |
| MITM no canal entre CLI ↔ Backend                | HTTPS obrigatório                                                           |
| Atacante engana usuário a autorizar code dele    | User vê o code claramente e compara com terminal. Educação + UI clara.      |
| Token vaza em log/git                            | Prefixo `clobby_live_` detectável; provedor pode revogar bulk se precisar   |
| Replay de `/confirm` com mesmo code              | `confirmed_at is null` é condição; duplo submit retorna erro                |

### Ameaça NÃO mitigada no MVP

- **Phishing dedicado:** site fake que mostra code real e pede user pra autorizar na interface real do Clobby em outra aba. Mitigação futura: mostrar origin do device (IP, user-agent) na tela de confirm pra user reconhecer.

## Token Revocation

- `POST /api/cli-tokens/:id/revoke` (web session): marca `revoked_at=now()`. Próxima request do CLI recebe 401.
- `clobby logout` local só apaga `auth.json`, mas **não revoga** no server (pode querer reconectar na mesma conta sem re-login). Mencionar isso no output.

## Error Cases & UX

| Situação                                | CLI output                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Browser não abre (SSH, remote)          | Fallback: "Copy this URL into your browser: ..." + continua polling           |
| Rede falha no poll                      | Retry com backoff exponencial até 3x, depois erro                             |
| Code expira sem confirmar               | "Authorization timed out. Run `clobby install` again."                        |
| Usuário cancela no browser              | Poll continua até timeout (15min) — subótimo mas aceitável no MVP             |
| Poll retorna 410 (code já usado)        | "This code was already used. Run install again."                              |

**Melhoria futura (não MVP):** endpoint `POST /api/auth/cli/cancel` que usuário chama ao clicar "Cancel" no browser, marca code como invalidado → CLI poll retorna erro imediatamente.

## Environment Variables

```
DEVICE_CODE_ENCRYPTION_SECRET=<random 32 bytes base64>
```

**Rotação:** se rotacionar, todos os device codes pendentes quebram. Aceitável (15min de impacto).

## Testing

Crítico testar:

- [ ] Happy path: CLI start → confirm na web → poll retorna token → usa token em `/api/me` com sucesso
- [ ] Code expirado é rejeitado no confirm
- [ ] Code usado 2x no poll: segundo retorna 410
- [ ] Decryption falha se algum byte do code for alterado (integridade)
- [ ] Rate limit dispara nos thresholds configurados
- [ ] Browser não abre → fluxo continua via URL manual

## Acceptance Criteria

- [ ] Caminho feliz end-to-end: `npx @clobby/cli install` → browser → autorizar → retorna pro terminal com token salvo. Tempo < 30s.
- [ ] Nenhum dump de DB contém token plaintext fora do período `confirmed_at → consumed_at`
- [ ] Code não reutilizável após `consumed_at`
- [ ] User com 2FA no GitHub flui sem atritos extras (login é só GitHub OAuth)
- [ ] SSH/headless: CLI aceita usuário copiar URL manualmente quando `open` falha

## Open Questions

- [ ] Armazenar `ip` e `user_agent` no `device_codes` pra mostrar na tela de confirm? (recomendação: sim, ajuda user a reconhecer device)
- [ ] Adicionar opção `clobby install --token=<token>` pra CI / ambientes headless? (recomendação: adicionar em v0.2, não MVP)
