# ====================================================================
# Dockerfile for ActionOS Monorepo (Next.js Web + MCP Server)
# ====================================================================
FROM node:20-alpine AS base

RUN apk add --no-cache python3 make g++ git
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY packages/validation/package.json ./packages/validation/
COPY packages/tools/package.json ./packages/tools/
COPY packages/agent/package.json ./packages/agent/
COPY packages/ui/package.json ./packages/ui/
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile=false

# Copy full source
COPY . .

# Build all workspace packages and applications
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Expose Web (3000) and MCP Server (3001)
EXPOSE 3000 3001

# Create persistent data directory
RUN mkdir -p /app/data

# Start script running both MCP server and Next.js web server
CMD ["sh", "-c", "node apps/mcp-server/dist/index.js & pnpm --filter @actionos/web start"]
