export const CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  modelId: process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0',
  mcpPort: parseInt(process.env.MCP_PORT || '3001', 10),
  webPort: parseInt(process.env.WEB_PORT || '3000', 10),
};
