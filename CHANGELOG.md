# PT-2026 · Changelog

## v6.6 · 19 maio 2026 · Assistente de instalação (install.html)

- Nova página `install.html` — o link "para virar app na tela do celular". Detecta sozinho o aparelho/navegador e mostra o caminho certo:
  - **Safari no iPhone:** passo a passo com o ícone real do Compartilhar e "Adicionar à Tela de Início".
  - **WhatsApp/Instagram/Facebook/Messenger/LINE no iPhone:** avisa "abra no Safari primeiro" e ensina como.
  - **Chrome/Firefox/Edge no iPhone:** explica que a Apple só deixa instalar pelo Safari e oferece copiar o endereço.
  - **Chrome no Android:** botão "Instalar agora" que aciona o instalador nativo (`beforeinstallprompt`); fallback manual se o Chrome não oferecer.
  - **Outros navegadores no Android:** instrui a abrir no Chrome.
  - **Desktop:** explica que o melhor é instalar pelo celular e dá link direto.
- **Já instalado** (`display-mode: standalone`): redireciona direto para o app, sem mostrar instruções.
- Página única, autônoma, mesmo estilo do app (Fraunces + Inter, paleta Plotti, dark mode automático).
- Adicionada ao precache do service worker (abre offline na segunda visita).
- Link para compartilhar: `https://caiomoreiraadv-oss.github.io/install.html` — esse é o link "em ponto de bala".

**Honesto sobre a limitação da Apple:** não existe API que instale o PWA sozinho no iPhone — é regra da Apple, vale para qualquer PWA. O assistente faz o máximo possível: caminho certo em 2-3 toques, sem o usuário ficar perdido em qual botão tocar.

## v6.5 · 19 maio 2026 · App em branco (genérico) — Etapa 1

- **Conteúdo de Portugal removido:** `TRIP`, `HOTELS`, `DAYS`, `EVENTS`, `CONTATOS`, `BOARD_STOPS`, `MISSIONS`, `COMPAT` esvaziados. Nada de viagem pré-preenchido (o conteúdo segue salvo no histórico do Git).
- **Dias gerados pelo usuário:** `DAYS` agora é derivado em runtime do período que você cadastra (`syncDays()` a partir de `state.x2.trip`). `currentDayNum()` à prova de viagem vazia.
- **Tela Hoje refeita:** estado em branco mostra um hero "Crie a sua viagem"; o card "Cadastrar agora" (que abre o cadastro de período/passagens) já aparece no topo. "Antes de embarcar" virou **só o Checklist**. Os "Atalhos" sem sentido saíram do pré-viagem (só aparecem durante a viagem). Trilho de dias só quando há dias.
- **Roteiro e Mapa** com estado vazio amigável (sem quebrar) e atalho para a tela Hoje.
- **Convidar viajantes:** novo ícone no topo (e card na Hoje após entrar) que compartilha o link do app — funciona em modo nativo e com Firebase.
- Subtítulo e textos fixos de Portugal removidos. Próximas etapas: perfis genéricos (sem nomes fixos), formulário de onboarding ampliado, criar eventos do roteiro do zero.

## v6.4 · 19 maio 2026 · Correção: link puro travava exigindo Firebase

- **Bug:** abrir o link direto (sem convite) mostrava só "Entrar com Google" e, ao tocar, um `confirm()` sem saída pedindo configurar o Firebase. Pior: ao confirmar, ele logava como "caio" e abria direto em **Nuvem & Login** em vez da tela inicial.
- **Causa:** o `enhanceWelcome` sequestrava a tela de boas-vindas e forçava Google mesmo sem Firebase, com dead-end de configuração.
- **Correção:** sem Firebase configurado, a tela de boas-vindas **nativa** volta a aparecer (escolher perfil e entrar offline) — exatamente o "Modo nativo" que o app documenta. Com Firebase (via link de convite), o fluxo Google segue igual. Mudança mínima, sem regressão.

## v6.3 · 19 maio 2026 · Lembretes do roteiro (alarme no calendário)

- **O .ics agora toca antes:** cada evento com horário leva alarme **30 min antes**; voos, check-in, reservas e marcos levam um alarme extra **3 h antes**. Adicionado via `VALARM` no iCalendar (RFC 5545).
- **Por que assim (honesto):** o app é estático (GitHub Pages, sem servidor) e iPhone só dá push de PWA instalado. Notificação por servidor não é possível. O calendário do aparelho é o único caminho que **funciona com o app fechado, offline e sem login** — e já era o mecanismo de export do roteiro; só faltava o alarme.
- Texto de Mais → Calendar atualizado explicando o lembrete. Mudança aditiva, sem regressão.

## v6.2 · 19 maio 2026 · Caixinha redonda — marcar acerto como pago

- **Marcar como pago:** cada linha de acerto em Saldos ganhou o botão **"Marcar como pago"**. Ao confirmar, o pagamento entra como um lançamento de acerto e **a dívida zera** — antes ela ficava para sempre (tinha que inventar uma despesa invertida).
- **Extrato honesto:** acertos pagos aparecem como uma linha distinta (verde, tracejada, "Fulano → Beltrano") e **não entram no "Total do grupo"** (é transferência, não gasto). Botão **"desfazer"** caso registre errado.
- **Sincroniza igual:** o pagamento é um lançamento normal (com id/ts), então o "Gerar/Colar código" entre os quatro já o propaga sem nenhuma mudança no sync.
- Zero alteração no cálculo de saldos e no algoritmo de acerto — o pagamento apenas flui por eles. Mudanças aditivas, sem regressão.

## v6.1 · 19 maio 2026 · Tela "Hoje/Agora" ciente do tempo

- **Quanto falta:** o card da tela Hoje agora mostra um selo com o tempo até o próximo compromisso — **"em 40 min"**, **"em 2h10"** — em vez de só o horário fixo. Bem mais acionável no momento.
- **Acontecendo agora:** se um compromisso começou há até 90 min e nada novo está logo aí, o card vira **"Agora"** (selo terracota, borda destacada) — reconhece que você está no meio do passeio/refeição.
- **Fim do dia sem confusão:** quando não há mais nada marcado, em vez de voltar a mostrar o evento da manhã (já passado), aparece **"Por hoje é isso · nada mais marcado — aproveite a noite"** com atalho direto para **ver o dia de amanhã**.
- **Considera eventos do grupo:** o "próximo" passou a usar os eventos efetivos (inclui os que o grupo adicionou ao roteiro), não só os fixos.
- Mudanças aditivas: `nextEvent()` mantém todos os campos que o card e o botão flutuante já usavam; zero regressão.

## v6.0 · 19 maio 2026 · Blindagem do modo offline (roaming instável em viagem)

- **Aviso de rede:** uma faixa discreta no topo aparece quando o celular fica **sem internet**, tranquilizando que o app continua funcionando (roteiro, mapas salvos, contatos, frases). Some sozinha e confirma **"Conectado de novo"** ao voltar a rede. Usa `navigator.onLine` + eventos `online`/`offline`.
- **Câmbio com data:** as duas telas de câmbio (Mais → Câmbio e Caixinha → Câmbio) agora mostram **de quando é a cotação** (ex.: "cotação de 21/05 14h30") em vez de só "estimativa/atualizada". Offline, avisa **"sem rede agora"** para o viajante saber que o valor pode estar velho. Cotação e data sincronizadas entre as duas telas.
- **Sem `alert` travando:** atualizar a cotação sem internet não trava mais com um pop-up; usa aviso leve e mantém a última cotação salva.
- Mudanças 100% aditivas — nenhuma lógica existente removida; zero regressão de usabilidade.

## v5.5 · 19 maio 2026 · Brand book aplicado ao layout (editorial/atlas)

- **Fundo:** removida a bandeira de Portugal + véu escuro; agora pergaminho Plotti com traço cartográfico pontilhado sutil (claro e escuro). App inteiro clareou para o editorial do brand.
- **Tipografia:** Fraunces 600/700 com optical sizing e tracking negativo nos títulos; **eyebrow** virou JetBrains Mono, uppercase, tracking .18em, **terracota** (igual ao brand book) — propaga a todas as telas.
- **Forma:** escala de raios Plotti (6/12/18/28); cards a 18px; sombras quase nulas (atlas = traço fino > sombra).
- **Botões:** CTA cartógrafo sólido, texto marfim, peso 600; ghost com borda/again cartógrafo.
- **Navegação:** marca Plotti em Fraunces 700; indicador da aba ativa virou o **ponto-pino terracota** (eco do logo).
- Zero regressão de usabilidade — tudo via CSS/tokens; estrutura e JS intactos. Validado no preview.

## v5.4 · 19 maio 2026 · Logo/símbolo Plotti integrado

- **Símbolo P-pino** (do brand pack) agora é a marca no topo do app (vetorial inline, temável: P em verde-cartógrafo, ponto terracota) — substituiu o ícone genérico.
- **Favicon SVG** Plotti (aba do navegador). Assets de marca adicionados em `icons/plotti/` (símbolo, app-icon claro/escuro, wordmark) e referenciados no manifest (SVG any+maskable) e no service worker (offline).
- **Honesto:** o ícone na tela inicial do iPhone (apple-touch-icon) exige **PNG assinado**; o iOS não usa SVG aí. Os SVGs estão no projeto; faltam os PNGs (1024/192/32) do brand pack para o ícone do iPhone trocar — quando fornecidos/rasterizados, é só dropá-los em `icons/` que o manifest/apple-touch passam a usá-los.

## v5.3 · 19 maio 2026 · Identidade Plotti (rebrand visual)

- Aplicado o **brand book Plotti**: nome do app passa a **Plotti** (topbar, título, manifest, Apple Web App, Sobre, .ics).
- **Paleta remapeada nos tokens** (sem mexer na estrutura, zero regressão de usabilidade): verde-cartógrafo #3F5B47 (primary), terracota viva #C25E3D, pergaminho #F6F0E1, marfim #FFFCF5, tinta #1F1A14, ouro #D4A85F, status (sucesso #4C7A4F, vinho #8B2E26, mostarda #A88A3C). Modo escuro "Plotti à noite".
- Tipografia mantida (Fraunces/Inter/JetBrains Mono — já era a do brand book).
- Cores-assinatura dos viajantes e categorias alinhadas à marca (ouro/terracota/oliva/petróleo); níveis do quiz e bordas recoloridos.
- theme-color e ícone do app atualizados para a cor da marca.
- **Todos os avanços de usabilidade preservados** (quiz por gradação, perfis do grupo, passagens na Hoje, Reservas, Tradutor, Saiba mais, convite por link, sync, etc.).

## v5.2 · 18 maio 2026 · Passagens & período em destaque na Hoje

- Card no **topo da tela Hoje** (primeiro elemento, bem visível): sem viagem cadastrada → "Cadastre suas passagens · Cadastrar agora"; com viagem → resumo (início → fim · destinos) + "Atualizar passagens/período". Abre o mesmo fluxo (subir PDF/imagem ou preencher à mão).

## v5.1 · 18 maio 2026 · Passagens & período (passo pós-quiz)

- Depois do login + quiz, abre um passo guiado **"Suas passagens e o período"**: 
  - **Subir passagem (PDF/imagem)** → o app lê (PDF/texto ou OCR) e, com o assistente, extrai **início, fim e destinos**; o voo entra automaticamente em **Reservas → Transporte** com o arquivo anexado.
  - **Ou preencher à mão**: datas de início/fim + destinos na ordem.
- O período e os destinos **sincronizam** para o grupo e aparecem no card **Perfil** ("Viagem: início → fim · destinos"). Pode pular ("agora não") sem travar.
- Prático: um toque para subir, confere, salva.

## v5.0 · 18 maio 2026 · Quiz por gradação + perfis do grupo (anti-atrito)

- O quiz deixa de ser "ordene por preferência" e passa a ser **gradação explícita**: cada opção representa o viajante em algum grau — a 1ª **MUITO**, a 2ª **BEM**, a 3ª **ÀS VEZES**, a 4ª **NÃO**. As opções ranqueadas mostram esse rótulo colorido (não mais 1-2-3-4). Reconhece que ninguém é só uma coisa (quem acorda cedo pode, cansado, querer dormir e não se incomodar do grupo sair sem ele).
- O resultado guarda a **nuance completa** por dimensão (ex.: "Ritmo — acorda cedo (muito), moderado (bem), imprevisível (às vezes), acorda tarde (não)").
- Nova seção na aba **Perfil**: **"Perfis dos viajantes"** — mostra a gradação de cada um (sincronizada), para o grupo conhecer o jeito do outro e **evitar atritos** na viagem.
- Botão **"Refazer minha avaliação de perfil"** no Perfil — pode refazer quando quiser (humor/energia mudam no meio da viagem).
- O assistente passa a considerar a nuance (principal + "às vezes" secundário), não um rótulo rígido.

## v4.9 · 18 maio 2026 · Convite por link (1º viajante chama os outros)

- Quem configurou (gerente) tem em **Mais → Nuvem & Login** um card **"Convidar os outros viajantes"** com um **link de convite** e botões **WhatsApp / E-mail / Compartilhar / Copiar**.
- O link carrega a configuração do app embutida (`#join=`): quem abre **já fica com tudo configurado** — só toca em **Entrar com Google** e cai na mesma viagem (despesas, mapa, reservas, tradutor, sincronizados). Sem precisar configurar Firebase nem nada.
- Não sobrescreve a config de quem já é gerente; o lugar de cada um é definido por ordem de entrada.

## v4.8 · 18 maio 2026 · Atalhos coerentes + Tradutor completo

- Atalhos da tela **Hoje** alinhados ao "Mais": removido "Roteiro" (já está na barra fixa de baixo); "Bagagem" → **"Checklist"** (mesma tela do Mais); "Câmbio" → **"Caixinha"**; "Frases PT" → **"Tradutor"**.
- Removido o link "abrir o app Clima do iPhone" (a previsão no app já basta).
- **Tradutor de viagem completo** dentro do "Falar PT-PT/Tradutor": traduz por **texto**, por **voz** (fala e devolve em PT-PT, com "ouvir em voz alta") e por **foto do cardápio/placa** (lê a imagem, traduz para PT-BR e explica os pratos) — estilo Google Tradutor, sem sair do app. O modo de frases offline continua como reserva.

## v4.7 · 18 maio 2026 · Quiz de perfil obrigatório no login

- Após o login Google + tela de sincronização, o viajante **obrigatoriamente** responde um quiz de **5 perguntas** (Ritmo, Comida, Dinheiro, Cultura, Roteiro) — os pontos de maior divergência numa viagem em grupo.
- Cada pergunta tem **4 opções** e o viajante as **ordena por identificação** (1ª = mais a sua cara → 4ª = menos): gradação, não escolha única. Todos somos um pouco de cada — o quiz captura o quanto.
- O perfil resultante (ex.: "Ritmo: acorda cedo · Comida: aventureiro · Dinheiro: custo-benefício · Cultura: principais pontos · Roteiro: plano com folgas") passa a **alimentar o assistente**: recomendações de comida e passeios consideram esse perfil. Os perfis dos quatro **sincronizam** entre si.
- Tela sem botão de fechar — só conclui respondendo (obrigatório uma vez por viajante).

## v4.6 · 18 maio 2026 · Assistente gastronômico nas refeições

- Cards de refeição (jantar, almoço, tasca, cervejaria…) ganham nota 🍽 e o botão **"Comer aqui?"** (no lugar de "Saiba mais"): abre o assistente já em modo gastronômico.
- A IA responde considerando **as opções sugeridas no card** e o **perfil do quiz** do viajante ativo: diz se vale a pena, o que pedir, o que evitar.
- Mesmos recursos: **Perguntar** (texto), **Falar** (voz) e **Foto do local** — bate foto do estabelecimento/prato e pergunta se é bom, ou diz o que está com vontade de comer.

## v4.5 · 18 maio 2026 · "Como chegar" vira rota A→B + olhos no caminho

- O botão de mapa de cada evento abre **rota do ponto atual até o destino** no app de mapas (Apple Maps no iPhone), com o **modo certo**: a pé / transporte / carro, detectado pelo texto do evento. Eventos de Uber/táxi ganham botão **Uber** (pickup = sua localização).
- Rótulo passa a "Como chegar · a pé / · transporte / · de carro".
- **Caminhadas** ganham nota "👀 olhos atentos" e, com o assistente ativo, o botão **"O que ver no caminho"** — a IA lista pontos e curiosidades do trajeto.

## v4.4 · 18 maio 2026 · Fim do cache preso (network-first p/ JS)

- Service worker passou a buscar HTML e JS **sempre da rede** (cache só como reserva offline). Acaba o "preso na versão antiga" — após esta atualização, todo deploy futuro aparece sozinho, sem "Forçar atualização".

## v4.3 · 18 maio 2026 · "Saiba mais" enxuto

- Removidos também os botões **Wikipédia** e (já na v4.2) **Google Lens**. Sobrou só **Google** como apoio + os recursos da IA (Perguntar / Falar / Foto do local).

## v4.2 · 18 maio 2026 · "Saiba mais": foto in-app, voz e sem Lens

- **Botão "Google Lens" removido** (saía do app). A capacidade visual ficou no **"Foto do local"**: abre **câmera ou galeria** (sem forçar câmera) e a própria IA do app analisa a imagem e explica.
- **Novo botão "Falar"** (ícone de microfone padrão): dita a pergunta por voz. Usa reconhecimento nativo quando disponível (desktop/Android); no iPhone, grava e manda o áudio para a IA entender e responder; se não der, orienta usar o microfone do teclado do iPhone.
- "Perguntar" mantido. Google/Wikipédia seguem como apoio rápido.

## v4.1 · 18 maio 2026 · Assistente mais resiliente

- `askAI` agora tenta vários modelos em sequência (gemini-2.0-flash → -lite → 1.5-flash → 1.5-flash-8b → 2.5-flash); se um estiver sem cota/indisponível, cai para o próximo automaticamente.
- Mensagem clara quando a chave está sem cota grátis ("limit: 0"): orienta gerar nova chave em projeto NOVO no AI Studio e usar as buscas enquanto isso.

## v4.0 · 18 maio 2026 · "Saiba mais" em todo card do roteiro

- Cada evento/lugar do roteiro ganhou um botão **"Saiba mais"**.
- **Sempre disponível (grátis):** abre busca do lugar no **Google**, **Wikipédia** e **Google Lens** (para pesquisar batendo foto de um quadro/escultura/igreja no local).
- **Assistente embutido (opcional):** o gerente cola uma chave **Google Gemini** (grátis, sem cartão — link no painel) em **Mais → Nuvem & Login**. Aí o "Saiba mais" passa a **responder perguntas e analisar fotos dentro do app**: tira a foto do item no local e o app explica o significado histórico/artístico, em PT-BR.
- Honesto: a resposta dentro do app exige a chave (IA tem custo/infra); sem ela, ficam as buscas externas — que já resolvem muito.

## v3.9 · 18 maio 2026 · Abertura só com Google

- Tela de abertura mostra **apenas "Entrar com Google"** — sempre, mesmo sem Firebase no dispositivo. Removidos de vez: grade de perfis, "Sou visita" e o bloco/texto legado do Google. Título passou a "Bem-vindo".
- A identidade é 100% a conta Google; o app reconhece quem é. (Sem Firebase no aparelho, o botão leva o gerente às instruções de configuração — usuários comuns nunca veem isso em produção.)

## v3.8 · 18 maio 2026 · Layout mais limpo (consolidação de ícones)

De ~24 ícones em Mais para ~16, sem perder nada:
- **Câmbio** virou uma aba dentro da **Caixinha** (Lançar / Saldos / Extrato / Câmbio).
- **Frases PT-PT** foi para dentro do **Modo conversa**, agora chamado **"Falar PT-PT"** (tradução + frases + áudio num só lugar).
- **Voos & Carro + Hotéis + Onde dormimos + Decolagens + Reservas** viraram um único **Reservas**, com seletor **Transporte / Hospedagem / Lazer / Outros**. Os hotéis e voos confirmados aparecem como cartões de referência (com "Como chegar", "Ligar", "Status do voo"); o que cada um preenche entra na categoria certa.
- **Vitrine** (ingressos) absorvida em Reservas → Lazer. **Calendar** absorvido em Integrações (que já tinha .ics + Google).
- Rótulos atualizados para refletir os hubs.

## v3.7 · 18 maio 2026 · Controle de gerente

- **"Nuvem & Login"** e **"Personalizar fotos" / "Atmosfera"** agora só aparecem para o **gerente do app** (quem ocupa o lugar de admin — o Caio nesta viagem; o primeiro/configurador em viagens futuras).
- Acesso direto a essas telas por quem não é gerente é bloqueado (redireciona para a lista). Os demais usam o login pela tela de abertura normalmente; só não veem o painel de configuração nem a personalização visual.
- "Reservas" e os demais módulos seguem compartilhados para os quatro.

## v3.6 · 18 maio 2026 · Reservas: extração automática de PDF/imagem

- Na tela **Reservas**, botão grande **"Subir PDF ou imagem da reserva"**: o usuário sobe o documento, o app **lê e preenche sozinho** (nome, datas, código, URL); depois é só **Salvar**. O arquivo fica anexado à reserva.
- **PDF**: extração da camada de texto via `pdf.js` (funciona com confirmações geradas eletronicamente — Booking/TAP).
- **Imagem**: OCR no próprio navegador via `tesseract.js` (pt+en), sem servidor.
- Bibliotecas baixadas **sob demanda** só quando o usuário sobe um arquivo — o uso normal do app continua leve e offline.
- Fallback honesto: PDF escaneado sem texto / sem rede para OCR → o arquivo é anexado mesmo assim e os campos ficam para preenchimento manual. A opção "colar texto" continua, agora recolhida.

## v3.5 · 18 maio 2026 · Identidade genérica + Reservas editáveis

- **Qualquer conta Google entra.** Removido o mapa de e-mails/heurística de nome fixos. A identidade é a própria conta Google (nome/foto). O "lugar" na viagem é atribuído automaticamente por ordem de chegada via um registro `members` no Firebase — sem modal, sem nomes chumbados. Isso torna o app reutilizável em viagens futuras com qualquer grupo.
- **Tela "Reservas"** — onde Booking/TAP não permitem importação automática, qualquer um preenche: tipo (hospedagem/voo), nome, cidade/trecho, data+hora de entrada/saída, URL, código da reserva, observação. Anexo de PDF/imagem. **"Extrair do texto"**: cola-se o e-mail de confirmação e o app preenche código, datas e URL sozinho. Tudo sincroniza entre os quatro (campo `stays` no doc compartilhado, merge por id/timestamp).
- Esclarecido honestamente: o "sempre online, nunca cai, atualiza quando qualquer um mexe" **já é entregue por Netlify (hospedagem) + Firebase Realtime (sync)** — não por um "servidor Claude". Claude constrói/itera o código; a infraestrutura mantém no ar.

## v3.4 · 18 maio 2026 · Login Google = identidade + consentimento + Calendar

- **Sem mais "Qual é você?".** O app identifica o viajante pela conta Google: mapa de e-mail (Caio) + heurística por primeiro nome (Amanda/Lucas/Bruna). O modal só aparece se nada bater (raríssimo).
- **Tela única de consentimento pós-login.** Pede só o que um PWA pode: localização ao vivo entre os 4 **restrita a 22–29/05/2026**, notificações, envio do roteiro ao Google Calendar, e o caminho real de voo/hotel (encaminhar e-mail de confirmação). "Permitir tudo" liga tudo de uma vez.
- **Google Calendar no login.** O login pede o escopo `calendar.events`; ao consentir, os passeios entram na agenda Google (uma vez por aparelho, sem duplicar).
- **Welcome só com Google** quando o Firebase está configurado (esconde grade de perfis e "visita").
- **Eventos por usuário sincronizam.** Edição do roteiro (ex.: Bruna preenche o horário do almoço na Casa da Clara) propaga para os quatro via Firebase.
- **Honestidade mantida:** Booking/TAP/Buscar não têm como ser sincronizados automaticamente (barreira do iOS/serviços) — a tela explica e oferece o caminho real (encaminhar e-mail; localização ao vivo no mapa do próprio app).

## v3.3 · 18 maio 2026 · Realtime Database + correções de produção

- **Trocado Firestore → Realtime Database.** O Firestore passou a exigir cartão de crédito (Blaze) mesmo no tier grátis. O Realtime Database é gratuito no plano Spark sem cartão e atende tudo (sync dos 4 + localização ao vivo). `cloud.js` reescrito para RTDB; config agora exige `databaseURL`. Guia in-app (5 passos) e regras atualizadas.
- **Login Google idempotente.** O listener `onAuthStateChanged` era registrado mais de uma vez, fazendo o modal "Qual é você?" repetir. Agora registra uma única vez e não reabre se o viajante já está vinculado.
- **Correção de deploy.** Documentado que o ZIP do Netlify Drop precisa ter os arquivos na raiz (não embrulhados na pasta `pt-2026/`), senão `extras.js`/`cloud.js` dão 404 e os módulos novos não aparecem.
- Firebase real configurado e validado em produção (projeto `pt-2026`, RTDB europe-west1): login Google de Caio + escrita/remoção de despesa sincronizando sem erro.

## v3.1 · 18 maio 2026 · Nuvem, login Google e integrações nativas (`cloud.js`)

Novo arquivo auxiliar `cloud.js` (carregado após `extras.js`). O `index.html` recebeu só 3 edições (script tag + 2 bumps). **Firebase só baixa da rede se houver config** — sem config, o app continua 100 % offline.

### Login com Google (real)
- Botão **"Entrar com Google"** em destaque na tela de abertura, acima dos perfis.
- Autenticação real via **Firebase Auth** (popup → fallback redirect para PWA standalone do iPhone). Na primeira vez, pergunta qual dos quatro viajantes você é e vincula a conta.
- Sem Firebase configurado: continua o modo nativo (escolher perfil), explicado na tela.

### Sincronização realtime entre os quatro
- Com Firebase: despesas, missões, ingressos, voos e link do álbum sincronizam via **Firestore** (offline-first com IndexedDB). Merge não-destrutivo: despesas por id (timestamp maior vence), missões em união (selo conquistado nunca some).
- `saveState` foi instrumentado para empurrar à nuvem (debounce 1,5 s) só quando logado; `onSnapshot` traz mudanças dos outros e re-renderiza.
- Sem Firebase: a sincronização por código colável da Caixinha continua valendo.

### "Onde estão" — localização ao vivo dos quatro
- Nova tela (Mais → **Onde estão**), estilo "Buscar".
- Com Firebase: toggle "Compartilhar minha localização ao vivo" grava posição no Firestore a cada ~25 s; todos veem a lista com distância/tempo e "Ver todos no mapa". Só os quatro. Opt-in explícito.
- Fallback **nativo (sem config)**: "Mandar minha posição no grupo" abre o WhatsApp com um link de Mapas; instruções para a Localização em Tempo Real do WhatsApp e o app Buscar da Apple.

### Painel Integrações (Mais → Integrações)
- **Booking.com**: o Booking não tem API pública para importar reservas (limite real, não do app). Botões "Minhas reservas" por hotel + colar o e-mail de confirmação → o app extrai nº de reserva, PIN e datas e guarda como nota.
- **Splitwise**: exporta os lançamentos formatados + abre o Splitwise (a Caixinha segue como solução principal).
- **Google Calendar**: `.ics` em um toque (sem login) + opções Google.
- **Google Maps offline**: app web não baixa mapa offline; passo a passo para pré-baixar no app do Google Maps + link da região.
- **Apple Wallet**: só aceita `.pkpass` assinado (limite da Apple); campo para colar link `.pkpass` da TAP vira botão da Wallet; cartão de embarque em tela cheia segue como substituto.
- **Clima do iPhone**: nenhum app lê os dados do app Clima da Apple (limite da Apple); previsão usa fonte equivalente (Open-Meteo) e há link que abre o app Clima nativo (`weather://`), também na tela Hoje.

### Configuração do Firebase (uma vez, ~15 min, gratuito)
Em **Mais → Nuvem & Login → "Como obter (5 passos)"**: criar projeto em console.firebase.google.com, registrar app Web, copiar o `firebaseConfig`, ativar Authentication (Google) e Firestore, colar a regra de segurança fornecida. Cola-se o config no app e os quatro passam a usar só "Entrar com Google".

### Chaves de API
Continua **nenhuma obrigatória**. Firebase é opcional (ativa login real + tempo real). Open-Meteo/exchangerate.host abertos.

## v3.0 · 18 maio 2026 · Fases 2 a 6 (módulo `extras.js`)

Salto categórico: o app deixa de ser guia e passa a absorver Splitwise, Booking, app da companhia aérea, ingressos, clima e álbum — embrulhado na mecânica de selos. **Tudo novo vive em `extras.js`**, um arquivo auxiliar carregado após o script principal (autorizado pela seção 8 do prompt-mestre). O monólito `index.html` recebeu apenas 4 edições cirúrgicas (script tag, bump de versão, e uma ponte de 6 linhas expondo os dados `const` ao escopo global) — estratégia adotada justamente para não repetir o truncamento que travou o cowork.

### Fase 2 · Caixinha (substitui o Splitwise)
- Três abas: **Lançar / Saldos / Extrato**.
- Lançar: valor em EUR com conversão BRL ao vivo, descrição, pagador (perfil ativo pré-selecionado), divisão **Igual entre 4 / Só o casal / Personalizada**.
- Categoria inferida automaticamente da descrição (Restaurante, Transporte, Ingresso, Hospedagem, Mercado, Outros).
- Saldos: posição de cada um em EUR e BRL, e o **acerto com o mínimo de transferências** (algoritmo guloso credor↔devedor). Cada transferência gera link "Cobrar no WhatsApp" e "Copiar PIX/Wise".
- Extrato: lista cronológica filtrável por viajante, com total do grupo.
- **Câmbio** EUR↔BRL via exchangerate.host (sem chave), com fallback gracioso para estimativa offline (6,30).
- **Sincronização sem servidor:** botão "Gerar código" exporta os lançamentos como string colável no grupo; "Colar código" funde por id com *last-write-wins* por timestamp. Offline-first.

### Fase 3 · Passaporte / Selos
- Tela própria com os carimbos de aduana de todos os quatro, agrupados por parada, em arte circular tracejada na cor de quem cumpriu (grupo = cinza). Missões em aberto aparecem como selo pontilhado. Reaproveita o catálogo de 51 missões e o `state.missions` já existentes.

### Fase 4 · Onde dormimos · Decolagens · Vitrine
- **Onde dormimos:** os 3 hotéis em cartão com check-in/out, reserva, PIN, "Como chegar/Waze/Ligar/WhatsApp/Copiar endereço" e **anexo** de voucher/e-mail (imagem comprimida ou PDF, em `localStorage` à parte).
- **Decolagens:** 3 trechos TAP (localizador XMQFRJ) com status ao vivo abrindo o FlightAware (sem chave) e anexo do cartão de embarque em tela cheia.
- **Vitrine:** cadastro de ingressos com data/local/preço/observação e anexo de QR/bilhete; o ingresso do dia ganha selo "HOJE".

### Fase 5 · Clima inteligente
- Widget na tela **Hoje** (Open-Meteo, sem chave): temperatura, sensação, máx/mín, condição e chance de chuva da cidade da fase ativa. Cache de 3 h para uso offline.
- **Alerta de chuva:** se a probabilidade ≥ 55 %, banner discreto sugere priorizar o que é coberto.
- Atalho **Caixinha** adicionado aos atalhos rápidos da Hoje.

### Fase 6 · Álbum · Modo conversa · Carta de Viagem
- **Álbum:** link único do álbum compartilhado (Google Photos/iCloud) configurado uma vez + captura in-app (câmera) com autoria do perfil ativo.
- **Modo conversa:** texto livre → versão PT-PT informal + áudio (Web Speech API, voz pt-PT) e atalhos prontos do dia.
- **Carta de Viagem:** resumo afetuoso e não-competitivo das contribuições reais de cada um (missões, fotos, adiantamentos), com botão de compartilhar.

### Estética e restrições
Paleta e tipografia preservadas (todo CSS novo usa os tokens `--olive/--terra/--gold/--surface/--line`). Sem framework. Sem dependência nova obrigatória. Sem login. Tudo offline-first. PT-BR na interface, PT-PT no modo conversa.

### Chaves de API
**Nenhuma obrigatória.** Tudo funciona sem cadastro: Open-Meteo (clima) e exchangerate.host (câmbio) são abertos; FlightAware é só um link. *Opcional, para sincronização realtime de verdade entre os 4:* trocar a sincronização por código por **Firebase Firestore** (config gratuita ~20 min) — ver "Próximos passos".

### Próximos passos
- Sincronização realtime via Firestore (4 docs de perfil + 1 doc de viagem, regras por lista branca de e-mails) substituindo a sincronização por código.
- Cachear no service worker as imagens de anexo/álbum para 100 % offline.
- Drag-and-drop real no extrato e no roteiro.

## v2 · 18 maio 2026 · Fase 0 + Fase 1

A primeira evolução em direção ao companheiro diário gamificado. Esta versão preserva integralmente o que já funcionava (Hoje, Roteiro, Perfil, Mais, paleta, tipografia, PWA mono-arquivo, instalação por Safari) e acrescenta duas camadas novas.

### O que muda na prática

**Fase 0 · Identificação de perfil**
Ao abrir o app pela primeira vez, uma tela cheia pergunta "Quem está abrindo?" com quatro cartões — Amanda (terracota), Bruna (verde-oliva), Caio (ouro pálido), Lucas (azul-petróleo). Um botão "Sou visita · só olhar" fica discreto no rodapé para quem está apenas curioso. A escolha persiste no aparelho (`localStorage`).

Depois de escolhido, o perfil ativo aparece como avatar redondo no canto superior direito, com a cor-assinatura do dono. Toque longo (≈480 ms) reabre a tela de escolha — útil quando o celular passa de mão. Toque curto exibe uma dica discreta lembrando o gesto.

O perfil ativo agora governa a renderização das missões individuais (cada um vê quais missões são suas), o destaque do peão no tabuleiro e — quando a Fase 2 chegar — a autoria automática de despesas, fotos e check-ins.

**Fase 1 · Mapa-Tabuleiro**
A aba Mapa ganhou um seletor de modo: **Tabuleiro** (padrão) e **Satélite real** (Google Maps, exatamente como antes).

O Tabuleiro é Portugal estilizado em SVG vertical (400×520), com nove paradas conectadas por trilhos tracejados que se solidificam quando vencidos. Cada parada tem três estados:

- **Bloqueada** — círculo claro, label esmaecido. Antes do dia D.
- **Hoje** — círculo oliva pulsante, label em destaque. No dia D.
- **Com selo** — círculo dourado com carimbo de aduana sobreposto, quando a fase passou ou todas as missões foram cumpridas.

Os quatro peões dos viajantes ficam ao redor da parada do dia atual, cada um na sua cor-assinatura. O peão do perfil ativo recebe borda mais forte. Tocar num peão troca o perfil ativo (atalho).

Um cartão abaixo do tabuleiro mostra a parada focada, com data, contagem de missões cumpridas, e dois botões: "Ver roteiro do dia" (atalho para a aba Roteiro filtrada pelo dia) e "Missões" (abre o painel).

**Missões**
Catalogadas para todas as nove paradas, divididas em **coletivas** (qualquer um dos quatro marca) e **individuais** (uma por perfil, alinhada ao quiz já existente):

| Parada | Coletivas | Individuais (Caio · Amanda · Lucas · Bruna) |
|---|---|---|
| Porto · chegada | Check-in, primeira taça no Mirajazz | Café escondido · prato local · azulejo São Bento · vinho verde |
| Casamento | Foto padrinhos, brinde, selo do dia | Discurso · detalhe da Lucie · vídeo entrada · abraço na noiva |
| Porto · ressaca | Francesinha, pôr do sol no Morro | Ribeira inteira · A Vida Portuguesa · ponte inferior · Porto Tônico |
| Douro | Cozinha da Clara, foto vinhedo, jantar Quinta | 3 Portos · pôr do sol · N222 · Estação Pinhão |
| Óbidos | Ginja de chocolate, muralha | Rua Direita · livraria · selfie Porta · chocolate |
| Fátima | Missa Capelinha, vela | Silêncio Cova · prece · foto basílica · recordação |
| Lisboa | Arco Augusta, Time Out, elétrico 28 | Senhora do Monte · Chiado · Pink Street · fado |
| Belém | Jerónimos, pastel quente, Torre | Túmulo Camões · áudio-guia · Ler Devagar · saleiro |
| Despedida | Foto aeroporto | Último galão · tax-free · caderno · presente |

Total: 51 missões mapeadas. Marcação salva localmente; quando uma fase atinge 100%, a parada ganha selo dourado.

**Outras melhorias**

- `STORE_KEY` migrada para `v2` com fallback silencioso para `v1` (preserva checklist da versão anterior).
- Cores-assinatura adicionadas aos quatro perfis (`signature`).
- Avatar dos perfis Caio (ouro) e Bruna (oliva) trocados na carta de perfil para refletir a paleta-assinatura.
- Toast discreto "toque longo para trocar perfil" no clique curto do avatar.
- Limpeza de dados (em Mais → Sobre) agora apaga também perfil ativo e missões.

### O que **não** mudou (preservado)

- Paleta off-white quente + verde-oliva + terracota + ouro pálido.
- Fontes Fraunces (serif) + Inter (sans).
- Cinco abas inferiores: Hoje, Roteiro, Mapa, Perfil, Mais.
- Cobertura editorial: 8 dias, 47 eventos, curiosidades históricas, hotéis com PIN.
- Câmbio EUR↔BRL com refresh.
- Frases PT-PT, checklist persistente, contatos com WhatsApp e Maps.
- Mono-arquivo `index.html` instalável como PWA via Netlify Drop.
- Acessibilidade (contraste AA, alvos ≥ 44 px, foco visível).
- Service worker e manifest inalterados.

### Compatibilidade

- Dados antigos preservados automaticamente (migração silenciosa de `pt2026:state:v1` para `v2`).
- Quem já instalou a v1 no iPhone recebe a v2 ao reabrir online (cache do service worker é purgado pelo `network-first` da rota HTML).
- Para forçar atualização: feche, reabra com internet, puxe a tela para baixo.

---

## v1 · 17 maio 2026 · Base
Versão inicial: 5 abas, 8 dias detalhados, 27 pontos no mapa, quiz dos quatro perfis, utilitários completos. PWA instalável.

---

# APIs externas — chaves a configurar

Esta versão (Fase 0 + 1) **não exige nenhuma chave de API**. Tudo o que faz é local. As APIs abaixo só entram em jogo a partir da Fase 2.

### Cotação EUR↔BRL · sem chave
- Endpoint: `https://api.exchangerate.host/latest?base=EUR&symbols=BRL`
- Plano: gratuito ilimitado, sem cadastro
- Já integrado no botão "Atualizar cotação" da aba Mais → Câmbio
- Falha gracioso: mostra alert "Sem conexão para atualizar cotação"

### Clima ao vivo · Open-Meteo · sem chave  *(Fase 5)*
- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current_weather=true`
- Plano: gratuito, sem cadastro, sem rate-limit prático para uso pessoal
- Como obter: nada a obter, basta consumir
- Fallback: mostrar "—" no widget quando offline

### Status de voos · AviationStack  *(Fase 4 — opcional)*
- Endpoint: `http://api.aviationstack.com/v1/flights?access_key=KEY&flight_iata=TP35`
- Plano: gratuito 100 requisições/mês (suficiente para ~3 consultas/dia em 30 dias)
- Como obter:
  1. Acessar https://aviationstack.com
  2. "Sign up free" — exige email
  3. Confirmar email, copiar a `access_key` da dashboard
  4. Salvar em `state.flightApiKey` via tela escondida (Mais → Sobre → "Configurar APIs")
- Fallback: mostrar os horários estáticos do voucher TAP

### Sincronização entre os 4 perfis · Firebase Firestore  *(Fase 2)*
- Plano: gratuito (Spark) — 50k leituras/dia, 20k escritas/dia, 1 GiB armazenado. Sobra muito para 4 pessoas em 8 dias.
- Como obter:
  1. Acessar https://console.firebase.google.com
  2. "Add project" → nomear `pt-2026-trip` → desativar Analytics (não necessário)
  3. Build → Firestore Database → "Create database" → modo "production" → região `europe-west`
  4. Project settings → General → "Your apps" → ícone web `</>` → registrar app `pt-2026`
  5. Copiar o `firebaseConfig` (objeto JS com 6 chaves: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId)
  6. Colar no app via tela de configuração (Mais → Sobre → "Conectar sincronização") ou diretamente em `window.PT2026_FIREBASE = {...}` antes de carregar o app
- Regras de segurança (cole em "Rules" do Firestore):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/pt-2026/{document=**} {
      allow read, write: if true;  // viagem privada, URL não publicada
    }
  }
}
```
  Para reforçar: trocar `if true` por verificação de uma chave compartilhada armazenada no app.

### Álbum compartilhado · Google Photos / iCloud  *(Fase 6)*
- Sem API — apenas link único, configurado uma vez. Botão "Abrir álbum" no app dispara `openLink(url)`.

---

# Próximos passos · Fase 2 (Caixinha)

Resumo do que vem a seguir, ordenado por dependência:

1. **Firestore configurado** (chave salva no app). Sem isso, despesas ficam só no aparelho de quem lançou.
2. **Tela "Caixinha" como nova aba ou substituindo um slot do Mais** — três visões: Lançar, Saldos, Extrato.
3. **Modelo de dados** —
   ```js
   expense = {
     id, ts, paidBy (profileId), amount (EUR), description,
     split: { type:'equal'|'custom', shares: {caio:0.25, amanda:0.25, lucas:0.25, bruna:0.25} },
     category (inferida), phaseId (qual parada do tabuleiro), createdBy (profileId)
   }
   ```
4. **Sincronização offline-first**: salvar local imediatamente, fila de sync; conflito resolvido por `lastWriteWins` com timestamp.
5. **Saldos em EUR e BRL** usando a cotação já no app.
6. **Deep link de pagamento** — `pix://pagador/...` (BR↔BR), `https://wise.com/...` (entre moedas), com valor pré-preenchido.
7. **Selo automático** — ao lançar a primeira despesa do dia, marcar coletivamente a missão "registrar primeira despesa" (acrescentar essa missão a cada parada).
8. **Categoria inferida**: regex simples sobre descrição (restaurante, transporte, ingresso, hospedagem, mercado, outros).

Critério de aceite para a Fase 2:
- Caio lança €25 de jantar pagos por ele, divididos entre os quatro.
- No celular da Amanda (e dos demais), em até 10 segundos com internet, o saldo passa a mostrar "Amanda deve €6,25 a Caio".
- Offline, a despesa fica visível no aparelho que lançou e sincroniza ao recuperar rede.
- A tela "Como pagar" gera um link PIX (se ambos forem BR) com o valor exato.
