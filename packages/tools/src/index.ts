export const TOOLS_PACKAGE_VERSION = '1.0.0';

export * from './onewayfix/client.js';
export * from './onewayfix/audit.js';
export * from './onewayfix/tools.js';
export * from './web-search/search-provider.js';
export * from './web-search/mock-provider.js';
export * from './web-search/url-validator.js';
export * from './web-search/page-fetcher.js';
export * from './web-search/tools.js';
export * from './travel/tools.js';
export * from './adapters/service-adapter.js';

import { oneWayFixTools } from './onewayfix/tools.js';
import { webSearchTools } from './web-search/tools.js';
import {
  searchPlacesTool,
  planItineraryTool,
  calculateRouteTool,
  searchHotelsTool,
} from './travel/tools.js';
import { externalServiceAdapterTool } from './adapters/service-adapter.js';

export const travelTools = [
  searchPlacesTool,
  planItineraryTool,
  calculateRouteTool,
  searchHotelsTool,
];

export const adapterTools = [externalServiceAdapterTool];

export const allTools = [
  ...webSearchTools,
  ...oneWayFixTools,
  ...travelTools,
  ...adapterTools,
];
