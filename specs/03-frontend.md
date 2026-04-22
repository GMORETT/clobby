# Spec 03 — Frontend (Lobby Web)

> Depende de: `00-overview.md`, `02-backend.md`

## Purpose

Interface web do Clobby. Responsabilidades:

1. Landing + página de instalação com CLI command destacado
2. Login via GitHub OAuth (Supabase Auth)
3. Página de confirmação do device flow (authorize CLI)
4. Lobby em tempo real: bolinhas coloridas = usuários online, chat global ao lado
5. Página "status" pessoal (onde estou, quais hooks, quando foi último evento)

## In Scope (MVP)

- Desktop-first, responsivo básico (funciona em mobile mas não otimizado)
- Dark mode por default (devs gostam)
- Tailwind CSS v4
- Zero libs de UI component pesadas (nada de MUI/Chakra). Usar **shadcn/ui** só onde trivializa (Button, Input, Dialog).
- Som curto quando meu status vai pra `idle` após `working` (opcional, mutable)

## Out of Scope (MVP)

- Drag-and-drop de bolinhas, posicionamento livre (fixo em grid)
- Animações elaboradas (keyframes simples bastam)
- Rich text no chat (só text puro + quebra de linha)
- Emojis picker (usuário pode digitar)
- Mentions (@user), threads, reactions
- Notificações push/desktop
- Profile editing (só username auto do GitHub)

## Pages

### `/` — Landing

Uma página. Hero + CTA pro install. Copy sugerido:

> **Clobby**
> The lobby for people waiting on agents.
>
> While Claude Code thinks, hang out with other devs doing the same.
>
> [Get started] → /login

Tem um preview/screenshot do lobby e link discreto pra GitHub repo.

### `/login`

Botão "Continue with GitHub". Supabase Auth UI ou custom button chamando `supabase.auth.signInWithOAuth({ provider: 'github' })`.

Redirect pós-login: se query `?next=/auth/cli?code=XXX`, vai pra lá. Senão, vai pra `/install` (primeira vez) ou `/lobby`.

### `/install`

Aparece depois do primeiro login. Instruções:

```
1. Run this command in your terminal:
   
   ┌──────────────────────────────────────────────────────┐
   │  $ npx @clobby/cli install                    [copy] │
   └──────────────────────────────────────────────────────┘

2. A browser will open to authorize the CLI.

3. You're in!
```

Botão "I've installed, take me to the lobby" → `/lobby`.

Se o backend detecta (via query `/api/me?with_cli_tokens=count`) que o usuário já tem um cli_token ativo, a página muda o copy pra "You have 1 device connected. Install on another machine?".

### `/auth/cli?code=ABC-DEF-GHI`

Página do device flow. Fluxo:

1. Se não logado, redireciona `/login?next=/auth/cli?code=ABC-DEF-GHI`.
2. Se logado, mostra:
   ```
   Authorize CLI access?
   
   A device is requesting access with code:
   
      ABC-DEF-GHI
   
   Only approve if this matches the code shown in your terminal.
   
   [Cancel]  [Authorize]
   ```
3. "Authorize" chama `POST /api/auth/cli/confirm` com `{ code }`.
4. Sucesso → tela "✓ Authorized! Return to your terminal." com auto-close opcional após 3s.
5. Erro (code expirado, já usado etc) → mensagem clara.

### `/lobby`

Coração do produto. Layout:

```
┌────────────────────────────────────────────────────────┐
│  Clobby                              @yourname  ⚙      │
├──────────────────────────────────────┬─────────────────┤
│                                      │  # global chat  │
│      ⬤ alice  (working)              │                 │
│      ⬤ bob    (needs input!)         │  alice: lol my  │
│      ⬤ carol  (idle)                 │    tests failed │
│      ⬤ you    (idle)                 │                 │
│                                      │  bob: same      │
│                                      │                 │
│      4 devs online                   │                 │
│                                      ├─────────────────┤
│                                      │ [type here...]  │
└──────────────────────────────────────┴─────────────────┘
```

**Bolinhas (presence panel):**
- Grid responsivo (CSS grid auto-fit). Cada bolinha: div circular 64px, cor do usuário (`avatar_color`), username abaixo.
- Status por cor da borda ou dot indicator:
  - `working`: borda pulsante amarela (animate-pulse)
  - `needs_input`: borda vermelha + dot indicator piscando
  - `idle`: borda verde, sem animação
- Hover mostra tooltip com `harness` + `há X minutos`.
- Ordenação: `needs_input` primeiro, depois `working`, depois `idle`. Dentro de cada, mais recente primeiro.

**Chat panel:**
- Lista scrollável ordem crescente (novas no rodapé, auto-scroll se já estava no final).
- Cada msg: bolinha pequena 24px (mesma cor) + username bold + conteúdo.
- Input no rodapé. Enter envia, Shift+Enter quebra linha. Max 500 chars com contador quando passa de 450.
- Carrega últimas 50 no mount. Scroll top dispara "load older" (paginação simples).

**Header:**
- Logo Clobby (placeholder text)
- Username do usuário atual com dropdown → Status, Logout
- Ícone de settings → dialog simples com toggle de som

### `/status` (opcional MVP, pode ficar como dialog dentro do /lobby)

Mostra equivalente ao `clobby status` do CLI, do lado web:
- Connected devices (cli_tokens com label, last_used_at, [revoke])
- Last events received (últimos 10 eventos de hook)
- Current presence state

## State Management

MVP não precisa de Redux/Zustand. Usar:

- **TanStack Query (React Query)** pra fetching REST (`/api/me`, `/api/chat/messages` initial load, `/api/presence` initial load)
- **Supabase Realtime hook** (`useRealtimeChannel`) para subscriptions
- **useState/useReducer** local pra UI state (dialogs, input de chat)

Setup do Realtime em `lib/realtime.ts`:

```ts
export function useLobbyPresence() {
  const [presence, setPresence] = useState<PresenceRow[]>([]);

  useEffect(() => {
    const supabase = createBrowserClient();
    
    // initial fetch
    fetch("/api/presence").then(r => r.json()).then(setPresence);
    
    // subscribe
    const channel = supabase
      .channel("lobby-presence")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        (payload) => {
          // merge into local state
          setPresence(prev => applyPresenceChange(prev, payload));
        }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  return presence;
}
```

Análogo pra `useLobbyChat()`.

## Avatares (bolinhas)

**MVP:** bolinha circular com cor `avatar_color`. Cor atribuída aleatoriamente no signup, de uma paleta curada de ~12 cores distinguíveis em dark mode.

```ts
const AVATAR_PALETTE = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6",
  "#f97316", "#84cc16", "#06b6d4", "#a855f7",
];
```

Iniciais do username em branco centralizadas dentro da bolinha (ex: "AL" pra alice).

Arquitetura já pronta pra trocar por pixel art depois: componente `<Avatar user={user} status={status} size={64} />` encapsula a lógica, trocar internals não quebra call sites.

## Som de notificação

Single file `/public/sounds/idle.mp3` (~200ms, tipo um pop suave). Toca apenas quando:
- Meu próprio status muda de `working`/`needs_input` → `idle`
- Volume baixo, mutable via setting armazenado em `localStorage`

## Error States

- Desconectado do Realtime: banner amarelo no topo "Reconnecting..." com retry auto (Supabase client já tem retry built-in)
- 401 em qualquer fetch: logout automático e redirect `/login`
- 500 ou timeout: toast simples "Something went wrong", não quebrar a UI

## Directory Structure (frontend parts)

```
app/
├── layout.tsx
├── page.tsx                    # landing
├── (auth)/
│   ├── login/page.tsx
│   └── auth/cli/page.tsx
├── install/page.tsx
├── lobby/
│   ├── page.tsx
│   ├── _components/
│   │   ├── PresenceGrid.tsx
│   │   ├── AvatarBubble.tsx
│   │   ├── Chat.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatInput.tsx
│   │   └── LobbyHeader.tsx
│   └── _hooks/
│       ├── useLobbyPresence.ts
│       └── useLobbyChat.ts
└── status/page.tsx

components/
├── ui/                         # shadcn primitives
│   ├── button.tsx
│   ├── dialog.tsx
│   └── input.tsx
└── CopyableCommand.tsx         # usado em /install

lib/
├── realtime.ts
└── avatar.ts                   # palette, initials
```

## Accessibility

MVP básico mas não negligenciar:
- Todos os botões com aria-label onde texto não é óbvio
- Foco visível em inputs/botões (Tailwind `focus-visible:ring`)
- Chat messages com role="log" aria-live="polite"
- Contraste WCAG AA no dark mode

## Performance Budget

- LCP < 2s em cold load
- Bundle JS total < 250KB gzipped pra `/lobby`
- Sem imagem grande no MVP (bolinhas são SVG/CSS)
- Supabase client é ~30KB; shadcn primitives são tree-shakable

## Acceptance Criteria

- [ ] Login via GitHub funciona e cria row em `public.users` com username correto
- [ ] `/install` mostra comando copy-to-clipboard
- [ ] `/auth/cli?code=XXX` valida código, requer login, chama confirm
- [ ] `/lobby` renderiza presença em tempo real (teste: abrir 2 abas, Claude Code em uma, ver bolinha mudar na outra)
- [ ] Chat entrega mensagem em ambas as abas em <1s
- [ ] Status `needs_input` visualmente óbvio (vermelho + pulsando)
- [ ] Som toca quando meu status vira `idle` (com toggle pra mute)
- [ ] Dark mode é default, sem flash de white
- [ ] Desconexão Realtime mostra banner e reconecta sozinha

## Open Questions

- [ ] Usar shadcn/ui desde início ou adicionar só quando precisar? (recomendação: adicionar só quando precisar, começar zero)
- [ ] Paleta de cores pra avatar escolhida pelo user ou random? (recomendação: random no signup, trocável no profile depois)
- [ ] `/status` é página ou dialog? (recomendação: dialog no header do `/lobby`, reduz surface area)
