FROM node:24-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package.json ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine AS build

WORKDIR /app

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npx tsc

FROM node:24-alpine

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    && pip3 install --break-system-packages -U yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --omit=dev 2>/dev/null || npm install --legacy-peer-deps --omit=dev

COPY prisma.config.ts ./
COPY prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY --from=frontend-build /frontend/dist ./frontend/dist

RUN mkdir -p /app/storage /app/sessions /app/data

RUN printf '#!/bin/sh\nnpx prisma db push --accept-data-loss\nexec node dist/server.js\n' > /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/app/entrypoint.sh"]
