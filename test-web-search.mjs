import {
  searchWebTool,
  openWebPageTool,
  validateWebUrl,
  MockSearchProvider,
} from './packages/tools/dist/index.js';
import { runBedrockNovaAgent } from './packages/agent/dist/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('==================================================');
  console.log('🧪 ActionOS Web Search MCP & SSRF Protection Test Suite');
  console.log('==================================================\n');

  // Test 1: MockSearchProvider Deterministic Queries
  console.log('▶ Test 1: MockSearchProvider - Deterministic Datasets');
  const provider = new MockSearchProvider();

  const hydRes = await provider.search('Hyderabad tourist places', 3);
  assert(hydRes.isMock === true, 'Result is marked as isMock: true');
  assert(hydRes.results.length === 3, 'Respects maxResults = 3');
  assert(
    hydRes.results.some((r) => r.title.toLowerCase().includes('hyderabad') || r.title.toLowerCase().includes('charminar')),
    'Returns Hyderabad attraction results'
  );

  const blrRes = await provider.search('best places to visit in Bangalore', 2);
  assert(blrRes.results.length === 2, 'Returns 2 Bangalore results');
  assert(blrRes.results[0].title.toLowerCase().includes('bangalore'), 'Returns Bangalore title');

  // Test 2: MockSearchProvider Unknown Query Fallback
  console.log('\n▶ Test 2: MockSearchProvider - Unknown Query Fallback');
  const unknownRes = await provider.search('Quantum Supercomputing Advances 2026', 3);
  assert(unknownRes.results.length === 3, 'Generates 3 fallback results for unknown query');
  assert(unknownRes.results[0].title.includes('Quantum Supercomputing'), 'Generates relevant fallback title');
  assert(unknownRes.results[0].isMock === true, 'Fallback results marked isMock: true');

  // Test 3: search_web Tool Execution & Input Validation
  console.log('\n▶ Test 3: search_web Tool - Input Validation & Output');
  const toolRes = await searchWebTool.execute({ query: 'Amazon Bedrock', maxResults: 4 });
  assert(toolRes.success === true, 'search_web execution succeeds');
  assert(toolRes.data.count <= 4, 'Returned count <= 4');
  assert(typeof toolRes.data.summary === 'string', 'Returns formatted string summary');

  // Test invalid queries
  const shortQueryRes = await searchWebTool.execute({ query: 'a' });
  assert(shortQueryRes.success === false, 'Rejects query with less than 2 characters');

  const longQueryRes = await searchWebTool.execute({ query: 'x'.repeat(501) });
  assert(longQueryRes.success === false, 'Rejects query longer than 500 characters');

  // Test 4: SSRF Security Protection in validateWebUrl
  console.log('\n▶ Test 4: SSRF Security Guards & URL Validation');
  const ssrfTests = [
    { url: 'http://localhost/admin', expectedValid: false, desc: 'Rejects localhost' },
    { url: 'http://127.0.0.1:8080/secret', expectedValid: false, desc: 'Rejects 127.0.0.1' },
    { url: 'http://0.0.0.0/', expectedValid: false, desc: 'Rejects 0.0.0.0' },
    { url: 'http://[::1]/', expectedValid: false, desc: 'Rejects IPv6 loopback [::1]' },
    { url: 'http://10.0.0.15/api', expectedValid: false, desc: 'Rejects private IPv4 10.0.0.0/8' },
    { url: 'http://172.16.5.1/', expectedValid: false, desc: 'Rejects private IPv4 172.16.0.0/12' },
    { url: 'http://192.168.1.1/router', expectedValid: false, desc: 'Rejects private IPv4 192.168.0.0/16' },
    { url: 'http://169.254.169.254/latest/meta-data/', expectedValid: false, desc: 'Rejects AWS Metadata IP (169.254.169.254)' },
    { url: 'javascript:alert(1)', expectedValid: false, desc: 'Rejects javascript: scheme' },
    { url: 'file:///etc/passwd', expectedValid: false, desc: 'Rejects file: scheme' },
    { url: 'ftp://example.com/file.txt', expectedValid: false, desc: 'Rejects ftp: scheme' },
    { url: 'https://example.com/hyderabad-tourism-guide', expectedValid: true, desc: 'Allows valid HTTPS web URL' },
  ];

  for (const t of ssrfTests) {
    const res = validateWebUrl(t.url);
    assert(res.valid === t.expectedValid, `${t.desc} -> ${t.url}`);
  }

  // Test 5: open_web_page Tool Execution & HTML Extraction
  console.log('\n▶ Test 5: open_web_page Tool Execution');
  const pageRes = await openWebPageTool.execute({ url: 'https://example.com/hyderabad-tourism-guide' });
  assert(pageRes.success === true, 'open_web_page succeeds on valid mock URL');
  assert(typeof pageRes.data.title === 'string', 'Extracts page title');
  assert(pageRes.data.text.includes('Charminar'), 'Extracts text content cleanly');

  const invalidPageRes = await openWebPageTool.execute({ url: 'http://169.254.169.254/latest/meta-data/' });
  assert(invalidPageRes.success === false, 'open_web_page rejects SSRF metadata attack');

  // Test 6: Agent Orchestrator Multi-Tool Loop Integration
  console.log('\n▶ Test 6: Agent Orchestrator Web Search Loop');
  const agentSearchRes = await runBedrockNovaAgent({
    prompt: 'Search for top attractions in Hyderabad',
    sessionId: 'test-search-session',
    userId: 'test-user',
  });

  assert(typeof agentSearchRes.text === 'string', 'Agent returns text response');
  assert(agentSearchRes.toolLogs.length > 0, 'Agent toolLogs populated');
  assert(agentSearchRes.toolLogs[0].name === 'search_web', 'Executed search_web tool in loop');

  const agentPageRes = await runBedrockNovaAgent({
    prompt: 'Open page https://example.com/hyderabad-tourism-guide',
    sessionId: 'test-page-session',
    userId: 'test-user',
  });

  assert(agentPageRes.toolLogs[0].name === 'open_web_page', 'Executed open_web_page tool in loop');

  console.log('\n==================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
