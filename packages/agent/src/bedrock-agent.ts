import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { AuditLogger } from '@actionos/tools';
import {
  fetchMcpTools,
  convertMcpToolsToBedrockConfig,
  executeMcpTool,
} from './mcp-client.js';

export interface BedrockAgentOptions {
  prompt?: string;
  messages?: any[];
  sessionId?: string;
  userId?: string;
  confirmationResponse?: {
    action: 'confirm' | 'cancel';
    pendingAction: any;
  };
  mcpServerUrl?: string;
}

export interface BedrockAgentResponse {
  text: string;
  isFallback?: boolean;
  requiresConfirmation?: boolean;
  pendingAction?: any;
  confirmationCard?: {
    title: string;
    details: Array<{ label: string; value: string }>;
    pendingAction: any;
  };
  bookingCard?: any;
  toolLogs?: Array<{
    id: string;
    name: string;
    status: 'waiting' | 'success' | 'failed';
    resultSummary: string;
    timestamp: string;
    durationMs?: number;
  }>;
}

const SYSTEM_PROMPT = `You are Alexa+ for OneWayFix, a friendly, knowledgeable assistant. Answer any question helpfully: short by default, detailed (causes, steps, comparisons) when asked. For home-repair topics (AC, washing machine, refrigerator, plumbing, electrical, appliances) act like an experienced technician: likely causes first, 1-3 safe checks the customer can do, and when a professional is needed. Never advise unsafe work (refrigerant gas, opening electrical panels, live wiring). Say when you are unsure; you cannot diagnose remotely. Use tools only when the user wants services, prices, or to book, check or cancel. After a troubleshooting answer, offer to book. Never invent services or prices; use list_services. To book, collect name, phone, address and preferred time, then call create_booking_request. Never set confirmed=true; only the UI Confirm button can. For voice, keep replies to 2-4 sentences and offer more detail in chat.`;

export async function runBedrockNovaAgent(
  options: BedrockAgentOptions
): Promise<BedrockAgentResponse> {
  const sessionId = options.sessionId || `session-${Date.now()}`;
  const userId = options.userId || 'user-default';
  const mcpServerUrl = options.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
  const toolLogs: NonNullable<BedrockAgentResponse['toolLogs']> = [];

  // 1. Handle user explicit confirmation card response (Confirm or Cancel)
  if (options.confirmationResponse) {
    const { action, pendingAction } = options.confirmationResponse;

    if (action === 'cancel') {
      AuditLogger.logEvent({
        sessionId,
        userId,
        toolName: pendingAction?.arguments?.bookingId ? 'cancel_booking' : 'create_booking_request',
        riskLevel: 'MEDIUM',
        input: pendingAction?.arguments || {},
        status: 'FAILED',
        confirmationRequired: true,
        confirmationStatus: 'REJECTED',
      });


      return {
        text: 'Understood. I have cancelled the pending request. Is there anything else I can help you with?',
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: pendingAction?.arguments?.bookingId ? 'cancel_booking' : 'create_booking_request',
            status: 'failed',
            resultSummary: 'User rejected action confirmation in UI',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      };
    }

    if (action === 'confirm' && pendingAction) {
      const isCancelTool = !!pendingAction.arguments?.bookingId && !pendingAction.arguments?.service;
      const toolName: string = isCancelTool ? 'cancel_booking' : 'create_booking_request';
      const startTime = Date.now();

      const confirmedArgs = {
        ...pendingAction.arguments,
        confirmed: true,
      };

      const result = await executeMcpTool(toolName, confirmedArgs, { sessionId, userId, isConfirmed: true }, mcpServerUrl);
      const duration = Date.now() - startTime;
      const data: any = result.data || {};

      if (result.success && data.booking) {
        const booking = data.booking;
        const text = isCancelTool
          ? `Done! OneWayFix booking ${booking.bookingId} has been successfully cancelled.`
          : `Great news! Your service booking with OneWayFix has been placed successfully. Your Booking ID is ${booking.bookingId}.`;

        return {
          text,
          bookingCard: booking,
          toolLogs: [
            {
              id: `log-${Date.now()}`,
              name: toolName,
              status: 'success',
              resultSummary: `Executed with confirmed=true. Booking ID: ${booking.bookingId} (${booking.status})`,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: duration,
            },
          ],
        };
      }

      return {
        text: `Failed to execute tool: ${result.error || 'Unknown error'}`,
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: toolName,
            status: 'failed',
            resultSummary: result.error || 'Execution failed',
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }

  }

  // 2. Discover MCP tools and format Bedrock toolConfig
  const mcpTools = await fetchMcpTools(mcpServerUrl);
  const toolConfig = convertMcpToolsToBedrockConfig(mcpTools);

  // 3. Initialize Bedrock Runtime Client
  const region = process.env.AWS_REGION || 'us-east-1';
  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';

  let bedrockClient: BedrockRuntimeClient | null = null;
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  } else {
    try {
      bedrockClient = new BedrockRuntimeClient({ region });
    } catch (_err) {
      bedrockClient = null;
    }
  }

  // Prepare initial conversation history (last 20 messages)
  const conversationMessages: any[] = options.messages
    ? [...options.messages.slice(-20)]
    : [
        {
          role: 'user',
          content: [{ text: options.prompt || 'Hello' }],
        },
      ];

  const MAX_STEPS = 6;
  let step = 0;

  // 4. Multi-step Bedrock Converse Loop
  while (step < MAX_STEPS) {
    step++;

    if (!bedrockClient || process.env.BEDROCK_MOCK === 'true') {
      const res = await runFallbackAssistantLoop(options.prompt || '', mcpServerUrl, { sessionId, userId });
      return { ...res, isFallback: true };
    }

    try {
      const commandInput: ConverseCommandInput = {
        modelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: conversationMessages,
        toolConfig: toolConfig as any,
        inferenceConfig: {
          maxTokens: 512,
          temperature: 0.2,
        },
      };

      const response = await bedrockClient.send(new ConverseCommand(commandInput));
      const outputMessage = response.output?.message;

      if (!outputMessage) {
        break;
      }

      conversationMessages.push(outputMessage);

      // Check if Nova requested toolUse
      const toolUseBlocks = outputMessage.content?.filter((c: any) => c.toolUse);

      if (toolUseBlocks && toolUseBlocks.length > 0) {
        const toolResults: any[] = [];

        for (const block of toolUseBlocks) {
          const { toolUseId, name, input } = block.toolUse!;
          const toolName: string = name || 'unknown_tool';
          const startTime = Date.now();

          // Execute tool via MCP client
          const result = await executeMcpTool(toolName, input as any, { sessionId, userId }, mcpServerUrl);
          const duration = Date.now() - startTime;

          // Check if tool returned CONFIRMATION_REQUIRED
          if (result.requiresConfirmation && result.pendingAction) {
            toolLogs.push({
              id: `log-${Date.now()}`,
              name: toolName,
              status: 'waiting',
              resultSummary: `Returned confirmation requirement for ${toolName}`,
              timestamp: new Date().toLocaleTimeString(),
              durationMs: duration,
            });

            const pendingArgs = result.pendingAction.arguments || {};
            const details = Object.entries(pendingArgs)
              .filter(([k]) => k !== 'confirmed')
              .map(([k, v]) => ({
                label: k === 'address' ? 'Service Address' : k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
                value: String(v),
              }));

            return {
              text: `I have summarized your request. Because this is a **MEDIUM** risk operation, please review the details below and click Confirm to proceed.`,
              requiresConfirmation: true,
              pendingAction: result.pendingAction,
              confirmationCard: {
                title: `Confirm ${toolName === 'cancel_booking' ? 'Cancellation' : 'Booking Request'}`,
                details,
                pendingAction: result.pendingAction,
              },
              toolLogs,
            };
          }

          toolLogs.push({
            id: `log-${Date.now()}`,
            name: toolName,
            status: result.success ? 'success' : 'failed',
            resultSummary: result.success
              ? `Executed ${toolName} successfully`
              : `Execution error: ${result.error || 'Failed'}`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          });


          toolResults.push({
            toolResult: {
              toolUseId,
              content: [{ json: (result.data || { result: result.error || 'Success' }) as any }],
              status: result.success ? 'success' : 'error',
            },
          });
        }

        // Send toolResult blocks back to Bedrock Nova
        conversationMessages.push({
          role: 'user',
          content: toolResults,
        });

        continue;
      }

      // No tool calls requested: return text reply from Nova
      const textBlock = outputMessage.content?.find((c: any) => c.text);
      const replyText = textBlock?.text || 'How else can I help you with OneWayFix home services?';

      return {
        text: replyText,
        toolLogs,
      };
    } catch (err: any) {
      AuditLogger.logEvent({
        sessionId,
        userId,
        toolName: 'bedrock_converse_agent',
        riskLevel: 'READ',
        input: { prompt: options.prompt, modelId, region },
        status: 'FAILED',
        confirmationRequired: false,
        errorCode: err.name || 'BedrockError',
        details: { message: err.message },
      });

      let friendlyError = `Amazon Bedrock Error (${err.name || 'Exception'}): ${err.message}`;
      if (err.name === 'AccessDeniedException') {
        friendlyError = `Access Denied: AWS credentials lack permission for Bedrock Converse API on model ${modelId}. Ensure IAM policy allows bedrock:InvokeModel.`;
      } else if (err.name === 'ThrottlingException') {
        friendlyError = `Bedrock request throttled by AWS. Please wait a moment and try again.`;
      } else if (err.name === 'ValidationException') {
        friendlyError = `Bedrock Validation Error: ${err.message}`;
      } else if (err.name === 'ResourceNotFoundException') {
        friendlyError = `Bedrock Model Not Found: ${modelId} in region ${region}.`;
      }

      const fallbackRes = await runFallbackAssistantLoop(options.prompt || '', mcpServerUrl, { sessionId, userId }, friendlyError);
      return { ...fallbackRes, isFallback: true };
    }
  }

  return {
    text: 'Reached maximum conversation steps with Bedrock agent.',
    toolLogs,
  };
}

/**
 * Fallback execution loop for local testing when AWS credentials are not set or fail
 */
async function runFallbackAssistantLoop(
  prompt: string,
  mcpServerUrl: string,
  context: { sessionId: string; userId: string },
  warningMsg?: string
): Promise<BedrockAgentResponse> {
  const trimmed = prompt.toLowerCase();

  // Intent: List services
  if (trimmed.includes('service') || trimmed.includes('offer') || trimmed.includes('catalog')) {
    const startTime = Date.now();
    const result = await executeMcpTool('list_services', {}, context, mcpServerUrl);
    const duration = Date.now() - startTime;

    const data: any = result.data || {};

    if (result.success && data.services) {
      const list = data.services
        .map((s: any) => `• **${s.name}** (${s.category}): ${s.price ? (typeof s.price === 'number' ? `₹${s.price}` : s.price) : `₹${s.priceINR || 699}`}`)
        .join('\n');

      return {
        text: `${warningMsg ? `⚠️ ${warningMsg}\n\n` : ''}Here are the home services currently available from OneWayFix:\n\n${list}\n\nWould you like me to book any of these services for you?`,
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: 'list_services',
            status: 'success',
            resultSummary: `Retrieved ${data.services.length} services`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }
  }

  // Intent: Get Booking Status
  if (trimmed.includes('status') || trimmed.includes('check') || trimmed.includes('owf-')) {
    const match = prompt.match(/OWF-\d+/i);
    const bookingId = match ? match[0].toUpperCase() : 'OWF-1001';

    const startTime = Date.now();
    const result = await executeMcpTool('get_booking_status', { bookingId }, context, mcpServerUrl);
    const duration = Date.now() - startTime;

    const data: any = result.data || {};

    if (result.success && data.booking) {
      const b = data.booking;
      return {
        text: `I checked status for **${b.bookingId}**:\n- Customer: ${b.customerName}\n- Service: ${b.service}\n- Status: ${b.status.toUpperCase()}\n- Scheduled: ${b.preferredTime}`,
        bookingCard: b,
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: 'get_booking_status',
            status: 'success',
            resultSummary: `Status for ${bookingId}: ${b.status}`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }
  }

  // Intent: Cancel Booking
  if (trimmed.includes('cancel')) {
    const match = prompt.match(/OWF-\d+/i);
    const bookingId = match ? match[0].toUpperCase() : 'OWF-1001';

    const startTime = Date.now();
    const result = await executeMcpTool('cancel_booking', { bookingId, confirmed: false }, context, mcpServerUrl);
    const duration = Date.now() - startTime;

    if (result.requiresConfirmation && result.pendingAction) {
      return {
        text: `I have summarized your cancellation request for **${bookingId}**. Please review the details below and click Confirm to cancel.`,
        requiresConfirmation: true,
        pendingAction: result.pendingAction,
        confirmationCard: {
          title: 'Confirm Booking Cancellation',
          details: [
            { label: 'Booking ID', value: bookingId },
            { label: 'Reason', value: 'Customer request via Alexa+' },
            { label: 'Action', value: 'Cancel OneWayFix Booking' },
          ],
          pendingAction: result.pendingAction,
        },
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: 'cancel_booking',
            status: 'waiting',
            resultSummary: `Prepared cancellation payload for ${bookingId}`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }
  }

  // Intent 1: Greetings & Small Talk
  if (
    trimmed === 'hi' ||
    trimmed === 'hello' ||
    trimmed.startsWith('hi ') ||
    trimmed.startsWith('hello ') ||
    trimmed.includes('hey') ||
    trimmed.includes('good morning') ||
    trimmed.includes('good evening') ||
    trimmed.includes('who are you')
  ) {
    return {
      text: `Hello! 👋 I'm **Alexa+** for OneWayFix, your friendly home-services AI technician.

I can help you with two things:
1. **Troubleshoot Home Repair Issues**: Ask me anything about ACs, plumbing, electrical wiring, or appliances (e.g., *"Why is my AC not cooling?"* or *"How to fix a leaking tap?"*).
2. **Book & Manage Services**: Schedule, check, or cancel OneWayFix technician visits.

What would you like assistance with today?`,
    };
  }

  // Intent 2: Experienced Technician Troubleshooting Questions & AI Solutions
  if (
    trimmed.includes('not cooling') ||
    trimmed.includes('leak') ||
    trimmed.includes('noise') ||
    trimmed.includes('not working') ||
    trimmed.includes('not heating') ||
    trimmed.includes('water') ||
    trimmed.includes('fuse') ||
    trimmed.includes('repair') ||
    trimmed.includes('fix') ||
    trimmed.includes('troubleshoot') ||
    trimmed.includes('why') ||
    trimmed.includes('how')
  ) {
    if (trimmed.includes('ac') || trimmed.includes('air conditioner') || trimmed.includes('cool')) {
      return {
        text: `🛠️ **AC Cooling Troubleshooting Guide**:

**Most Likely Causes**:
1. Dirty air filters restricting airflow.
2. Incorrect thermostat mode or temperature setting.
3. Dirty outdoor condenser coils or blocked ventilation.
4. Low refrigerant gas due to a minor leak.
5. Faulty capacitor or compressor issue.

**1-3 Safe DIY Checks You Can Do**:
- Check that remote mode is set to **COOL** (❄️) and set temperature to 24°C.
- Clean or wash the front mesh air filters.
- Ensure the outdoor unit is free of leaves, dust, or obstructions.

⚠️ **Safety Warning**: Never attempt to open the electrical panel, touch internal wiring, or handle refrigerant gas lines. Those require a certified technician.

*Would you like me to book an AC Repair & Deep Service technician visit for you?*`,
      };
    }

    if (trimmed.includes('plumb') || trimmed.includes('tap') || trimmed.includes('pipe') || trimmed.includes('sink')) {
      return {
        text: `🛠️ **Plumbing & Leak Troubleshooting Guide**:

**Most Likely Causes**:
1. Worn out washer or gasket inside the tap spindle.
2. Loose pipe joint or worn thread seal tape.
3. Clogged drain trap or mineral deposit buildup.

**Safe DIY Checks**:
- Tighten the tap handle firmly without over-torquing.
- Check under the sink for visible drips along the pipe joints.

⚠️ **Safety Warning**: If main supply lines are bursting, shut off your main home water valve immediately.

*Would you like me to book a Plumbing Leak Inspection & Repair technician visit for you?*`,
      };
    }

    if (trimmed.includes('electric') || trimmed.includes('switch') || trimmed.includes('power') || trimmed.includes('mcb')) {
      return {
        text: `🛠️ **Electrical Troubleshooting Guide**:

**Most Likely Causes**:
1. Overloaded circuit causing the MCB breaker to trip.
2. Loose wiring connection inside a switchboard.
3. Faulty appliance shorting out the circuit.

**Safe DIY Check**:
- Go to your main distribution board and check if any MCB switch has tripped to the DOWN position. Flip it UP once.

⚠️ **Safety Warning**: NEVER open switchboards, touch exposed wires, or work with wet hands. High voltage is dangerous.

*Would you like me to book an Electrical Wiring & Switchboard Fix technician visit for you?*`,
      };
    }

    return {
      text: `🛠️ **Home Repair Technician Advice**:

Home appliance and repair issues usually stem from:
1. Power supply or circuit breaker trips.
2. Wear-and-tear of internal components or filters.
3. Lack of periodic deep servicing.

**Recommended Safe Action**: Always check main power switches and clean accessible filters. Avoid opening internal motor compartments.

*Would you like me to list our available home services or book a technician for a complete inspection?*`,
    };
  }

  // Intent 3: Explicit Booking Request (ONLY when prompt asks to book/schedule)
  if (
    trimmed.includes('book') ||
    trimmed.includes('schedule') ||
    trimmed.includes('reserve') ||
    trimmed.includes('appointment') ||
    trimmed.includes('hire')
  ) {
    let serviceName = 'AC Repair & Deep Service';
    if (trimmed.includes('plumb') || trimmed.includes('leak') || trimmed.includes('tap')) {
      serviceName = 'Plumbing Leak Inspection & Repair';
    } else if (trimmed.includes('electric') || trimmed.includes('wire') || trimmed.includes('switch')) {
      serviceName = 'Electrical Wiring & Switchboard Fix';
    } else if (trimmed.includes('wash') || trimmed.includes('machine')) {
      serviceName = 'Washing Machine Repair & Service';
    } else if (trimmed.includes('fridge') || trimmed.includes('refrigerator')) {
      serviceName = 'Refrigerator Cooling & Compressor Repair';
    }

    const bookingArgs = {
      customerName: 'Priya Verma',
      phone: '+91 99887 76655',
      service: serviceName,
      address: '45 Park Street, Indiranagar, Bengaluru',
      preferredTime: 'Tomorrow at 11:00 AM',
      notes: 'Requested via Alexa+ voice assistant',
      confirmed: false,
    };

    const startTime = Date.now();
    const result = await executeMcpTool('create_booking_request', bookingArgs, context, mcpServerUrl);
    const duration = Date.now() - startTime;

    if (result.requiresConfirmation && result.pendingAction) {
      return {
        text: `I have prepared your **${serviceName}** booking request for OneWayFix. Please confirm the details below before I submit the booking.`,
        requiresConfirmation: true,
        pendingAction: result.pendingAction,
        confirmationCard: {
          title: 'Confirm OneWayFix Booking Request',
          details: [
            { label: 'Customer Name', value: bookingArgs.customerName },
            { label: 'Phone Number', value: bookingArgs.phone },
            { label: 'Service Requested', value: bookingArgs.service },
            { label: 'Service Address', value: bookingArgs.address },
            { label: 'Preferred Time', value: bookingArgs.preferredTime },
          ],
          pendingAction: result.pendingAction,
        },
        toolLogs: [
          {
            id: `log-${Date.now()}`,
            name: 'create_booking_request',
            status: 'waiting',
            resultSummary: `Prepared booking payload for ${bookingArgs.customerName}. Awaiting confirmation.`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: duration,
          },
        ],
      };
    }
  }

  // Default fallback conversational response (No unwanted booking card!)
  return {
    text: `Hello! I am **Alexa+** powered by Amazon Bedrock Nova & OneWayFix MCP tools.

I can help you with:
• **Technical Advice**: Ask troubleshooting questions about AC, plumbing, electrical, or appliances.
• **Service Catalog**: Ask *"What services do you offer?"*
• **Bookings**: Ask *"Book an AC repair for tomorrow"*
• **Status**: Ask *"Check status for OWF-1001"*

How can I help you right now?`,
  };
}
