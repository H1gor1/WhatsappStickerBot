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
│   ├── db/
│   │   ├── client.ts             # instância do Prisma
│   │   └── repositories/
│   │       ├── message.repository.ts
│   │       └── sticker.repository.ts
│   ├── routes/
│   │   ├── health.ts             # GET /health
│   │   ├── status.ts             # GET /status (conexão, QR code)
│   │   └── stats.ts              # GET /stats (métricas de uso)
│   └── utils/
│       ├── logger.ts
│       └── mime.ts               # detecção de tipo de mídia
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
```

Isso permite: histórico de uso por contato, métricas (quantas figurinhas geradas, taxa de erro, tempo médio de processamento) e reprocessamento de falhas.

---

## 5. Fluxo de processamento (passo a passo)

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

## 6. Endpoints Fastify (administrativos, não é isso que fala com o usuário final — isso é via WhatsApp)

| Método | Rota | Função |
|---|---|---|
| GET | `/health` | Health check para orquestrador (Docker/monitoramento) |
| GET | `/status` | Status da conexão Baileys (conectado, aguardando QR, desconectado) |
| GET | `/status/qr` | Retorna o QR code atual (imagem base64) para parear o número |
| GET | `/stats` | Métricas agregadas (total de figurinhas, taxa de erro, últimos 7 dias) |
| GET | `/stickers/:id` | Consulta status de um pedido específico (debug) |

---

## 7. Docker & deployment

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

---

## 8. Fases de implementação sugeridas

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

---

## 9. Riscos e pontos de atenção

- **Baileys não é oficial**: uso excessivo/comportamento de bot muito agressivo pode levar a banimento do número. Recomenda-se usar um número dedicado (não o principal) e implementar rate limiting.
- **Sessão do Baileys é sensível**: tratar `sessions/` como segredo (não versionar, backup seguro).
- **Limite de tamanho do sticker**: WhatsApp rejeita webp acima de 500KB — o pipeline precisa ter lógica de fallback (reduzir qualidade/fps/dimensão iterativamente).
- **ffmpeg é pesado em CPU**: em VPS modesto, processar muitos vídeos simultâneos pode gargalar — por isso a fila com concorrência limitada é importante.
- **Mudanças no protocolo do WhatsApp**: Baileys depende de engenharia reversa do protocolo; atualizações do WhatsApp podem quebrar a lib temporariamente até ser corrigida pela comunidade.
- **yt-dlp e o X/Twitter**: assim como o Baileys, o `yt-dlp` depende de engenharia reversa do lado do X — quando a plataforma muda algo, quebra até sair um novo release (geralmente rápido, a comunidade é ativa). Atualizar o binário com frequência é importante.
- **Direitos autorais em mídia de terceiros**: diferente da mídia que o próprio usuário envia, o conteúdo de um tweet pertence a outra pessoa. Vale manter esse uso como pessoal/entre amigos.
- **Baileys v7 ainda é RC**: se decidir usar a `7.0.0-rc14` (mais atual) em vez da `6.17.16` (estável), esteja preparado para breaking changes e possíveis bugs de release candidate.

---

## 10. Próximos passos imediatos

1. Confirmar se quer começar pela **Fase 1** (esqueleto + conexão) com código real.
2. Definir se o número usado será dedicado ou o pessoal (recomendo dedicado).
3. Decidir se quer nome/branding fixo para o pack de figurinhas (aparece como metadado no sticker).
