export const TOOLS_PACKAGE_VERSION = '1.0.0';

export * from './onewayfix/client.js';
export * from './onewayfix/audit.js';
export * from './onewayfix/tools.js';
export * from './web-search/search-provider.js';
export * from './web-search/mock-provider.js';
export * from './web-search/url-validator.js';
export * from './web-search/page-fetcher.js';
export * from './web-search/tools.js';

import { oneWayFixTools } from './onewayfix/tools.js';
import { webSearchTools } from './web-search/tools.js';

export const allTools = [...webSearchTools, ...oneWayFixTools];

