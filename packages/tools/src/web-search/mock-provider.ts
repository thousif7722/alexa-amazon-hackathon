import { SearchProvider, SearchProviderResult, SearchResultItem } from './search-provider.js';

const MOCK_DATASET: Record<string, SearchResultItem[]> = {
  hyderabad: [
    {
      title: 'Hyderabad Tourism - Top 15 Sightseeing Places & Attractions',
      url: 'https://example.com/hyderabad-tourism-guide',
      snippet:
        'Explore top attractions in Hyderabad including Charminar, Golconda Fort, Hussain Sagar Lake, Ramoji Film City, Salar Jung Museum, and Birla Mandir.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Charminar & Historic Old City Heritage Guide',
      url: 'https://example.com/charminar-hyderabad-heritage',
      snippet:
        'Built in 1591 by Muhammad Quli Qutb Shah, the iconic four-arched monument is the global landmark of Hyderabad, Telangana.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Golconda Fort Acoustic & Light Show Timings',
      url: 'https://example.com/golconda-fort-guide',
      snippet:
        'Historic fortress complex famous for its ancient acoustics, royal palaces, diamond vaults, and panoramic sunset views over Hyderabad.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Hussain Sagar Lake & Buddha Statue Visitor Info',
      url: 'https://example.com/hussain-sagar-lake',
      snippet:
        'Heart-shaped lake connecting Hyderabad and Secunderabad featuring the world tall monolithic statue of Gautama Buddha in the middle.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Chowmahalla Palace & Royal Qutb Shahi Tombs',
      url: 'https://example.com/chowmahalla-palace-hyderabad',
      snippet:
        'The official residence of the Nizams of Hyderabad restored with grand chandeliers, vintage cars, and Mughal-Persian architecture.',
      source: 'example.com',
      isMock: true,
    },
  ],

  bangalore: [
    {
      title: 'Top Places to Visit in Bangalore - Garden City Travel Guide',
      url: 'https://example.com/bangalore-travel-guide',
      snippet:
        'Discover Bangalore attractions including Lalbagh Botanical Garden, Bangalore Palace, Cubbon Park, ISKCON Temple, and Nandi Hills.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Lalbagh Botanical Garden & Annual Flower Show',
      url: 'https://example.com/lalbagh-garden-bangalore',
      snippet:
        'Famous 240-acre botanical garden housing over 1,000 species of flora and the iconic 1890 Glass House inspired by London Crystal Palace.',
      source: 'example.com',
      isMock: true,
    },
    {
      title: 'Bangalore Palace Architecture & History',
      url: 'https://example.com/bangalore-palace-history',
      snippet:
        '19th-century royal residence built in Tudor revival style with fortified towers, wooden carvings, and manicured grounds.',
      source: 'example.com',
      isMock: true,
    },
  ],

  bedrock: [
    {
      title: 'Amazon Bedrock - Build & Scale Generative AI Applications',
      url: 'https://aws.amazon.com/bedrock/',
      snippet:
        'Amazon Bedrock is a fully managed AWS service offering choice of high-performing foundation models (Nova, Claude, Llama) via a unified API.',
      source: 'aws.amazon.com',
      isMock: true,
    },
    {
      title: 'Amazon Bedrock Nova Models Overview & Converse API',
      url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/models-nova.html',
      snippet:
        'Amazon Nova Lite and Pro models deliver fast multi-modal reasoning and structured tool use capability via the Bedrock Converse API.',
      source: 'docs.aws.amazon.com',
      isMock: true,
    },
  ],

  mcp: [
    {
      title: 'Model Context Protocol (MCP) - Open Standard Specification',
      url: 'https://modelcontextprotocol.io',
      snippet:
        'An open standard created by Anthropic that connects AI models to external tools, databases, and APIs via standardized JSON-RPC and Streamable HTTP.',
      source: 'modelcontextprotocol.io',
      isMock: true,
    },
    {
      title: 'Building Custom MCP Servers with Node.js & TypeScript SDK',
      url: 'https://modelcontextprotocol.io/docs/sdk/typescript',
      snippet:
        'Learn how to create custom MCP servers, define tools with Zod input validation, and expose Streamable HTTP endpoints.',
      source: 'modelcontextprotocol.io',
      isMock: true,
    },
  ],

  actionos: [
    {
      title: 'ActionOS - General-Purpose AI Action Agent Runtime',
      url: 'https://actionos.onewayfix.com',
      snippet:
        'Production AI action orchestration platform integrating Amazon Bedrock Converse, risk-aware tool authorization, and Model Context Protocol tools.',
      source: 'actionos.onewayfix.com',
      isMock: true,
    },
  ],

  onewayfix: [
    {
      title: 'OneWayFix - On-Demand Home Appliance Repair & Maintenance',
      url: 'https://onewayfix.com',
      snippet:
        'Verified home technicians for AC repair, plumbing, electrical wiring, washing machine servicing, and deep cleaning with upfront pricing.',
      source: 'onewayfix.com',
      isMock: true,
    },
  ],
};

export class MockSearchProvider implements SearchProvider {
  public name = 'mock';

  public async search(query: string, maxResults: number = 5): Promise<SearchProviderResult> {
    const normalized = query.toLowerCase().trim();
    let matchedResults: SearchResultItem[] | null = null;

    for (const key of Object.keys(MOCK_DATASET)) {
      if (normalized.includes(key)) {
        matchedResults = MOCK_DATASET[key];
        break;
      }
    }

    if (!matchedResults) {
      // Deterministic generic mock results for unknown queries
      const cleanTerms = query.replace(/[^\w\s]/g, '').trim() || 'General Information';
      matchedResults = [
        {
          title: `${cleanTerms} - Overview & Information Guide`,
          url: `https://example.com/search/${encodeURIComponent(cleanTerms.toLowerCase().replace(/\s+/g, '-'))}`,
          snippet: `Comprehensive web search results and information guide for ${query}. Includes key facts, history, and user discussions.`,
          source: 'example.com',
          isMock: true,
        },
        {
          title: `Latest Updates & News regarding ${cleanTerms}`,
          url: `https://example.com/news/${encodeURIComponent(cleanTerms.toLowerCase().replace(/\s+/g, '-'))}`,
          snippet: `Recent developments, articles, and authoritative insights related to ${query}.`,
          source: 'example.com',
          isMock: true,
        },
        {
          title: `Frequently Asked Questions about ${cleanTerms}`,
          url: `https://example.com/faq/${encodeURIComponent(cleanTerms.toLowerCase().replace(/\s+/g, '-'))}`,
          snippet: `Common questions, answers, and community guidance about ${query}.`,
          source: 'example.com',
          isMock: true,
        },
      ];
    }

    const sliced = matchedResults.slice(0, maxResults);

    return {
      query,
      results: sliced,
      isMock: true,
      provider: 'mock',
      count: sliced.length,
    };
  }
}
