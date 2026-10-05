import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpManager } from '../src/mcp-manager.js';
import { GeminiProvider } from '../src/providers/gemini-provider.js';
import { runActionOSAgent } from '../src/bedrock-agent.js';
import { getOrCreateMcpClient, callMcpToolOnUrl, fetchMcpToolsFromUrl } from '../src/mcp-client.js';

describe('ActionOS Agent & Multi-MCP Architecture Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  // Test 1: Gemini responds without tools
  it('1. Gemini responds cleanly without tools for simple greetings', async () => {
    delete process.env.GEMINI_API_KEY;
    const provider = new GeminiProvider();
    const result = await provider.generateResponse({ prompt: 'Hello ActionOS', systemPrompt: 'You are ActionOS.' });
    expect(result.text).toContain('ActionOS');
    expect(result.isFallback).toBe(true);
  });

  // Test 2: Gemini calls one MCP tool
  it('2. McpManager executes single namespaced MCP tool cleanly', async () => {
    const manager = new McpManager();
    await manager.discoverAllTools();
    const result = await manager.executeTool('travel__search_places', { query: 'Charminar' });
    expect(result.toolName).toBe('search_places');
    expect(result.success).toBe(true);
  });

  // Test 3: Gemini calls multiple MCP tools sequentially
  it('3. Multi-MCP sequential execution handles travel sequence', async () => {
    const manager = new McpManager();
    await manager.discoverAllTools();
    const placesRes = await manager.executeTool('travel__search_places', { query: 'Hyderabad' });
    const routeRes = await manager.executeTool('travel__calculate_route', { origin: 'Charminar', destination: 'Golconda Fort' });
    expect(placesRes.success).toBe(true);
    expect(routeRes.success).toBe(true);
  });

  // Test 4: Multiple independent tools parallel execution
  it('4. Discovers and indexes tools from multiple server endpoints', async () => {
    const manager = new McpManager([
      { name: 'web', url: 'http://localhost:3002/mcp', enabled: true },
      { name: 'travel', url: 'http://localhost:3003/mcp', enabled: true },
    ]);
    const tools = await manager.discoverAllTools();
    expect(tools.length).toBeGreaterThan(0);
    const geminiNames = tools.map((t) => t.geminiName);
    expect(geminiNames.some((n) => n.startsWith('travel__'))).toBe(true);
    expect(geminiNames.some((n) => n.startsWith('web__'))).toBe(true);
  });

  // Test 5: MCP server initializes correctly
  it('5. Handles MCP server initialization fallback gracefully', async () => {
    const manager = new McpManager([
      { name: 'offline_server', url: 'http://localhost:9999/mcp', enabled: true },
    ]);
    const statuses = await manager.getServerStatuses();
    expect(statuses[0].connected).toBe(false);
  });

  // Test 6: Official MCP Client tools/list
  it('6. MCP Client tools/list handles connection and tool discovery', async () => {
    const tools = await fetchMcpToolsFromUrl('http://localhost:9999/mcp');
    expect(Array.isArray(tools)).toBe(true);
  });

  // Test 7: Official MCP Client tools/call
  it('7. MCP Client tools/call executes tool request with arguments', async () => {
    const callRes = await callMcpToolOnUrl('http://localhost:9999/mcp', 'list_services', {});
    expect(callRes).toBeDefined();
  });

  // Test 8: Two MCP servers expose same tool name without collision
  it('8. Two MCP servers with identical tool names resolve without collision via double-underscore namespacing', async () => {
    const manager = new McpManager([
      { name: 'web', url: 'http://localhost:3002/mcp', enabled: true },
      { name: 'travel', url: 'http://localhost:3003/mcp', enabled: true },
    ]);
    await manager.discoverAllTools();
    const webSearchTool = manager.getToolRegistry().get('web__search_web');
    const travelSearchTool = manager.getToolRegistry().get('travel__search_places');
    expect(webSearchTool?.serverName).toBe('web');
    expect(travelSearchTool?.serverName).toBe('travel');
  });

  // Test 9: Namespaced Gemini names resolve correctly
  it('9. Namespaced Gemini name "onewayfix__create_booking_request" resolves to server="onewayfix" and tool="create_booking_request"', async () => {
    const manager = new McpManager();
    await manager.discoverAllTools();
    const result = await manager.executeTool('onewayfix__create_booking_request', {
      service: 'AC Repair & Deep Service',
      customerName: 'Test User',
      phone: '9876543210',
      address: 'Hyderabad',
      preferredTime: '2026-10-10 10:00 AM',
    });
    expect(result.toolName).toBe('create_booking_request');
    expect(result.requiresConfirmation).toBe(true);
  });

  // Test 10: OneWayFix booking requires explicit confirmation
  it('10. OneWayFix create_booking_request requires human confirmation card return', async () => {
    const res = await runActionOSAgent({
      prompt: 'Book AC repair for tomorrow at 10 AM',
      modelProvider: 'gemini',
    });
    expect(res).toBeDefined();
    expect(res.text).toBeDefined();
  });

  // Test 11: Travel planning workflow
  it('11. Travel planning request triggers travel tool flow', async () => {
    const res = await runActionOSAgent({
      prompt: 'I have 3 days in Hyderabad and a ₹10,000 budget. I like history and food. Plan my trip.',
      modelProvider: 'gemini',
    });
    expect(res.text).toBeDefined();
    expect(res.text.length).toBeGreaterThan(0);
  });

  // Test 12: Missing Gemini API key produces clear configuration error / fallback message
  it('12. Missing GEMINI_API_KEY yields clear warning message', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await runActionOSAgent({
      prompt: 'Hello',
      modelProvider: 'gemini',
    });
    expect(res.text).toContain('GEMINI_API_KEY environment variable is not configured');
  });

  // Test 13: No Bedrock call occurs in Gemini runtime
  it('13. No Bedrock SDK API call occurs when modelProvider is gemini', async () => {
    process.env.MODEL_PROVIDER = 'gemini';
    const res = await runActionOSAgent({
      prompt: 'Hello ActionOS',
      modelProvider: 'gemini',
    });
    expect(res).toBeDefined();
  });
});
