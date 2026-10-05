import http from 'node:http';
import { z } from '@actionos/validation';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToolExecutionResult } from '@actionos/types';
import {
  listServicesTool,
  createBookingRequestTool,
  getBookingStatusTool,
  cancelBookingTool,
  searchWebTool,
  openWebPageTool,
  searchPlacesTool,
  planItineraryTool,
  calculateRouteTool,
  searchHotelsTool,
  externalServiceAdapterTool,
} from '@actionos/tools';

export const MCP_SERVER_VERSION = '1.0.0';
const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3001;

export const mcpServer = new McpServer({
  name: 'ActionOS MCP Server',
  version: MCP_SERVER_VERSION,
});

// 1. list_services
mcpServer.tool(
  'list_services',
  listServicesTool.description,
  {
    category: z.string().optional().describe('Filter services by category (e.g. Home Appliances, Plumbing)'),
    query: z.string().optional().describe('Search term for service name or description'),
  },
  async (args) => {
    const result = (await listServicesTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 2. create_booking_request
mcpServer.tool(
  'create_booking_request',
  createBookingRequestTool.description,
  {
    customerName: z.string().describe('Customer full name'),
    phone: z.string().describe('Customer contact phone number'),
    service: z.string().describe('Service name (e.g. AC Repair & Service)'),
    address: z.string().describe('Complete service delivery address'),
    preferredTime: z.string().describe('Preferred date & time for service visit'),
    notes: z.string().optional().describe('Additional instructions or notes'),
    source: z.string().optional().describe('Booking source system tag'),
    confirmed: z.boolean().optional().default(false).describe('Set to true ONLY after customer explicitly confirms booking details'),
  },
  async (args) => {
    const result = (await createBookingRequestTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 3. get_booking_status
mcpServer.tool(
  'get_booking_status',
  getBookingStatusTool.description,
  {
    bookingId: z.string().describe('The unique OneWayFix Booking ID (e.g. OWF-1001)'),
  },
  async (args) => {
    const result = (await getBookingStatusTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 4. cancel_booking
mcpServer.tool(
  'cancel_booking',
  cancelBookingTool.description,
  {
    bookingId: z.string().describe('The unique OneWayFix Booking ID to cancel'),
    reason: z.string().optional().describe('Reason for cancellation'),
    confirmed: z.boolean().optional().default(false).describe('Set to true ONLY after customer explicitly confirms cancellation'),
  },
  async (args) => {
    const result = (await cancelBookingTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 5. search_web
mcpServer.tool(
  'search_web',
  searchWebTool.description,
  {
    query: z.string().min(2).max(500).describe('Search query string'),
    maxResults: z.number().int().min(1).max(10).optional().default(5).describe('Maximum number of search results (1 to 10)'),
  },
  async (args) => {
    const result = (await searchWebTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 6. open_web_page
mcpServer.tool(
  'open_web_page',
  openWebPageTool.description,
  {
    url: z.string().url().describe('Valid HTTP or HTTPS web page URL to open and extract content from'),
  },
  async (args) => {
    const result = (await openWebPageTool.execute(args)) as ToolExecutionResult;
    const textMsg = (result.data as any)?.summary || (result.data as any)?.message || JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text', text: typeof textMsg === 'string' ? textMsg : JSON.stringify(textMsg, null, 2) }],
      isError: !result.success,
    };
  }
);

// 7. search_places
mcpServer.tool(
  'search_places',
  searchPlacesTool.description,
  {
    destination: z.string().describe('Destination city name (e.g. Hyderabad, Goa)'),
    category: z.string().optional().describe('Filter by category (e.g. heritage, beach, food)'),
  },
  async (args) => {
    const result = (await searchPlacesTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);

// 8. plan_itinerary
mcpServer.tool(
  'plan_itinerary',
  planItineraryTool.description,
  {
    destination: z.string().describe('Destination city (e.g. Hyderabad, Goa)'),
    days: z.number().optional().default(2).describe('Number of trip days'),
    budgetINR: z.number().optional().describe('Approximate total budget in INR'),
    travelersCount: z.number().optional().default(1).describe('Number of travelers'),
    interests: z.string().optional().describe('Trip focus or interest keywords'),
  },
  async (args) => {
    const result = (await planItineraryTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);

// 9. calculate_route
mcpServer.tool(
  'calculate_route',
  calculateRouteTool.description,
  {
    origin: z.string().describe('Starting location'),
    destination: z.string().describe('Destination location'),
    mode: z.string().optional().default('driving').describe('Mode of transport: driving, transit, train, flight'),
  },
  async (args) => {
    const result = (await calculateRouteTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);

// 10. search_hotels
mcpServer.tool(
  'search_hotels',
  searchHotelsTool.description,
  {
    destination: z.string().describe('Destination city'),
    maxPriceINR: z.number().optional().describe('Maximum budget per night in INR'),
  },
  async (args) => {
    const result = (await searchHotelsTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);

// 11. external_service_request
mcpServer.tool(
  'external_service_request',
  externalServiceAdapterTool.description,
  {
    platform: z.string().describe('Platform name (rapido, zomato, blinkit, swiggy, uber)'),
    query: z.string().optional().describe('Search term or destination'),
  },
  async (args) => {
    const result = (await externalServiceAdapterTool.execute(args)) as ToolExecutionResult;
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
      isError: !result.success,
    };
  }
);

export async function startServer() {
  const isStdio = process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio';

  if (isStdio) {
    const stdioTransport = new StdioServerTransport();
    await mcpServer.connect(stdioTransport);
    console.error('🚀 ActionOS MCP Server running via stdio transport');
    return;
  }

  // Streamable HTTP Transport for MCP clients
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(httpTransport);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Id, M-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && (req.url === '/mcp' || req.url === '/mcp/')) {
      await httpTransport.handleRequest(req, res);
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', server: 'ActionOS MCP Server', version: MCP_SERVER_VERSION }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found. Use POST /mcp for MCP requests.' }));
  });

  server.listen(PORT, () => {
    console.error(`🚀 ActionOS MCP Server running on Streamable HTTP at http://localhost:${PORT}/mcp`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start MCP Server:', err);
    process.exit(1);
  });
}
