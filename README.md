# ENVIO CRED — app Android

App de CRM para a ENVIO CRED (empréstimos pessoais e venda de objetos), usado
pela Simone pelo celular. Construído com [Capacitor](https://capacitorjs.com/)
em cima do protótipo HTML aprovado — mesmo visual, agora com dados persistidos
de verdade (SQLite) em vez de `localStorage` de navegador.

> **Fase 1 (CRM local): testada e aprovada no celular por você.**
> **Fase 2 (app, lado cliente do motor de atendimento — aba Conversas e modo
> copiloto): APK de debug compilado com sucesso, mas ainda não testado num
> celular real** — precisa do servidor (`server/`) rodando pra testar de
> verdade (ver `server/README.md`).

## Estrutura

```
envio-cred-app/
├── www/                  # Front-end (HTML/CSS/JS simples, sem framework)
│   ├── index.html
│   ├── fonts/             # Familjen Grotesk, Public Sans, IBM Plex Mono (embutidas, sem internet)
│   └── js/
│       ├── storage.js     # SQLite (dados + configurações)
│       ├── whatsapp.js     # Ponte para o plugin nativo WhatsAppOpener
│       ├── api.js          # Cliente HTTP pro servidor (server/) -- Fase 2
│       ├── shareIntent.js  # Modo copiloto: escuta texto compartilhado -- Fase 2
│       └── app.js          # Lógica do app (clientes, funil, simulador, objetos, conversas)
├── android/                # Projeto Android gerado pelo Capacitor
│   └── app/src/main/java/com/enviocred/crm/
│       ├── MainActivity.java
│       ├── WhatsAppOpenerPlugin.java   # Abre WhatsApp Business > comum > navegador
│       └── ShareIntentPlugin.java      # Recebe texto compartilhado (modo copiloto) -- Fase 2
├── server/                 # Motor de atendimento por IA no WhatsApp -- ver server/README.md
├── capacitor.config.json
└── package.json
```

## Novidades da Fase 2 neste app (precisam do servidor rodando pra testar)

- **Aba Conversas** (5ª aba): lista as conversas que o motor de atendimento
  está tendo no WhatsApp, mostra se é a IA ou a Simone atendendo, e tem
  botões **Assumir conversa** / **Devolver para a IA** / **Responder**.
  Tem também o botão **Pausar IA** / **Retomar IA** (interruptor geral,
  desliga a IA na hora pra todo mundo).
- **Modo copiloto**: compartilhe um texto (ex: copiou uma mensagem do
  WhatsApp Business) pro app **ENVIO CRED** pelo menu "Compartilhar" do
  Android — abre uma tela pedindo uma sugestão de resposta à IA, que você
  copia ou abre direto no WhatsApp Business. Nada é enviado sozinho nesse
  modo.
- Em **Config**, novo campo **Token da API do servidor** — precisa bater
  com o `APP_API_TOKEN` configurado no `server/.env`.

## Pré-requisitos pra compilar

- **Node.js** 18+ e **npm**
- **Java JDK** 17+ (JDK 21 testado)
- **Android SDK** — mais fácil instalar via [Android Studio](https://developer.android.com/studio); configure a variável `ANDROID_HOME` apontando pra pasta do SDK.

```bash
npm install
```

## Gerar o APK de debug

```bash
npx cap sync android
cd android
./gradlew assembleDebug
```

O arquivo sai em:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Esse APK já vem assinado automaticamente com a chave de debug do Android
(serve pra instalar e testar, mas o Android avisa "não verificado" — normal
pra debug).

## Gerar o APK release (assinado, pronto pra distribuir)

O APK release precisa de uma **keystore** (um arquivo que guarda a chave que
assina o app como seu de verdade). Isso você só faz **uma vez**, e guarda
**pra sempre** em lugar seguro (se perder, nunca mais consegue atualizar o
app com a mesma identidade — tem que trocar todo mundo pra um app "novo").

### 1. Criar a keystore (uma vez só)

```bash
keytool -genkeypair -v -keystore enviocred-release.keystore \
  -alias enviocred -keyalg RSA -keysize 2048 -validity 10000
```

Ele vai pedir uma senha (anote em lugar seguro, tipo um gerenciador de
senhas) e algumas informações (nome, organização — pode preencher com dados
da ENVIO CRED). **Não comita esse arquivo `.keystore` no Git** — o
`.gitignore` já está configurado pra ignorá-lo, mas confira antes de subir.

### 2. Guardar a senha fora do repositório

Crie um arquivo `android/keystore.properties` (ele também está no
`.gitignore`, não vai pro Git):

```properties
storeFile=../../enviocred-release.keystore
storePassword=SUA_SENHA_AQUI
keyAlias=enviocred
keyPassword=SUA_SENHA_AQUI
```

### 3. Gerar o APK assinado

```bash
cd android
./gradlew assembleRelease
```

Sai em `android/app/build/outputs/apk/release/app-release.apk`.

> Se preferir, me avise quando for publicar de verdade que eu ajusto o
> `build.gradle` pra ler automaticamente o `keystore.properties` nesse passo
> (hoje o projeto ainda não está configurado pra assinatura release
> automática — isso é trabalho de quando a Fase 1 estiver validada no
> celular).

## Instalar no celular

1. Copie o `app-debug.apk` (ou `app-release.apk`) pro celular (cabo USB,
   WhatsApp pra você mesmo, Google Drive, etc.).
2. Abra o arquivo no celular. O Android vai bloquear a instalação na
   primeira vez — toque em **Configurações** na mensagem que aparece.
3. Ative **"Permitir desta fonte"** (ou "Instalar apps desconhecidos") pro
   app que você usou pra abrir o arquivo (Arquivos, Chrome, WhatsApp...).
4. Volte e toque em **Instalar**.

## O que foi testado

**Fase 1** (clientes, funil, simulador, objetos, backup): testada por você
no celular — aprovada.

**Fase 2 (parte do app — aba Conversas e modo copiloto), build atual:**

- ✅ Compila sem erros (`./gradlew assembleDebug` — sucesso, APK gerado,
  13,4 MB, `com.enviocred.crm`).
- ✅ Estrutura do APK validada com `aapt dump badging`.
- ❌ **Não testado num celular real** — mesma limitação de sempre, este
  ambiente de build não tem celular Android nem emulador conectado.

**Preciso que você instale esse APK novo e confira, além do que já
funcionava na Fase 1:**

- [ ] A barra de baixo agora tem 5 abas (a nova é **Conversas**)
- [ ] Em **Config**, o novo campo "Token da API do servidor" aparece
- [ ] Com o servidor (`server/`) rodando e endereço/token configurados, a
      aba Conversas carrega (mesmo vazia, sem erro)
- [ ] Botão **Pausar IA** / **Retomar IA** na aba Conversas muda de cor e
      texto ao tocar
- [ ] **Modo copiloto**: copia qualquer texto em outro app, usa o menu
      "Compartilhar" do Android, escolhe **ENVIO CRED** na lista — abre a
      tela de sugestão com o texto já preenchido

Qualquer coisa que não funcionar do jeito esperado, me manda o que
aconteceu (e se possível um print) que eu corrijo.

## Migração do protótipo antigo (navegador)

Se você tinha dados no protótipo HTML antigo (que ficavam no navegador),
abra **Backup** nesse app novo, cole o texto que você copiou de lá na caixa
"copie/cole o texto" e toque em **Restaurar do texto**.

## Próximas fases (fora do escopo deste README)

- **Fase 2**: motor de atendimento por IA no WhatsApp (Node.js + Baileys,
  rodando localmente no celular da empresa via Termux), conectado à Groq e
  à SearchApi.io.
- **Fase 3**: ligar este app ao motor da Fase 2 (campo "Endereço do
  servidor" em Configurações já existe, esperando essa integração).
