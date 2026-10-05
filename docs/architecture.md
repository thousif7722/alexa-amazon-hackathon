# ActionOS Architecture Overview

ActionOS is an intelligent, general-purpose AI assistant and action agent platform built on modern TypeScript/Node.js, Google Gemini AI, and Model Context Protocol (MCP) tool execution pipelines.

---

## 🏛 System Topography

```
               [ User Browser / Voice Client ]
                             │
                             ▼ (HTTPS / REST API)
                   [ Next.js Web App ]
                             │
                             ▼ (@actionos/agent)
           [ Agent Orchestrator & Provider Engine ]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ GeminiProvider ]              [ ModelProvider Factory ]
  (@google/genai SDK)              (Ollama / Bedrock Fallback)
            │
            ▼
     [ Multi-MCP Manager ]
 (Tool Discovery & Namespacing)
            │
            ▼
     [ MCP Server (Streamable HTTP) ]
 (OneWayFix, Travel Tools, Web Search, Service Adapters)
```

---

## 🔑 Core Components

### 1. ModelProvider Abstraction (`packages/agent/src/providers/`)
* **Interface**: Standardized `ModelProvider` contract defining `generateResponse(options)`.
* **GeminiProvider**: Primary runtime provider using Google GenAI SDK (`@google/genai`) with model `gemini-2.5-flash`.
* **Dynamic Function Calling**: Multi-turn tool execution loop. Gemini calls tool functions $\rightarrow$ Agent executes MCP tool $\rightarrow$ Feeds results back to Gemini $\rightarrow$ Synthesizes final user output.
* **OllamaProvider**: Local LLM execution provider for offline / private models (`llama3`).
* **BedrockProvider**: Optional AWS Bedrock provider preserved for backward-compatibility.

### 2. Multi-MCP Manager Architecture (`packages/agent/src/mcp-manager.ts`)
* **Dynamic Discovery**: Connects to multiple MCP servers defined in `MCP_SERVERS` or default endpoints.
* **Tool Namespacing**: Automatic collision resolution (e.g. `onewayfix.create_booking_request`, `travel.search_places`).
* **Health Checks**: Real-time status reporting and latency tracking.

### 3. Risk & Safety Execution Engine (`packages/tools/src/`)
* **READ Level**: Safe, non-mutating queries (`search_web`, `search_places`, `list_services`, `calculate_route`). Executed immediately.
* **WRITE / MEDIUM Risk Level**: State-mutating actions (`create_booking_request`, `cancel_booking`). Returns a **Human-in-the-Loop Confirmation Card** in UI requiring explicit user confirmation before executing.

---

## 🛠 Available MCP Tools

| Tool | Category | Risk Level | Description |
|---|---|---|---|
| `search_places` | Travel | READ | Search attractions, heritage sites, and eateries for cities (e.g. Hyderabad, Goa) |
| `plan_itinerary` | Travel | READ | Build day-by-day schedules with cost breakdowns and timings |
| `calculate_route` | Travel | READ | Calculate distance, duration, and transit costs between points |
| `search_hotels` | Travel | READ | Search hotel accommodations with budget filters |
| `list_services` | OneWayFix | READ | Search home repair & appliance services |
| `create_booking_request` | OneWayFix | WRITE | Create home repair booking requests (Requires User Approval) |
| `get_booking_status` | OneWayFix | READ | Retrieve live status for booking ID |
| `cancel_booking` | OneWayFix | WRITE | Cancel service booking (Requires User Approval) |
| `search_web` | Information | READ | Real-time web search for current events and guides |
| `open_web_page` | Information | READ | Web page scraper with SSRF protection |
| `external_service_request` | Adapter | READ | Safe handoff for Blinkit, Zomato, Rapido, Uber with status reporting |
