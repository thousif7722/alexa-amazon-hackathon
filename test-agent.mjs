import { runBedrockNovaAgent, fetchMcpTools, convertMcpToolsToBedrockConfig } from './packages/agent/dist/index.js';

async function main() {
  console.log('====================================================');
  console.log('ActionOS · Bedrock Nova Agent CLI Test Suite');
  console.log('====================================================\n');

  // 1. Verify MCP tool discovery & conversion
  console.log('--- 1. Testing MCP Tool Discovery & Conversion ---');
  const mcpTools = await fetchMcpTools('http://localhost:3001/mcp');
  console.log(`Discovered ${mcpTools.length} tools from MCP Server:`);
  mcpTools.forEach((t) => console.log(`  - ${t.name}: ${t.description.slice(0, 60)}...`));

  const bedrockConfig = convertMcpToolsToBedrockConfig(mcpTools);
  console.log(`\nConverted to Amazon Bedrock toolConfig format (${bedrockConfig.tools.length} specs ready).\n`);

  // 2. Test prompt: List Services
  console.log('--- 2. Testing Prompt: "What services do you offer?" ---');
  const res1 = await runBedrockNovaAgent({ prompt: 'What services do you offer?' });
  console.log('Assistant Text Response:\n', res1.text);
  console.log('Tool Logs:', JSON.stringify(res1.toolLogs, null, 2));
  console.log('\n----------------------------------------------------\n');

  // 3. Test prompt: Book AC Repair (Medium Risk - Confirmation Guard)
  console.log('--- 3. Testing Prompt: "Book an AC repair for tomorrow at 11 AM" ---');
  const res2 = await runBedrockNovaAgent({ prompt: 'Book an AC repair for tomorrow at 11 AM' });
  console.log('Requires Confirmation?:', res2.requiresConfirmation);
  console.log('Confirmation Card Title:', res2.confirmationCard?.title);
  console.log('Details Summary:\n', res2.text);
  console.log('Tool Logs:', JSON.stringify(res2.toolLogs, null, 2));
  console.log('\n----------------------------------------------------\n');

  // 4. Test prompt: Confirm Pending Booking
  if (res2.requiresConfirmation && res2.pendingAction) {
    console.log('--- 4. Testing User Confirmation ("Confirm" pressed in UI) ---');
    const res3 = await runBedrockNovaAgent({
      confirmationResponse: {
        action: 'confirm',
        pendingAction: res2.pendingAction,
      },
    });
    console.log('Assistant Text Response:\n', res3.text);
    console.log('Booking Result Card:', res3.bookingCard?.bookingId, res3.bookingCard?.status);
    console.log('Tool Logs:', JSON.stringify(res3.toolLogs, null, 2));
    console.log('\n----------------------------------------------------\n');
  }

  // 5. Test prompt: Check Booking Status
  console.log('--- 5. Testing Prompt: "Check status for OWF-1001" ---');
  const res4 = await runBedrockNovaAgent({ prompt: 'Check status for OWF-1001' });
  console.log('Assistant Text Response:\n', res4.text);
  console.log('Tool Logs:', JSON.stringify(res4.toolLogs, null, 2));
  console.log('\n====================================================');
  console.log('All Bedrock Nova Agent CLI tests completed successfully!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Fatal CLI Test Error:', err);
  process.exit(1);
});
