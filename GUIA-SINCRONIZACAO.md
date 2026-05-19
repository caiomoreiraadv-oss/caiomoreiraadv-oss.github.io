# Guia: como mandar meu trabalho do computador para a web

> Escrito em linguagem simples, sem termos técnicos. Siga na ordem.

---

## A ideia em uma frase

Seu trabalho só "viaja" entre o seu notebook, outras máquinas e o
Claude Code web quando ele está guardado no **GitHub**. O GitHub é
um cofre na internet. Tudo que estiver no cofre, você pega de
qualquer lugar. Tudo que ficar só no seu computador, fica preso lá.

---

## Por que uma pasta do Drive não resolve sozinha

O Google Drive guarda arquivos, mas o Claude Code web **não enxerga
o seu Drive**. Ele só sabe ler o "cofre" do GitHub. Então usar só o
Drive não faz o trabalho chegar na web.

A boa notícia: existe um programa gratuito que faz uma pasta normal
do seu computador ir para o GitHub sozinha, com 2 cliques. Ele se
chama **GitHub Desktop**. É tudo com botões, você não digita comandos.

---

## PARTE 1 — Preparar (você faz isto só UMA vez)

1. Abra o navegador e vá em: https://desktop.github.com
2. Clique em **Download** e instale o programa (é como instalar
   qualquer programa: avançar, avançar, concluir).
3. Abra o GitHub Desktop. Ele vai pedir para você entrar com a sua
   conta do GitHub (o mesmo usuário/senha do site github.com).
4. No menu de cima, clique em **File → Clone repository**
   (Arquivo → Clonar repositório).
5. Vai aparecer uma lista. Escolha o repositório
   **caiomoreiraadv-oss.github.io**.
6. Em "Local path" (caminho local), ele sugere uma pasta no seu
   computador. Pode deixar a sugestão ou escolher uma pasta sua.
   **Anote onde é essa pasta** — é nela que você vai trabalhar.
7. Clique em **Clone**. Pronto: agora existe uma pasta no seu
   computador que está ligada ao cofre da internet.

---

## PARTE 2 — A rotina do dia a dia (toda vez que trabalhar)

### Antes de começar a trabalhar (puxar o que tem de mais novo)

1. Abra o GitHub Desktop.
2. No topo, clique no botão **Fetch origin**. Se aparecer
   **Pull origin**, clique nele. Isso baixa para o seu computador
   tudo que foi feito na web ou em outra máquina.

> Faça isso SEMPRE antes de começar, para não trabalhar em cima de
> uma versão velha.

### Trabalhe normalmente

3. Abra a pasta que você anotou na Parte 1 e edite seus arquivos
   como sempre (no editor que você usa).

### Ao terminar (mandar seu trabalho para o cofre)

4. Volte ao GitHub Desktop. Ele já vai mostrar, sozinho, a lista do
   que você mudou.
5. No canto de baixo à esquerda, tem uma caixa de texto. Escreva
   em poucas palavras o que você fez (ex.: "ajustei a tela inicial").
6. Clique no botão azul **Commit to claude/clarify-desktop-access-CAG4u**.
7. Depois clique em **Push origin** (no topo). Pronto — seu trabalho
   foi para o cofre da internet e já pode ser usado no Claude Code web.

> Regra de ouro: **nunca termine o dia sem clicar em Commit e Push.**
> O que não foi enviado, não viaja com você.

---

## PARTE 3 — Trazer de volta o que o Claude fez na web

Quando você pedir mudanças no Claude Code web, ele guarda tudo no
cofre. Para isso aparecer no seu computador:

1. Abra o GitHub Desktop.
2. Clique em **Fetch origin** e depois em **Pull origin**.
3. Pronto: as mudanças feitas na web agora estão na sua pasta.

---

## Resumo de bolso

- **Começar a trabalhar:** GitHub Desktop → Fetch / Pull
- **Terminar de trabalhar:** escrever o que fez → Commit → Push
- **Pegar o que o Claude fez na web:** Fetch / Pull
- **A pasta certa para trabalhar:** a que você anotou na Parte 1
- **Branch (sempre a mesma):** claude/clarify-desktop-access-CAG4u

Se algo der errado ou aparecer uma mensagem que você não entende,
tire um print da tela e me mostre no Claude Code web — eu te explico
o próximo passo.
