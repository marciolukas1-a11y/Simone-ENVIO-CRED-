# ENVIO CRED — app Android

App de CRM para a ENVIO CRED (empréstimos pessoais e venda de objetos), usado
pela Simone pelo celular. Construído com [Capacitor](https://capacitorjs.com/)
em cima do protótipo HTML aprovado — mesmo visual, agora com dados persistidos
de verdade (SQLite) em vez de `localStorage` de navegador.

> Status desta entrega (Fase 1): o APK de **debug** foi compilado e testado
> estaticamente (ver seção "O que foi testado" abaixo), mas **ainda não foi
> instalado nem testado num celular real** — isso precisa ser feito antes de
> considerar a Fase 1 pronta de verdade. O ambiente onde isso foi construído
> não tem um celular Android nem emulador conectado.

## Estrutura

```
envio-cred-app/
├── www/                  # Front-end (HTML/CSS/JS simples, sem framework)
│   ├── index.html
│   ├── fonts/             # Familjen Grotesk, Public Sans, IBM Plex Mono (embutidas, sem internet)
│   └── js/
│       ├── storage.js     # SQLite (dados + configurações)
│       ├── whatsapp.js     # Ponte para o plugin nativo WhatsAppOpener
│       └── app.js          # Lógica do app (clientes, funil, simulador, objetos)
├── android/                # Projeto Android gerado pelo Capacitor
│   └── app/src/main/java/com/enviocred/crm/
│       ├── MainActivity.java
│       └── WhatsAppOpenerPlugin.java   # Abre WhatsApp Business > comum > navegador
├── capacitor.config.json
└── package.json
```

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

- ✅ Compila sem erros (`./gradlew assembleDebug` — sucesso, APK gerado,
  13,4 MB, `com.enviocred.crm`, `minSdkVersion 24`, `targetSdkVersion 36`).
- ✅ Estrutura do APK validada com `aapt dump badging` (nome do pacote,
  rótulo "ENVIO CRED", permissões declaradas corretas).
- ✅ Fontes embutidas localmente (18 arquivos `.woff2`, ~220 KB no total,
  sem nenhuma referência a `fonts.googleapis.com` no HTML final).
- ❌ **Não testado num celular real** — não instalei, não abri as 4 abas,
  não cadastrei cliente, não testei os botões de WhatsApp, não testei
  tema claro/escuro no aparelho de verdade. Este ambiente de build não
  tem celular Android nem emulador conectado (sem suporte a KVM).

**Preciso que você instale esse APK de debug no seu celular e confira, pelo
menos:**

- [ ] Abre sem internet e sem travar
- [ ] As 4 abas (Clientes, Funil, Simulador, Objetos) funcionam
- [ ] Cadastrar um cliente novo e fechar/abrir o app de novo — o cliente
      continua lá (prova que não é mais `localStorage` de navegador)
- [ ] Botão de WhatsApp abre o **WhatsApp Business** (se você tiver os dois
      instalados) e não dentro do app
- [ ] Tema muda sozinho se você mudar claro/escuro nas configurações do
      Android
- [ ] Botão **Config** no topo abre a tela de nome de quem atende / taxa
      padrão / endereço do servidor
- [ ] Backup → "Gerar arquivo de backup" abre a tela de compartilhar do
      Android

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
