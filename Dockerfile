# --- build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Run as the image's built-in non-root user rather than root.
USER node

EXPOSE 4200
# Container-level health probe hits this service's own deep /health (checks its own DB connection;
# TLM/punch-processor reachability is reported in the body but deliberately doesn't affect the exit
# code — a downstream dependency being unreachable means "can't do certain things," not "this
# container itself is unhealthy").
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4200/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]
