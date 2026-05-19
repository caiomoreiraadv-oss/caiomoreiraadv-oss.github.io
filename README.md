# PT-2026 · Guia de Portugal · Caio & Amanda

App de uso diário para a viagem a Portugal — **22 a 29 de maio de 2026** · casamento Thiago & Lucie.

É um **Progressive Web App (PWA)**: instala como aplicativo nativo no iPhone e no Android, abre em tela cheia e funciona offline.

---

## O que tem dentro

- **Hoje** · dashboard híbrido com dia atual em destaque, próximo evento, contagem regressiva e atalhos rápidos (Maps, câmbio, contatos, frases).
- **Roteiro** · trilho horizontal dos 8 dias, com timeline detalhada, fotos de capa, ícones por categoria, curiosidades e ações diretas (ligar, mapa, site).
- **Mapa** · Google Maps embed por cidade, lista de pontos com botão de Waze/Maps direto no endereço.
- **Perfil** · respostas do quiz "Carta de Perfil do Viajante" para os 4 viajantes, com síntese de compatibilidade do casal.
- **Mais** · contatos, hotéis, voos & carro, documentos, checklist de bagagem, câmbio EUR↔BRL, frases PT-PT e dicas finais.

---

## Como instalar no iPhone (recomendado)

Hospedagem grátis — abre direto, atualiza sozinho e funciona offline.

### Opção A · Netlify Drop (mais rápido)
1. Acesse https://app.netlify.com/drop
2. Arraste a pasta `pt-2026/` inteira para a página
3. Em ~5 s, você recebe uma URL tipo `https://nome-gerado.netlify.app`
4. Abra essa URL no **Safari do iPhone**
5. Toque em **Compartilhar** → **Adicionar à Tela de Início**
6. O ícone aparece na home, abre em tela cheia

### Opção B · GitHub Pages / Vercel
Mesma rotina: subir os arquivos, pegar a URL, instalar pelo Safari.

---

## Como instalar em Android

1. Abra a URL no **Chrome**
2. Menu → **Instalar app** (ou um banner sobe automaticamente)
3. O app vira ícone na gaveta como qualquer outro

---

## Funcionalidades práticas em campo

- **Atalho contextual** — botão flutuante à direita abre a próxima ação relevante (ex.: ligar para o restaurante na hora da reserva).
- **Maps universal** — em iPhone abre Apple Maps, em Android abre Google Maps.
- **Waze 1-tap** — botão dedicado em cada ponto do mapa.
- **WhatsApp direto** — todos os números têm botão de WhatsApp ao lado de ligar.
- **Checklist persistente** — itens marcados ficam salvos no aparelho.
- **Câmbio com refresh** — busca cotação EUR/BRL ao vivo quando há internet.
- **Tema claro/escuro/auto** — botão no topo direito.

---

## Estrutura do pacote

```
pt-2026/
├── index.html              ← o app (HTML + CSS + JS num arquivo só)
├── manifest.webmanifest    ← config PWA (nome, cores, ícones)
├── sw.js                   ← service worker (cache offline)
├── icons/                  ← ícones nas resoluções iOS/Android/Favicon
└── README.md
```

---

## Quem usa

Cada um dos quatro (Caio, Amanda, Lucas, Bruna) pode instalar separadamente. Cada celular guarda seu próprio checklist e preferências (nada é compartilhado entre aparelhos).

---

## Detalhes de design

- Paleta off-white quente + verde-oliva + terracota + ouro pálido (atmosfera mediterrânea sóbria)
- Tipografia Fraunces (serif editorial) + Inter (sans body)
- Ícones SVG inline (sem dependências externas)
- Fotos de capa via Unsplash com fallback para ilustrações SVG quando offline
- Acessibilidade: contraste WCAG AA, foco visível, alvos de toque ≥ 44 px

---

Boa viagem.
