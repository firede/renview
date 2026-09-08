ARG APP_BUILD=build

FROM oven/bun:1.4.2 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# 独立构建 GDScript WASM，镜像构建无需嵌套 Docker 或挂载宿主 socket。
FROM emscripten/emsdk:3.1.74 AS grammar
WORKDIR /grammar
COPY --from=dependencies /app/node_modules/tree-sitter-gdscript/ ./
RUN npm install --no-save --ignore-scripts tree-sitter-cli@0.25.10 && (cd node_modules/tree-sitter-cli && node install.js) && node_modules/.bin/tree-sitter build --wasm .

FROM dependencies AS build
COPY . .
COPY --from=grammar /grammar/tree-sitter-gdscript.wasm /app/wasm/gdscript.wasm
RUN bun run build:app

FROM oven/bun:1.4.2 AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile --ignore-scripts

# CI 传入同名构建上下文以复用已验证产物；默认仍支持从源码独立构建。
FROM ${APP_BUILD} AS artifacts

FROM oven/bun:1.4.2-slim
WORKDIR /app
ARG APP_REVISION=dev
ENV APP_REVISION=$APP_REVISION
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/auth.sqlite ANALYSIS_WORKER_PATH=/app/app/dist/analysis-worker.js
COPY --from=artifacts --chown=bun:bun /app/app/dist ./app/dist
COPY --from=artifacts --chown=bun:bun /app/app/serve.ts ./app/serve.ts
COPY --from=artifacts --chown=bun:bun /app/app/server/config.ts ./app/server/config.ts
COPY --from=production-dependencies --chown=bun:bun /app/node_modules ./node_modules
RUN mkdir /data && chown bun:bun /data
USER bun
EXPOSE 3000
CMD ["bun", "app/serve.ts"]
