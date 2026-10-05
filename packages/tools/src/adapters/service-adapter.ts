import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '@actionos/types';

export interface ExternalServiceHandoff {
  serviceName: string;
  category: 'ride' | 'food' | 'grocery' | 'travel';
  directBookingAvailable: boolean;
  statusMessage: string;
  recommendations: Array<{ title: string; subtitle: string }>;
  officialHandoffUrl: string;
  dataStatusTag: 'UNAVAILABLE' | 'RECOMMENDED';
}

export const externalServiceAdapterTool: ToolDefinition = {
  name: 'external_service_request',
  description: 'Check service availability or request rides, food delivery, or groceries from external platforms (Rapido, Zomato, Blinkit, Swiggy, Uber).',
  version: '1.0.0',
  category: 'services',
  riskLevel: 'READ',
  inputSchema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: 'Platform name (rapido, zomato, blinkit, swiggy, uber, makemytrip)' },
      query: { type: 'string', description: 'Search query or destination (e.g. ride to Charminar, order biryani)' },
    },
    required: ['platform'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const platform = String(input.platform || 'general').toLowerCase().trim();
    const query = String(input.query || '');

    const handoffMap: Record<string, ExternalServiceHandoff> = {
      rapido: {
        serviceName: 'Rapido Bike & Auto Ride',
        category: 'ride',
        directBookingAvailable: false,
        statusMessage: 'Direct booking integration unavailable. Official Rapido app handoff recommended.',
        recommendations: [
          { title: 'Bike Taxi', subtitle: 'Fastest for city traffic (~₹40-₹80)' },
          { title: 'Auto Rickshaw', subtitle: 'Convenient 3-wheeler ride (~₹70-₹150)' },
        ],
        officialHandoffUrl: `https://www.rapido.bike/?query=${encodeURIComponent(query)}`,
        dataStatusTag: 'UNAVAILABLE',
      },
      zomato: {
        serviceName: 'Zomato Food Delivery & Dining',
        category: 'food',
        directBookingAvailable: false,
        statusMessage: 'Direct food order integration unavailable. Official Zomato web handoff provided.',
        recommendations: [
          { title: 'Hyderabadi Biryani', subtitle: 'Top rated local restaurants nearby' },
          { title: 'Desserts & Shakes', subtitle: 'Delivered in 25-35 minutes' },
        ],
        officialHandoffUrl: `https://www.zomato.com/search?q=${encodeURIComponent(query || 'biryani')}`,
        dataStatusTag: 'UNAVAILABLE',
      },
      blinkit: {
        serviceName: 'Blinkit Instant Groceries',
        category: 'grocery',
        directBookingAvailable: false,
        statusMessage: 'Direct grocery checkout unavailable. Official Blinkit handoff link provided.',
        recommendations: [
          { title: '10-Minute Delivery', subtitle: 'Fresh fruits, snacks, and daily essentials' },
        ],
        officialHandoffUrl: `https://blinkit.com/s/?q=${encodeURIComponent(query || 'groceries')}`,
        dataStatusTag: 'UNAVAILABLE',
      },
      uber: {
        serviceName: 'Uber Rides',
        category: 'ride',
        directBookingAvailable: false,
        statusMessage: 'Direct Uber booking unavailable. Official Uber link available.',
        recommendations: [
          { title: 'Uber Go', subtitle: 'Affordable compact rides' },
          { title: 'Uber Premier', subtitle: 'Top rated sedans' },
        ],
        officialHandoffUrl: `https://m.uber.com/ul/?action=setPickup`,
        dataStatusTag: 'UNAVAILABLE',
      },
    };

    const resultHandoff = handoffMap[platform] || {
      serviceName: `${platform.toUpperCase()} Service`,
      category: 'travel',
      directBookingAvailable: false,
      statusMessage: `Direct API integration for ${platform} is currently unavailable.`,
      recommendations: [{ title: 'Official Search', subtitle: 'Explore official platform options' }],
      officialHandoffUrl: `https://www.google.com/search?q=${encodeURIComponent(`${platform} ${query}`)}`,
      dataStatusTag: 'UNAVAILABLE',
    };

    return {
      success: true,
      toolName: 'external_service_request',
      data: resultHandoff,
      executionDurationMs: 15,
    };
  },
};
