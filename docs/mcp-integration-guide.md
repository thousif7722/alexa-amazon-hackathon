# ActionOS MCP Integration Guide

This guide explains how to build, test, and integrate new Model Context Protocol (MCP) servers and tools into ActionOS.

---

## 🛠 Adding a New Tool

### Step 1: Define Tool Implementation in `packages/tools/src/`

Create a new tool file implementing `ToolDefinition`:

```typescript
import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '@actionos/types';

export const myNewTool: ToolDefinition = {
  name: 'my_new_tool',
  description: 'Clear description of what this tool does for Gemini LLM reasoning.',
  version: '1.0.0',
  category: 'information', // 'information' | 'travel' | 'booking' | 'services'
  riskLevel: 'READ',       // 'READ' | 'WRITE' | 'SENSITIVE'
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Parameter description' },
    },
    required: ['query'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    return {
      success: true,
      toolName: 'my_new_tool',
      data: { result: 'Success data' },
      executionDurationMs: 10,
    };
  },
};
```

---

### Step 2: Register Tool in MCP Server (`apps/mcp-server/src/index.ts`)

```typescript
import { myNewTool } from '@actionos/tools';

mcpServer.tool(
  'my_new_tool',
  myNewTool.description,
  {
    query: z.string().describe('Parameter description'),
  },
  async (args) => {
    const result = (await myNewTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);
```

---

## 🌐 Connecting Multiple MCP Servers

Configure `MCP_SERVERS` environment variable as JSON in `.env`:

```json
MCP_SERVERS='[
  { "name": "onewayfix", "url": "http://localhost:3001/mcp", "enabled": true },
  { "name": "travel", "url": "http://localhost:3002/mcp", "enabled": true }
]'
```

The ActionOS `McpManager` will automatically discover tools across servers and handle name collisions using namespacing (`onewayfix.create_booking_request`, `travel.search_places`).
