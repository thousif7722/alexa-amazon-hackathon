# ActionOS Setup & Deployment Guide

This document outlines environment setup, local development commands, and production deployment procedures on AWS EC2 with Docker.

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# AI Model Provider Settings
MODEL_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TEMPERATURE=0.2
MAX_TOOL_ITERATIONS=8

# MCP Server Settings
MCP_PORT=3001
MCP_SERVER_URL=http://localhost:3001/mcp

# Monorepo & App Config
PORT=3000
NODE_ENV=production
```

---

## 💻 Local Development

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Build Packages & Applications
```bash
pnpm build
```

### 3. Run Development Servers
```bash
# Terminal 1: MCP Server
pnpm --filter @actionos/mcp-server dev

# Terminal 2: Web UI
pnpm --filter @actionos/web dev
```

Open `http://localhost:3000` in your browser.

---

## 🐳 Docker Production Deployment

### 1. Build and Run Container
```bash
docker-compose up -d --build
```

### 2. AWS EC2 Deployment
On your EC2 instance (e.g. `actionos.onewayfix.com`):

```bash
git pull origin main
docker-compose up -d --build
```

Nginx automatically proxies incoming HTTPS requests on `actionos.onewayfix.com` to port `3000`.
