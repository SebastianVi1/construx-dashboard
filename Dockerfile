# syntax=docker/dockerfile:1

# Dependencies stage: install locked dependencies, cached until the lockfile changes
FROM oven/bun:1.4.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Dev stage: Vite dev server with hot reload; compose bind-mounts the source
FROM deps AS dev
EXPOSE 5173
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

# Build stage: typecheck and bundle the SPA
FROM deps AS build
COPY . .
# VITE_* values are inlined into the bundle at build time, so they are build args, not runtime env
ARG VITE_API_BASE_URL=/api
ARG VITE_OAUTH2_AUTHORIZATION_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_OAUTH2_AUTHORIZATION_URL=$VITE_OAUTH2_AUTHORIZATION_URL
RUN bun run build

# Runtime stage (default target): nginx serves the bundle and proxies the backend on the same origin
FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
