# Production image for the modern app: Fastify on port 3000 serving /api/*, the legacy-compatible
# /vets.json and /vets.xml, and the built React app. Build context is the repo root, because the
# npm workspaces and the lockfile live there:
#   docker compose build modern     (or: docker build -f modern/Dockerfile .)

# Stage 1: install all dependencies and build both workspaces.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY modern/api/package.json modern/api/
COPY modern/web/package.json modern/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY modern/api modern/api
COPY modern/web modern/web
RUN npm run build -w modern/api && npm run build -w modern/web

# Stage 2: runtime with only the API's production dependencies.
FROM node:24-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY modern/api/package.json modern/api/
COPY modern/web/package.json modern/web/
RUN npm ci --omit=dev -w modern/api && npm cache clean --force
# The paths match the repo layout: app.ts finds ../../web/dist and reset.ts ../db from dist/.
COPY --from=build /app/modern/api/dist modern/api/dist
COPY modern/api/db modern/api/db
COPY --from=build /app/modern/web/dist modern/web/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Seed on first start only (an existing schema is left alone), then serve.
CMD ["sh", "-c", "node modern/api/dist/db-init.js && exec node modern/api/dist/server.js"]
