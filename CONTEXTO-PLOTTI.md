# Plotti — Relatório de Contexto

**Última atualização:** 20 maio 2026 · 00h30 BRT
**Gerado por:** Claude Code (sessão `01BaUPfKWweniogu4ZfNNZcG`)
**Repo:** `caiomoreiraadv-oss/caiomoreiraadv-oss.github.io`
**Site live:** https://caiomoreiraadv-oss.github.io/
**Branch ativa:** `claude/fix-login-errors-vkyAW`

> **Limitação importante deste relatório:** O autor (Claude) só tem acesso à sessão atual. Sessões anteriores do Claude Code (PRs #1, #2, #3 — ~17–19 maio) foram reconstruídas pelo Git/CHANGELOG, não pelos diálogos. Os comentários abaixo refletem o que pôde ser inferido a partir do código + mensagens de commit + entradas no CHANGELOG.

---

## 1. Visão geral do projeto

**Plotti** (antes "PT-2026") é um PWA estático para gerenciar viagens em grupo. Hospedado em GitHub Pages (`caiomoreiraadv-oss.github.io`). Originalmente feito para a viagem **Portugal · 22–29 maio 2026** de 4 pessoas (Caio, Amanda, Bruna, Lucas), depois generalizado em v6.5+.

### Arquitetura
- **3 arquivos principais:**
  - `index.html` (177 KB, ~3.800 linhas) — UI, estado, telas, monólito
  - `cloud.js` (140 KB) — camada Firebase, login, sync, integrações nativas
  - `extras.js` (63 KB) — quizzes, Caixinha (despesas), Conversa, etc.
- **Service Worker** (`sw.js`) — network-first para HTML/JS, cache-first para imagens
- **Manifest** (`manifest.webmanifest`) — PWA instalável
- **Página de instalação** (`install.html`) — assistente para "Adicionar à Tela de Início"

### Stack
- Vanilla JS (sem framework), HTML/CSS
- Firebase v10.12.2 (auth + RTDB) — opcional, modo "nativo" funciona sem
- Google Identity Services (GIS) — adicionado nesta sessão
- Tesseract.js + pdf.js — OCR sob demanda
- Gemini API — assistente "Saiba mais" opcional

### Modelo de identidade
- 4 "slots" hardcoded no código (`SLOTS=['caio','amanda','bruna','lucas']`) — apesar do app ter sido "generalizado" em v6.5+, os slots persistem porque despesas/missões/quiz são indexadas por eles
- Identidade via Firebase Auth (Google ou anônimo) → UID mapeado ao slot via `assignSlot`
- Database rules: `"auth != null"` em `trips/`

---

## 2. Histórico do projeto (versões 5.5 → 7.5)

### Antes desta sessão (versões 5.5 → 6.8)

| Versão | Data | Resumo |
|---|---|---|
| v5.5 | 19/05 | Brand book Plotti aplicado (paleta, tipografia, formas) |
| v5.8 | 19/05 | Login Google trocado para `signInWithRedirect` (popup quebrava) |
| v5.9 | 19/05 | Acessibilidade AA, alvos de toque, botão Atualizar global, admin "Zerar viagem" |
| v6.0 | 19/05 | Blindagem offline (aviso de rede, câmbio com data) |
| v6.1 | 19/05 | Tela Hoje "ciente do tempo" — selos "em X min" / "Agora" |
| v6.2 | 19/05 | Caixinha: marcar acertos como pagos (botão "Marcar como pago") |
| v6.3 | 19/05 | Lembretes do roteiro via `VALARM` no .ics (alarme 30 min/3 h antes) |
| v6.4 | 19/05 | Fix: link puro não trava mais exigindo Firebase |
| v6.5 | 19/05 | App em branco (genérico) — conteúdo de Portugal removido do código (preservado no Git) |
| v6.6 | 19/05 | Assistente de instalação `install.html` (detecta navegador, mostra passo certo) |
| v6.7 | 19/05 | Welcome zerado + sempre login Google (revertendo fallback nativo) |
| v6.8 | 19/05 | SW bumpado (network-first p/ HTML+JS) — fim do "cache preso" |

**Decisão de design crítica em v5.8:** login Google sempre via `signInWithRedirect` porque popup quebrava em GitHub Pages. Esse trecho foi revertido depois para popup em v6.x (ver causa abaixo), causando o problema desta sessão.

### Esta sessão (versões 6.9 → 7.5 · 19–20 maio 2026)

**PRs criados nesta sessão (todos mergeados em `main`):**

| PR | Versão | Título |
|---|---|---|
| [#4](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/4) | v6.9–v7.0 | iOS sempre redirect + cola link de convite no PWA |
| [#5](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/5) | v7.1 | Overlay "Finalizando login..." + diagnóstico no console |
| [#6](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/6) | v7.2 | GIS inline no iOS (sem popup, sem redirect) |
| [#7](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/7) | v7.3 | Login anônimo por slot — destrava iOS sem Cloud Console |
| [#8](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/8) | v7.4 | Reset estado dos botões do welcome ao re-render |
| [#9](https://github.com/caiomoreiraadv-oss/caiomoreiraadv-oss.github.io/pull/9) | v7.5 | Expor código técnico do Firebase no erro anônimo (diagnóstico em tela) |

---

## 3. A Crise do Login — narrativa cronológica desta sessão

### Sintoma inicial reportado pelo usuário
> "Ele está com VARIOS erros de login. Verifique."

Posteriormente esclarecido como: **"Botão 'Entrar com Google' não faz nada / popup bloqueado"** (Safari iOS), e em segundo momento: **"Após adicionar à tela inicial, app diz que ainda não foi configurado"** (PWA iOS).

### Tentativa 1 — Pré-aquecer Firebase + fallback popup→redirect (PR #4, v6.9)

**Hipótese:** `signInWithPopup` é chamado APÓS os `import()` dinâmicos do Firebase (500ms-2s). Tempo suficiente do navegador esquecer o gesto do clique → popup bloqueado silenciosamente.

**Implementado:**
- `prewarmFirebase()` no boot quando há `fbCfg`
- `shouldUseRedirect()` → `true` em PWA iOS (detecta `display-mode: standalone`)
- Fallback automático popup → redirect em `auth/popup-blocked`
- `friendlyAuthErr()` mapeia códigos Firebase para mensagens PT-BR
- `bindAuthState` resiliente (roda mesmo se `getRedirectResult` lançar)
- Removido `prompt:'select_account'`
- Adicionado campo "colar link de convite" no welcome PWA (iOS isola `localStorage` entre Safari e PWA)

**Resultado:** Funcionou em desktop, mas no **Safari iOS continuou preso em "Abrindo Google…"**. Causa: popup em Safari iOS abre como nova aba e o `signInWithPopup` nunca resolve (iframe handler bloqueado pelo ITP).

### Tentativa 2 — Forçar redirect para TODO iOS (PR #4 continuação, v7.0)

**Implementado:** `shouldUseRedirect()` retorna `true` para iOS inteiro (Safari + PWA), não só PWA standalone.

**Resultado:** Redirect saiu (página foi pra `firebaseapp.com/__/auth/handler`), mas usuário voltou ao app **não logado** ("?" no avatar, modo guest). `getRedirectResult` retornava `null`. Causa: ITP do Safari bloqueia storage cross-origin entre `firebaseapp.com` e `github.io`.

### Tentativa 3 — Overlay "Finalizando login…" + diagnóstico (PR #5, v7.1)

**Hipótese:** entre o retorno do redirect e o auth state se acertar, o welcome reaparece e parece que falhou.

**Implementado:**
- Flag `pt2026:fb:authpending` em `sessionStorage` antes do redirect
- Overlay full-screen "Finalizando login…" com dots animados no boot quando o flag existe
- Timeout de 9s com alerta explicativo
- `console.log` em cada etapa (`checkRedirect`, `googleSignIn`, `getRedirectResult`, `onAuthStateChanged`, `assignSlot`)

**Resultado:** Usuário reportou **"Exatamente o mesmo erro. Não mudou nada."**. O overlay aparecia mas o auth state nunca chegava — confirmando que o problema é estrutural (ITP), não de UX.

### Tentativa 4 — Google Identity Services (GIS) com `signInWithCredential` (PR #6, v7.2)

**Diagnóstico:** Tanto `signInWithPopup` quanto `signInWithRedirect` quebram em iOS Safari por causa do ITP cross-origin. Solução canônica do Firebase: usar GIS (`accounts.google.com/gsi/client`) que roda **same-origin**, sem popup nem redirect.

**Implementado:**
- Carga sob demanda de `https://accounts.google.com/gsi/client`
- Em iOS, `googleSignIn()` força GIS (rejeita com `NO_GIS_CLIENT_ID` se não configurado)
- Campo "Web Client ID" em **Mais → Nuvem & Login** com instruções
- Client ID embutido no `buildInvite()` (todos os viajantes recebem via link)
- One Tap UI + fallback `renderButton`
- `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` para integrar com Firebase Auth

**Resultado parcial:** Usuário pegou o Client ID no Firebase Console, colou. Login GIS disparou → **erro 400 `origin_mismatch` do Google**. Causa: o OAuth Client do projeto não tem `caiomoreiraadv-oss.github.io` registrado em "Authorized JavaScript origins" no Google Cloud Console.

**Bloqueio:** Esse passo (adicionar origem JS no OAuth client) requer acesso do usuário ao Google Cloud Console. Claude não consegue fazer isso (não tem browser nem credenciais do usuário).

### Tentativa 5 — Login anônimo por slot (PR #7, v7.3)

**Decisão:** Eliminar a dependência do OAuth/Google Cloud Console. Usar Firebase **Anonymous Authentication** — cada viajante toca "Sou Caio/Amanda/Bruna/Lucas", entra direto.

**Implementado:**
- Função `anonSignIn(slot)` que chama `fb.a.signInAnonymously(fb.auth)`
- `ME_KEY` setado ANTES do `signInAnonymously` (evita race com `onAuthStateChanged`)
- Welcome com separador "OU DIRETO" e grid 2×2 com botões `Sou Caio`, `Sou Amanda`, `Sou Bruna`, `Sou Lucas`
- `friendlyAuthErr` trata `admin-restricted-operation` / `operation-not-allowed` (= anônimo desabilitado)
- `RTDB rules "auth != null"` continuam OK (anônimo é auth)

**Pré-requisito:** habilitar Anonymous no Firebase Console (1 toggle).

### Tentativa 6 — Reset estado dos botões (PR #8, v7.4)

**Bug visto na screenshot:** quando usuário voltava da tela de erro do Google (`origin_mismatch`), botão "Entrar com Google" ficava preso em "Abrindo Google…". Causa: `enhanceWelcome` dava early return quando botão já existia, sem resetar.

**Implementado:** early return agora reseta texto e `disabled` de TODOS os botões do welcome (Google + 4 slots).

### Tentativa 7 — Expor código técnico em tela (PR #9, v7.5)

**Contexto:** Usuário disse que não sabe abrir DevTools, não consegue colar logs ("dá erro 400" — quota da conversa).

**Implementado:** abaixo da mensagem amigável de erro anônimo, mostra `e.code || e.message` cru do Firebase em monospace. Usuário só tira print da tela.

**Resultado:** Próximo erro reportado foi `auth/admin-restricted-operation` mesmo com Anonymous **enabled** no Console. Suspeita atual: setting "Habilitar criação (registro)" em **Authentication → Configurações → Ações do usuário** está desmarcada. Esperando confirmação do usuário.

---

## 4. O que FUNCIONOU

✅ **Pré-aquecimento do Firebase no boot** (v6.9) — popup em browsers desktop não-iOS volta a abrir síncrono.
✅ **Mensagens de erro em PT-BR** (`friendlyAuthErr`) — mapeia ~10 códigos Firebase comuns.
✅ **Botões resetam ao voltar de tela de erro do Google** (v7.4).
✅ **Cola link de convite no PWA iOS** — workaround para isolamento de localStorage Safari↔PWA.
✅ **Diagnóstico em tela** — código técnico do Firebase aparece sem precisar DevTools.
✅ **Login Google já funciona em desktop** — confirmado por screenshot ("Caio Correia Moreira · caiomoreira.adv@gmail.com").
✅ **Service Worker network-first p/ JS** — atualizações de cloud.js chegam sem reinstalar.
✅ **Login anônimo por slot funciona em código** — código está pronto, só depende de habilitar no Firebase.

## 5. O que NÃO FUNCIONOU

❌ **`signInWithPopup` em Safari iOS** — popup abre como nova aba, promise nunca resolve. ITP bloqueia iframe handler.
❌ **`signInWithRedirect` em Safari iOS** — redirect sai e volta, mas `getRedirectResult` retorna `null`. ITP bloqueia storage cross-origin entre `firebaseapp.com` e `github.io`.
❌ **PWA iOS standalone com qualquer Firebase Auth flow** — popup E redirect quebram. Apenas GIS resolve.
❌ **GIS sem `caiomoreiraadv-oss.github.io` autorizado** — erro 400 `origin_mismatch`. Depende de passo manual no Google Cloud Console.
❌ **Login anônimo Firebase** — código pronto, mas Firebase ainda retorna `admin-restricted-operation`. Aparentemente falta um segundo toggle ("Habilitar criação de usuário") em Authentication → Configurações.

## 6. Limitações estruturais do ambiente (não há fix por código)

🔒 **iOS isola localStorage Safari↔PWA instalado** — regra Apple. App PWA não vê config do Safari.
🔒 **iOS Safari ITP bloqueia storage cross-origin** — Firebase Auth com `<projectId>.firebaseapp.com` não funciona em iOS.
🔒 **GitHub Pages não serve `/__/auth/*`** — não há como fazer auth handler same-origin (que resolveria o ITP).
🔒 **Não existe API push em PWA iOS sem App Store** — lembretes só via `.ics` (calendário do iPhone).
🔒 **Apple não permite instalar PWA sem `Safari → Compartilhar → Add to Home Screen`** — install.html faz o máximo possível (instruções claras), mas não pode automatizar.

## 7. Estado atual (final desta sessão)

### Live em produção
- Site `https://caiomoreiraadv-oss.github.io/` com Plotti v7.5
- SW v7.5 ativo (network-first para JS, atualiza sozinho)

### Funcionalidades operacionais
- Modo nativo completo (sem Firebase): roteiro, checklist, contatos, conversa, caixinha local, mapas externos
- Login Google em desktop (Caio já está logado)
- Login Google em iOS Safari: **bloqueado por `origin_mismatch`** (precisa autorizar origem no Cloud Console)
- Login anônimo: **bloqueado por `admin-restricted-operation`** (suspeita: "Habilitar criação" desmarcada no Firebase Console)

### O que falta para destravar (ações manuais do usuário)

**Caminho A — Google funciona pra todos (preferível, mantém foto/calendário):**
1. https://console.cloud.google.com/apis/credentials?project=plotti-877f5
2. Clicar no Web Client criado pelo Firebase
3. "Authorized JavaScript origins" → ADD URI → `https://caiomoreiraadv-oss.github.io`
4. SAVE
5. Aguardar ~1 min, testar de novo no app

**Caminho B — Anônimo funciona pra todos (rápido, perde foto Google):**
1. https://console.firebase.google.com/project/plotti-877f5/authentication/providers
2. Confirmar que **Anônimo** está "ativado" (já fez — confirmado por screenshot)
3. Aba **Configurações** → seção "Ações do usuário"
4. Marcar **"Habilitar criação (registro)"** se estiver desmarcado
5. SAVE
6. Hard refresh no app, tocar "Sou Caio"

**Caminho C — Migrar para Firebase Hosting (resolveria ITP de vez):**
- Custo: configurar `firebase init hosting`, adicionar GitHub Action de deploy, criar service account
- Benefício: `__/auth/handler` passa a ser same-origin, ITP não interfere mais
- Trade-off: precisa registrar custom domain ou abandonar `github.io`

---

## 8. Próximos passos sugeridos (após login destravar)

Em ordem de prioridade conforme proximidade da viagem (22 maio 2026):

1. **Testar fluxo completo do convite** — gerente cria link, manda no WhatsApp, viajante abre, faz login, aparece no grupo
2. **Validar sincronização entre 4 dispositivos** — despesas, missões, roteiro
3. **Testar `.ics` com alarmes** (v6.3) — abrir num iPhone, ver se entra no Calendar com alerta
4. **Testar localização ao vivo** ("Onde estão") — 4 pessoas compartilhando GPS via Firebase
5. **Cadastrar passagens reais** — período, voos, hotéis, eventos do roteiro
6. **Testar offline em roaming** — desligar dados, verificar que tudo funciona

---

## 9. Arquivos relevantes (mapa para encontrar coisas)

```
caiomoreiraadv-oss.github.io/
├── index.html              # Monólito UI + estado + telas (3.800+ linhas)
│   ├── linha 1128–1146    #   Welcome screen markup
│   ├── linha 1595–1660    #   showWelcome/hideWelcome/renderWelcome
│   ├── linha 2189+         #   startGoogleSignIn (legado, GIS antigo)
│   └── linha 2295+         #   syncRoteiroToGoogleCalendar
├── cloud.js                # Firebase + integrações nativas (~3.000 linhas)
│   ├── linha 98–130        #   Config + invite link
│   ├── linha 146–300       #   AUTH (Firebase + GIS + anônimo)
│   ├── linha 303–328       #   assignSlot + registerMember
│   ├── linha 330–360       #   bindAuthState + onAuthStateChanged
│   ├── linha 363–410       #   checkRedirect + auth pending overlay
│   ├── linha 600–700       #   Sync RTDB
│   ├── linha 770–910       #   scrNuvem (tela Mais → Nuvem & Login)
│   ├── linha 1431+         #   enhanceWelcome (botões + slots)
│   └── linha 1640+         #   arranque (acceptInvite, prewarmFirebase, checkRedirect)
├── extras.js               # Caixinha, Conversa, Quiz, etc.
├── sw.js                   # Service Worker network-first
├── install.html            # Assistente de instalação ("Add to Home Screen")
├── manifest.webmanifest    # PWA manifest
└── icons/
    └── plotti/             # Brand assets
```

---

## 10. Lições aprendidas para sessões futuras

1. **iOS Safari + Firebase Auth + cross-origin = inferno.** Default para GIS ou anônimo em iOS desde o início.
2. **GitHub Pages como host de PWA tem custos invisíveis.** Sem servir `/__/auth/*`, qualquer fluxo de auth via Firebase tem fricção em iOS. Firebase Hosting resolveria.
3. **localStorage do PWA é separado do Safari no iOS.** Sempre planejar o handoff (invite link, sync code, etc.).
4. **Mensagens de erro precisam ser acionáveis.** `auth/admin-restricted-operation` cru não diz nada ao usuário; `friendlyAuthErr` é essencial.
5. **Diagnóstico em tela > DevTools.** Usuários comuns não abrem console. Mostre código técnico discreto no UI quando der erro.
6. **PWA iOS não tem push.** Lembretes via `.ics` + VALARM é o caminho.
7. **Squash merge muda o histórico do branch.** Em PRs sequenciais, fazer `git fetch origin main && git reset --hard origin/main && git cherry-pick <novo-commit>` antes de criar próximo PR.
8. **Service Worker network-first p/ JS é a saída do "cache preso".** Bumpar VERSION a cada deploy crítico.

---

*Fim do relatório. Próxima sessão: começar por confirmar qual caminho (A, B ou C) o usuário escolheu para destravar o login.*
