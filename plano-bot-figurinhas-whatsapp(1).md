# Plano — Bot de Figurinhas para WhatsApp

Bot que recebe imagem, vídeo ou GIF no WhatsApp e responde com a mídia convertida em figurinha (sticker), estática ou animada.

**Stack definida:**
- Conexão WhatsApp: **Baileys** (não-oficial)
- API/orquestração: **Fastify** (Node.js)
- Persistência: **Banco de dados** (SQLite em dev, Postgres em produção) + fila de processamento
- Hospedagem: **VPS próprio via Docker**

---

## 1. Visão geral da arquitetura

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  WhatsApp   │◄───►│  Serviço Baileys  │────►│   Fastify   │
│  (usuário)  │     │  (socket/sessão)  │     │  (API HTTP) │
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                      │
                                   ┌──────────────────┼──────────────────┐
                                   ▼                  ▼                  ▼
                            ┌────────────┐    ┌──────────────┐   ┌─────────────┐
                            │  Fila (Bull │    │  Postgres/   │   │  Storage    │
                            │  MQ+Redis)  │    │  SQLite      │   │  (disco/S3) │
                            └──────┬─────┘    └──────────────┘   └─────────────┘
                                   ▼
                          ┌─────────────────┐
                          │ Worker de mídia  │
                          │ (ffmpeg + sharp) │
                          └─────────────────┘
```

**Por que separar Baileys do Fastify?**
Baileys mantém uma conexão WebSocket persistente e stateful (sessão de autenticação). Fastify serve como camada HTTP para:
- Expor endpoints administrativos (status da sessão, QR code, métricas, health check).
- Orquestrar a fila de processamento de mídia.
- Servir um dashboard simples (opcional) para acompanhar o bot.

O processamento pesado de mídia (ffmpeg) roda em **workers separados** consumindo uma fila, para não travar o event loop nem a conexão do WhatsApp.

---

## 2. Stack técnica detalhada (versões atuais — pesquisado em ago/2026)

| Camada | Tecnologia | Versão recomendada agora | Observação |
|---|---|---|---|
| Runtime | Node.js | **24.x (Active LTS)** | Node 24 é a linha LTS ativa atual; Node 26 ainda é "Current" (só vira LTS em out/2026) — evite em produção por enquanto. Node 22 segue em manutenção até abr/2027. |
| Framework HTTP | Fastify | **^5.11.2** | Última estável da série v5 |
| WhatsApp | `@whiskeysockets/baileys` | **^6.17.16** (estável) ou `7.0.0-rc14` (bleeding edge) | A v7 já é a tag "latest" no npm mas ainda é **release candidate** com breaking changes grandes (guia de migração: whiskey.so/migrate-latest). Para produção, recomendo começar na 6.17.16 (última estável pré-v7) e migrar para v7 quando ela virar estável. |
| Fila | BullMQ + Redis | **BullMQ ^6.0.8** + Redis **8.10** | BullMQ v6 (lançado há poucos dias) introduziu backends plugáveis (Redis/Postgres) — é novo, avalie fixar em `^5.78.0` se preferir mais maturidade. Redis 8.x voltou a ser open source (AGPLv3) desde a v8.0. |
| Banco de dados | PostgreSQL (prod) / SQLite (dev) via Prisma ORM | **PostgreSQL 18.4** + **Prisma ^7.8.0** | Postgres 19 está em beta (não usar ainda). Prisma 7 é a major atual: client sem Rust, WASM no thread principal, bundles ~90% menores. |
| Conversão de mídia | `ffmpeg` (via `fluent-ffmpeg` ou `child_process`) | ffmpeg estável da distro (Debian/Ubuntu 24.04 traz 6.x/7.x) | Instalado via `apt-get` na imagem Docker, não via npm |
| Imagem estática | `sharp` | **^0.35.3** | Requer Node >= 20.9 |
| Metadados de sticker | `node-webpmux` | **^3.2.1** | Reimplementação pura JS/WASM do webpmux — mais confiável que wrappers de sticker abandonados (ex: `wa-sticker-formatter` não recebe update há ~3 anos, evitar) |
| Extração de mídia de tweet | `yt-dlp` (binário Python) | última via `pip install -U yt-dlp` (build **2026.07.04** ou mais recente) | Atualiza rápido por causa de mudanças no X; fixar versão exata é contraproducente, prefira sempre puxar a mais recente no build da imagem |
| Containerização | Docker + Docker Compose | Node **24-alpine** como base | Empacota app + Redis + Postgres juntos |
| Logs | Pino (nativo do Fastify) | — | Performance, logs estruturados em JSON |
| Validação | Zod ou Fastify JSON Schema | — | Validação de payloads e variáveis de ambiente |
| Frontend do admin | React + Vite | **React ^19.x** + **Vite ^7.x** | SPA pequena, build estático servido pelo próprio Fastify (`@fastify/static`) — sem necessidade de servidor Node separado pro frontend |
| Auth do admin | `@fastify/jwt` + `bcrypt`/`argon2` | — | Login único (usuário/senha), token JWT em cookie httpOnly |
| Gráficos (métricas) | `recharts` | — | Componentes de gráfico prontos pro dashboard React |
| QR code como imagem | `qrcode` (npm) | **^1.5.4** | Converte a string de pareamento do Baileys em PNG base64 pro admin escanear |

**Por que React SPA e não server-side rendering pro admin?**
O painel precisa de coisas dinâmicas em tempo real (status da conexão, QR code atualizando, métricas), então uma SPA com polling/websocket fica mais natural do que recarregar páginas. Como o projeto é de porte pequeno/médio (uso pessoal, um único operador), uma SPA simples em React + Vite é suficiente — sem necessidade de Next.js ou algo mais pesado. O build final é só um bundle estático servido pela mesma API Fastify, então não adiciona um novo serviço no docker-compose.

**Nota sobre volatilidade:** boa parte dessas libs (Baileys, yt-dlp, BullMQ v6) está em movimento rápido agora. Antes de rodar `npm install` de fato, vale conferir `npm view <pacote> version` para pegar o número exato do dia.

---

## 3. Estrutura de pastas

```
whatsapp-sticker-bot/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── server.ts                 # bootstrap do Fastify
│   ├── config/
│   │   └── env.ts                # validação de env vars
│   ├── whatsapp/
│   │   ├── connection.ts         # inicialização do socket Baileys
│   │   ├── auth-state.ts         # persistência da sessão (multi-file ou DB)
│   │   ├── message-handler.ts    # roteia mensagens recebidas
│   │   └── sender.ts             # funções de envio (sticker, texto, erro)
│   ├── queue/
│   │   ├── media-queue.ts        # definição da fila BullMQ
│   │   └── media-worker.ts       # worker que processa a conversão
│   ├── sources/
│   │   ├── direct-media.ts       # extrai buffer de imageMessage/videoMessage do Baileys
│   │   └── tweet-extractor.ts    # detecta link de tweet e baixa mídia via yt-dlp
│   ├── media/
│   │   ├── convert-image.ts      # sharp: imagem → webp estático
│   │   ├── convert-video.ts      # ffmpeg: vídeo/gif → webp animado
│   │   └── add-metadata.ts       # injeta nome do pack/autor
│   ├── commands/
│   │   ├── command-matcher.ts    # confere texto recebido contra comandos cadastrados
│   │   └── download-mode.ts      # trata "download <link>" / "baixar <link>"
│   ├── moderation/
│   │   ├── ban-check.ts          # confere se o remetente está banido
│   │   └── maintenance-check.ts  # confere se o bot está em modo manutenção
│   ├── admin/
│   │   ├── auth.ts               # login, geração/validação de JWT
│   │   ├── connection-manager.ts # status, QR code, trocar número, logout/reset de sessão
│   │   └── plugin.ts             # registra rotas /admin/api/* no Fastify
│   ├── db/
│   │   ├── client.ts             # instância do Prisma
│   │   └── repositories/
│   │       ├── message.repository.ts
│   │       ├── sticker.repository.ts
│   │       ├── ban.repository.ts
│   │       ├── command.repository.ts
│   │       └── setting.repository.ts
│   ├── routes/
│   │   ├── health.ts             # GET /health
│   │   ├── status.ts             # GET /status (conexão, QR code) — legado, será absorvido pelo /admin/api
│   │   ├── stats.ts              # GET /stats (métricas de uso) — idem
│   │   └── admin/
│   │       ├── auth.routes.ts        # POST /admin/api/auth/login
│   │       ├── connection.routes.ts  # GET /admin/api/status, /qr, POST /switch-number, /logout
│   │       ├── bans.routes.ts        # CRUD /admin/api/bans
│   │       ├── commands.routes.ts    # CRUD /admin/api/commands
│   │       ├── settings.routes.ts    # GET/PUT /admin/api/settings (modo manutenção etc.)
│   │       └── metrics.routes.ts     # GET /admin/api/metrics, /admin/api/history
│   └── utils/
│       ├── logger.ts
│       └── mime.ts               # detecção de tipo de mídia
├── frontend/                     # SPA React do painel admin
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx         # status da conexão + QR code
│   │   │   ├── Bans.tsx              # lista/adiciona/remove números banidos
│   │   │   ├── Commands.tsx          # CRUD de comandos personalizados
│   │   │   ├── History.tsx           # histórico de figurinhas geradas
│   │   │   └── Settings.tsx          # modo manutenção, branding do pack
│   │   └── api/
│   │       └── client.ts             # wrapper de fetch com o JWT
│   └── dist/                         # build final, servido pelo Fastify via @fastify/static
├── storage/                      # arquivos temporários (gitignored)
├── sessions/                     # sessão do Baileys (gitignored)
└── tests/
```

---

## 4. Modelo de dados (Prisma / schema inicial)

```prisma
model Contact {
  id          String   @id @default(cuid())
  jid         String   @unique   // ID do WhatsApp (ex: 5511999999999@s.whatsapp.net)
  name        String?
  createdAt   DateTime @default(now())
  stickers    StickerRequest[]
}

model StickerRequest {
  id            String   @id @default(cuid())
  contactId     String
  contact       Contact  @relation(fields: [contactId], references: [id])
  mediaType     MediaType
  source        MediaSource @default(DIRECT_UPLOAD)
  sourceUrl     String?        // URL do tweet, quando aplicável
  status        RequestStatus @default(PENDING)
  originalPath  String?        // caminho temporário do arquivo recebido
  resultPath    String?        // caminho do .webp gerado
  errorMessage  String?
  createdAt     DateTime @default(now())
  processedAt   DateTime?
}

enum MediaType {
  IMAGE
  VIDEO
  GIF
}

enum MediaSource {
  DIRECT_UPLOAD   // usuário mandou a mídia direto no chat
  TWEET_LINK      // usuário mandou um link de tweet (X/Twitter)
}

enum RequestStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

// --- Novos modelos pro painel admin ---

model AdminUser {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  lastLoginAt  DateTime?
}

model BannedContact {
  id        String   @id @default(cuid())
  jid       String   @unique
  reason    String?
  bannedAt  DateTime @default(now())
  bannedBy  String?  // username do admin que baniu
}

model Command {
  id          String   @id @default(cuid())
  trigger     String   @unique   // ex: "!ajuda", "menu", "comandos"
  matchType   MatchType @default(EXACT)
  responseText String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum MatchType {
  EXACT       // texto precisa ser exatamente igual ao trigger
  STARTS_WITH // texto precisa começar com o trigger
  CONTAINS    // trigger aparece em qualquer lugar do texto
}

model Setting {
  key       String   @id       // ex: "maintenance_mode", "maintenance_message", "sticker_pack_name"
  value     String
  updatedAt DateTime @updatedAt
}
```

Isso permite: histórico de uso por contato, métricas (quantas figurinhas geradas, taxa de erro, tempo médio de processamento), reprocessamento de falhas, gestão de banidos, comandos configuráveis pelo admin e chaves de configuração dinâmicas (modo manutenção, branding do pack) sem precisar redeployar o bot.

---

## 5. Fluxo de processamento (passo a passo)

**Ordem de checagem em `message-handler.ts` (do mais barato/restritivo pro mais pesado):**

0. **Ban check** — `moderation/ban-check.ts` consulta `BannedContact` pelo `jid` do remetente. Se banido → mensagem é ignorada silenciosamente (ou responde uma vez com aviso, configurável), e nada mais é processado.
0.1. **Modo manutenção** — `moderation/maintenance-check.ts` lê `Setting["maintenance_mode"]`. Se `true` → responde com a mensagem configurada em `Setting["maintenance_message"]` (ex: "Bot em manutenção, volta já já 🔧") e encerra, sem cair nos passos seguintes.
0.2. **Comando personalizado** — `commands/command-matcher.ts` compara o texto recebido contra os registros ativos de `Command` (respeitando `matchType`). Se bater → responde com `responseText` cadastrado no admin e encerra. Isso cobre o caso de "ajuda"/"menu"/qualquer trigger que você definir no painel.
0.3. **Modo download** — `commands/download-mode.ts` verifica se o texto começa com `download ` ou `baixar ` seguido de uma URL. Se sim → segue para download da mídia (mesma lógica dos extratores existentes), mas **pula a conversão pra figurinha** e envia o arquivo original de volta (ver seção 13).

Se nenhuma das checagens acima capturar a mensagem, segue o fluxo normal de figurinha:

1. **Recebimento** — Baileys dispara evento `messages.upsert`.
2. **Filtro / detecção da fonte** — `message-handler.ts` verifica dois casos:
   - Mensagem contém `imageMessage`, `videoMessage` ou `stickerMessage`/gif (vídeo com `gifPlayback: true`) → fonte `DIRECT_UPLOAD`.
   - Mensagem é texto contendo um link de tweet (regex `(twitter\.com|x\.com)\/\w+\/status\/\d+`) → fonte `TWEET_LINK`.
3. **Download**:
   - `DIRECT_UPLOAD`: Baileys baixa o buffer da mídia (`downloadMediaMessage`).
   - `TWEET_LINK`: `tweet-extractor.ts` chama o binário `yt-dlp` via `child_process` passando a URL do tweet, salva o arquivo baixado (vídeo, gif ou imagem) em `storage/tmp/`.
4. **Persistência do pedido** — grava um registro `StickerRequest` com status `PENDING`, `source` e (quando aplicável) `sourceUrl`, e salva o buffer temporariamente em `storage/`.
5. **Enfileiramento** — adiciona um job na fila BullMQ com o ID do request.
6. **Worker consome o job**:
   - Atualiza status para `PROCESSING`.
   - Se imagem estática → `sharp`: resize/pad para 512x512, exporta `.webp` (<100KB idealmente, limite 500KB).
   - Se vídeo/gif → `ffmpeg`: corta para até 6s, reduz fps se necessário, gera `.webp` animado dentro do limite de 500KB (ajustando qualidade/dimensão dinamicamente se passar do limite).
   - Adiciona metadados (nome do pack, autor) via `node-webpmux`.
   - Atualiza `StickerRequest` para `DONE` com `resultPath`.
7. **Notificação** — worker publica evento (ou o handler faz polling/pub-sub) avisando o serviço Baileys para enviar o sticker de volta ao remetente.
8. **Envio** — `sender.ts` chama `sock.sendMessage(jid, { sticker: buffer })`.
9. **Limpeza** — arquivos temporários são removidos após confirmação de envio (job de limpeza periódica como fallback).
10. **Erro** — se qualquer etapa falhar, status vira `FAILED`, mensagem de erro amigável é enviada ao usuário, e o erro é logado.

---

## 6. Endpoints Fastify

**Públicos/infra (sem autenticação):**

| Método | Rota | Função |
|---|---|---|
| GET | `/health` | Health check para orquestrador (Docker/monitoramento) |

**Painel admin (autenticados via JWT, prefixo `/admin/api`):**

| Método | Rota | Função |
|---|---|---|
| POST | `/admin/api/auth/login` | Login (usuário/senha) → retorna JWT em cookie httpOnly |
| POST | `/admin/api/auth/logout` | Invalida a sessão do admin |
| GET | `/admin/api/status` | Status da conexão Baileys (conectado, aguardando QR, desconectado) |
| GET | `/admin/api/status/qr` | QR code atual como imagem PNG/base64, para parear o número |
| POST | `/admin/api/status/switch-number` | Desloga a sessão atual e inicia um novo pareamento (novo QR) |
| POST | `/admin/api/status/logout` | Desconecta o bot do WhatsApp sem trocar de número (reautentica depois) |
| GET | `/admin/api/bans` | Lista números banidos |
| POST | `/admin/api/bans` | Bane um número (`jid`, `reason`) |
| DELETE | `/admin/api/bans/:id` | Remove um banimento |
| GET | `/admin/api/commands` | Lista comandos personalizados cadastrados |
| POST | `/admin/api/commands` | Cria um comando (`trigger`, `matchType`, `responseText`) |
| PUT | `/admin/api/commands/:id` | Edita um comando existente |
| DELETE | `/admin/api/commands/:id` | Remove um comando |
| GET | `/admin/api/settings` | Lê configurações atuais (modo manutenção, mensagem de manutenção, branding do pack) |
| PUT | `/admin/api/settings` | Atualiza configurações (ex: liga/desliga modo manutenção) |
| GET | `/admin/api/metrics` | Métricas agregadas (total de figurinhas, taxa de erro, uso por dia/semana) |
| GET | `/admin/api/history` | Histórico paginado de `StickerRequest` (com filtros por contato, status, data) |
| GET | `/admin/api/history/:id` | Detalhe de um pedido específico |

A SPA React consome exclusivamente essas rotas `/admin/api/*`; o build estático (`frontend/dist`) é servido pelo próprio Fastify via `@fastify/static` em `/admin` (ex: acessar `https://seu-dominio/admin` abre o painel).

---

## 7. Painel administrativo web

**Objetivo:** uma SPA React protegida por login, pra você gerenciar o bot sem precisar mexer em terminal/banco na mão.

**O que o painel faz:**

- **Dashboard**: mostra o status atual da conexão (`conectado` / `aguardando QR` / `desconectado`), e quando estiver aguardando pareamento, renderiza o **QR code como imagem** (gerado via lib `qrcode` a partir da string que o Baileys emite no evento `connection.update`).
- **Trocar número**: botão que chama `POST /admin/api/status/switch-number`. Isso limpa o estado de autenticação atual (`sessions/`), reinicia a conexão Baileys do zero e gera um novo QR code pra você escanear com o novo número.
- **Modo manutenção**: toggle que grava `Setting["maintenance_mode"] = "true"/"false"`. Enquanto ativo, o bot responde qualquer mensagem recebida com uma mensagem fixa configurável (ex: "Voltamos já 🔧"), sem processar mídia nem comandos.
- **Banir número**: formulário simples (`jid` + motivo opcional) que grava em `BannedContact`. A partir daí, esse número é ignorado pelo bot (ver seção 5, passo 0).
- **Histórico**: tabela paginada de `StickerRequest`, com filtros por contato, status (`DONE`/`FAILED`), tipo de mídia e período.
- **Métricas**: gráficos simples (via `recharts`) — total de figurinhas por dia, taxa de erro, proporção imagem/vídeo/tweet como fonte.
- **Comandos personalizados**: CRUD completo (ver seção 8).

### Como funciona a troca de número / QR code por trás dos panos

O `connection-manager.ts` centraliza tudo que hoje está espalhado em `whatsapp/connection.ts`, expondo:

```typescript
interface ConnectionManager {
  getStatus(): 'connected' | 'awaiting_qr' | 'disconnected';
  getCurrentQrAsPngBase64(): string | null;
  switchNumber(): Promise<void>;  // limpa sessions/, reinicia socket, gera novo QR
  logout(): Promise<void>;        // desconecta sem apagar sessão (reconecta sozinho depois)
}
```

Isso evita que as rotas do admin mexam diretamente no socket do Baileys — elas só chamam esses métodos, e o `connection-manager` decide como reiniciar a conexão internamente (importante porque só pode existir **uma instância ativa do socket Baileys** por processo).

### Autenticação do painel

- Login único (usuário/senha) gravado em `AdminUser`, senha com hash `argon2` (mais recomendado que bcrypt hoje em dia por resistência a ataque de GPU).
- Sessão via JWT assinado, guardado em **cookie httpOnly + secure** (não em localStorage, pra evitar XSS pegando o token).
- Todas as rotas `/admin/api/*` (exceto `/auth/login`) passam por um hook `preHandler` do Fastify que valida o JWT.
- **Importante**: o painel não pode ficar exposto sem proteção extra na internet. Recomendo colocar atrás de um reverse proxy (ex: Caddy/nginx) com HTTPS obrigatório, e opcionalmente restringir por IP/VPN se só você for usar.

---

## 8. Comandos personalizados (definidos por você no painel)

Permite cadastrar palavras-chave que disparam uma resposta fixa de texto, sem passar pelo pipeline de figurinha — útil pra um comando tipo "ajuda"/"menu" listando o que o bot faz.

**Como cadastrar:** no painel, tela "Comandos" → formulário com:
- `trigger`: o texto que ativa o comando (ex: `ajuda`, `!menu`, `oi`)
- `matchType`: `EXACT` (tem que ser exatamente igual), `STARTS_WITH` (mensagem começa com isso) ou `CONTAINS` (aparece em qualquer parte)
- `responseText`: o texto que o bot manda de volta (suporta emoji e quebras de linha)
- `isActive`: liga/desliga sem precisar deletar

**Exemplo de uso:** cadastrar `trigger: "ajuda"`, `matchType: EXACT`, `responseText: "🤖 *Comandos disponíveis:*\n\n📎 Manda uma imagem/vídeo/gif → vira figurinha\n🐦 Manda link de tweet → vira figurinha\n⬇️ Manda \"download <link>\" → recebe a mídia sem virar figurinha"`.

**Prioridade no fluxo:** comandos são checados **antes** do modo download e antes do pipeline de figurinha (passo 0.2 da seção 5). Isso significa que se você cadastrar um trigger que colide com algo tipo "download" por engano, o comando personalizado ganha — vale ter uma validação no formulário do admin avisando se o trigger colide com as palavras reservadas `download`/`baixar`.

---

## 9. Modo "download" (mídia sem virar figurinha)

**Comportamento:** usuário manda `download <link>` ou `baixar <link>` → o bot baixa a mídia (reaproveitando os mesmos extratores da seção de tweets) e **envia o arquivo original de volta**, como vídeo/imagem/documento normal — sem passar pelo `ffmpeg`/`sharp`/conversão pra webp.

**Fluxo (`commands/download-mode.ts`):**

1. Regex captura o padrão: `/^(download|baixar)\s+(https?:\/\/\S+)/i`.
2. A URL extraída passa pelo mesmo `tweet-extractor.ts` (ou, se você quiser generalizar depois pra outros sites além do X, o próprio `yt-dlp` já suporta [centenas de sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) — a lógica de extração não muda, só o destino final do arquivo muda).
3. Detecta o tipo do arquivo baixado pela extensão/mimetype (`utils/mime.ts`).
4. Envia de volta via Baileys **sem** chamar o pipeline de conversão:
   - Vídeo → `sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4' })`
   - Imagem → `sock.sendMessage(jid, { image: buffer })`
   - Gif → `sock.sendMessage(jid, { video: buffer, gifPlayback: true })`
5. Grava um `StickerRequest` com um novo status/flag pra diferenciar de figurinha normal (sugestão: adicionar `isDownloadOnly: Boolean` no schema, ou criar um enum `RequestType { STICKER, DOWNLOAD }` — fica mais simples de filtrar no histórico do painel depois).

**Ajuste no schema (`StickerRequest`):**

```prisma
model StickerRequest {
  // ...campos existentes
  requestType   RequestType @default(STICKER)
}

enum RequestType {
  STICKER
  DOWNLOAD
}
```

**Limite de tamanho:** diferente da figurinha (limitada a 500KB), o modo download envia o arquivo em tamanho normal — o WhatsApp aceita até **16MB para vídeo/imagem** via Baileys sem tratamento especial (limite da própria plataforma). Vale validar isso antes de enviar e responder com erro amigável se passar do limite, ao invés de deixar o envio falhar silenciosamente.

---

## 10. Docker & deployment

**docker-compose.yml (serviços):**
- `app` — Fastify + Baileys + worker (pode ser dividido em 2 containers depois: `api` e `worker`, escalando o worker separadamente)
- `redis` — fila BullMQ
- `postgres` — banco de dados
- Volume persistente para `sessions/` (sessão do Baileys não pode ser perdida)
- Volume persistente para `storage/` (ou migrar para S3-compatible depois)

**Considerações de produção:**
- Dockerfile multi-stage (build TypeScript → imagem final enxuta, com `ffmpeg` e `python3`/`yt-dlp` instalados via `apt-get`/`pip`).
- Backup periódico do volume de `sessions/` — perder isso significa escanear QR code de novo.
- Logs estruturados (Pino) direcionados para stdout, coletados pelo Docker/host.
- Restart policy `unless-stopped` para o container do bot.
- Rate limiting simples por contato (evitar abuso/flood de mídia).
- Se o painel admin ficar exposto na internet, colocar atrás de reverse proxy com HTTPS (Caddy resolve isso quase de graça, com certificado automático).

---

## 11. Fases de implementação sugeridas

**Fase 1 — Esqueleto funcional**
- Setup do projeto (Fastify + TypeScript + Baileys básico).
- Conexão com WhatsApp, exibição de QR code via `/status/qr`.
- Echo simples: responder "recebi sua mídia" ao receber imagem.

**Fase 2 — Conversão básica**
- Pipeline de conversão de imagem estática → sticker (sharp).
- Envio do sticker de volta, sem fila ainda (síncrono).

**Fase 3 — Vídeo/GIF**
- Integração com ffmpeg para vídeo/gif → webp animado.
- Ajuste de qualidade/dimensão para respeitar limite de 500KB.

**Fase 3.5 — Extração de mídia via link de tweet**
- Instalar `yt-dlp` na imagem Docker (`apt-get install python3` + `pip install -U yt-dlp`, ou binário standalone).
- Criar `sources/tweet-extractor.ts`: recebe a URL, roda `yt-dlp -o <path> <url>` via `child_process`, retorna o caminho do arquivo baixado.
- Detectar tipo de mídia baixada (vídeo, gif ou imagem) a partir da extensão/mimetype retornado.
- Encaminhar o arquivo para o mesmo pipeline de conversão (Fase 2/3), marcando `source: TWEET_LINK` e `sourceUrl` no banco.
- Tratar casos de falha: tweet sem mídia, tweet deletado/privado, rate limit do X — responder ao usuário com mensagem de erro clara.
- (Opcional, se necessário no futuro) suporte a cookies via `--cookies-from-browser` para tweets que exigem login — avaliar só se aparecer necessidade real, pois complica a operação em VPS.

**Fase 4 — Persistência e fila**
- Modelagem Prisma, migrations.
- BullMQ + Redis, mover processamento para worker assíncrono.
- Endpoint `/stats`.

**Fase 5 — Produção**
- Dockerfile + docker-compose completo.
- Metadados de pack/autor customizáveis.
- Rate limiting, tratamento de erros robusto, logs estruturados.
- Testes automatizados (unitários no pipeline de conversão, integração na fila).

**Fase 6 — Base do painel admin**
- Modelos `AdminUser`, `Setting` no Prisma + migration.
- Login (JWT + cookie httpOnly), hook de autenticação nas rotas `/admin/api/*`.
- `connection-manager.ts`: expor status, QR code (via lib `qrcode`), switch-number, logout.
- Setup do frontend (Vite + React), tela de Login e Dashboard (status + QR code), servidos como estático pelo Fastify.

**Fase 7 — Moderação e configuração via painel**
- Modelo `BannedContact` + rotas CRUD + tela "Bans" no frontend.
- `moderation/ban-check.ts` integrado no `message-handler.ts` (passo 0 do fluxo).
- Modo manutenção: rota `/admin/api/settings` + `moderation/maintenance-check.ts` + tela "Settings" no frontend.
- Telas de "Histórico" e "Métricas" (consumindo `/admin/api/history` e `/admin/api/metrics`).

**Fase 8 — Comandos personalizados e modo download**
- Modelo `Command` + rotas CRUD + tela "Commands" no frontend.
- `commands/command-matcher.ts` integrado no `message-handler.ts` (passo 0.2).
- `commands/download-mode.ts`: regex de detecção, reuso do extrator de mídia, envio sem conversão.
- Adicionar `RequestType` (`STICKER`/`DOWNLOAD`) no schema pra diferenciar no histórico.
- Validação de tamanho de arquivo (limite de 16MB) com mensagem de erro amigável.

---

## 12. Riscos e pontos de atenção

- **Baileys não é oficial**: uso excessivo/comportamento de bot muito agressivo pode levar a banimento do número. Recomenda-se usar um número dedicado (não o principal) e implementar rate limiting.
- **Sessão do Baileys é sensível**: tratar `sessions/` como segredo (não versionar, backup seguro).
- **Limite de tamanho do sticker**: WhatsApp rejeita webp acima de 500KB — o pipeline precisa ter lógica de fallback (reduzir qualidade/fps/dimensão iterativamente).
- **ffmpeg é pesado em CPU**: em VPS modesto, processar muitos vídeos simultâneos pode gargalar — por isso a fila com concorrência limitada é importante.
- **Mudanças no protocolo do WhatsApp**: Baileys depende de engenharia reversa do protocolo; atualizações do WhatsApp podem quebrar a lib temporariamente até ser corrigida pela comunidade.
- **yt-dlp e o X/Twitter**: assim como o Baileys, o `yt-dlp` depende de engenharia reversa do lado do X — quando a plataforma muda algo, quebra até sair um novo release (geralmente rápido, a comunidade é ativa). Atualizar o binário com frequência é importante.
- **Direitos autorais em mídia de terceiros**: diferente da mídia que o próprio usuário envia, o conteúdo de um tweet pertence a outra pessoa. Vale manter esse uso como pessoal/entre amigos.
- **Baileys v7 ainda é RC**: se decidir usar a `7.0.0-rc14` (mais atual) em vez da `6.17.16` (estável), esteja preparado para breaking changes e possíveis bugs de release candidate.
- **Painel admin exposto na internet**: mesmo com login, um painel que troca o número do bot e bane usuários é um alvo interessante pra ataque de força bruta. Recomenda-se HTTPS obrigatório, rate limiting no `/admin/api/auth/login`, e considerar restringir acesso por IP/VPN já que é uso de um único operador.
- **Reuso do socket Baileys pro "switch number"**: só pode existir uma conexão ativa por processo — o `connection-manager.ts` precisa garantir que o socket antigo seja completamente encerrado (`sock.end()` / `sock.logout()`) antes de iniciar um novo pareamento, senão dá conflito de sessão.
- **Modo download pode virar "downloader genérico"**: como o `yt-dlp` suporta centenas de sites, o modo download pode receber links de qualquer lugar, não só do X. Vale decidir se quer restringir por domínio (whitelist) ou deixar aberto — deixar aberto aumenta a superfície de uso indevido (ex: baixar conteúdo protegido por direitos autorais de qualquer plataforma).

---

## 13. Próximos passos imediatos

1. Confirmar se quer começar pela **Fase 6** (base do painel admin) agora, já que as Fases 1–5 (bot de figurinha) já estão funcionando, ou se prefere terminar de estabilizar o que já existe antes.
2. Decidir se o modo download vai ser restrito a domínios específicos (ex: só X/Twitter) ou aberto a qualquer site suportado pelo `yt-dlp`.
3. Definir a senha inicial do `AdminUser` (recomendo gerar via script de seed, hash argon2, nunca deixar senha em texto puro no `.env`).
