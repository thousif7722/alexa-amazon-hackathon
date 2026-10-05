import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '@actionos/types';
import {
  CreateBookingInputSchema,
  GetBookingStatusInputSchema,
  CancelBookingInputSchema,
  ListServicesInputSchema,
} from '@actionos/validation';
import { OneWayFixClient } from './client.js';
import { AuditLogger } from './audit.js';

// Shared client — constructed fresh each call so env vars are read at runtime
function getClient() { return new OneWayFixClient(); }

// 1. list_services
export const listServicesTool: ToolDefinition = {
  name: 'list_services',
  description:
    'Browse or search available home maintenance and repair services from OneWayFix (e.g. AC Repair, Plumbing, Electrical). Use this to check prices and available service options before creating a booking.',
  version: '1.0.0',
  category: 'services',
  riskLevel: 'READ',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Filter services by category (e.g. Home Appliances, Plumbing)' },
      query: { type: 'string', description: 'Search term for service name or description' },
    },
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const client = getClient();
    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'list_services',
      riskLevel: 'READ',
      input,
      status: 'REQUESTED',
      confirmationRequired: false,
    });

    try {
      const parsed = ListServicesInputSchema.parse(input);
      const services = await client.listServices(parsed.category, parsed.query);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'list_services',
        riskLevel: 'READ',
        input,
        status: 'SUCCESS',
        confirmationRequired: false,
        executionDurationMs: duration,
        details: { count: services.length },
      });

      return {
        success: true,
        toolName: 'list_services',
        data: { services, count: services.length },
        source: client.getIsMock() ? 'demo' : 'live',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'list_services',
        riskLevel: 'READ',
        input,
        status: 'FAILED',
        confirmationRequired: false,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'list_services',
        error: err.message,
        executionDurationMs: duration,
      };
    }
  },
};

// 2. create_booking_request (Voice Assistant Ready + Inline Confirmation)
export const createBookingRequestTool: ToolDefinition = {
  name: 'create_booking_request',
  description:
    'Submit a service booking request to OneWayFix. Voice assistant instructions: First collect any missing details from the customer (customer name, phone number, service address, and preferred time). Then summarize all details to the customer and ask for their explicit confirmation. ONLY set confirmed=true after the customer explicitly agrees to proceed with the booking.',
  version: '1.0.0',
  category: 'booking',
  riskLevel: 'MEDIUM',
  inputSchema: {
    type: 'object',
    properties: {
      customerName: { type: 'string', description: 'Customer full name' },
      phone: { type: 'string', description: 'Customer contact phone number' },
      service: { type: 'string', description: 'Service name (e.g. AC Repair & Service)' },
      address: { type: 'string', description: 'Complete service delivery address' },
      preferredTime: { type: 'string', description: 'Preferred date & time for service visit' },
      notes: { type: 'string', description: 'Additional instructions or notes' },
      source: { type: 'string', description: 'Booking source system tag' },
      confirmed: {
        type: 'boolean',
        description: 'Set to true ONLY after customer explicitly confirms booking details',
        default: false,
      },
    },
    required: ['customerName', 'phone', 'service', 'address', 'preferredTime'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const client = getClient();

    // ── SECURITY GUARD: strip any confirmed=true sent by the model ──────────
    // confirmed=true is ONLY set when the web UI Confirm button is pressed
    // (context.isConfirmed). The model must never be able to bypass this.
    const safeInput = { ...input, confirmed: false };

    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'create_booking_request',
      riskLevel: 'MEDIUM',
      input: safeInput,
      status: 'REQUESTED',
      confirmationRequired: true,
    });

    try {
      const parsed = CreateBookingInputSchema.parse(safeInput);

      // Validate service against 21-service seed catalog
      const matchedService = await client.matchService(parsed.service);
      if (!matchedService) {
        const all = await client.listServices();
        const validNames = all.map((s) => s.name).join(', ');
        const errorMsg = `Service '${parsed.service}' is not recognised. Available services: ${validNames}`;
        AuditLogger.logEvent({
          sessionId: context?.sessionId, userId: context?.userId,
          toolName: 'create_booking_request', riskLevel: 'MEDIUM',
          input: safeInput, status: 'FAILED', confirmationRequired: false, errorCode: errorMsg,
        });
        return { success: false, toolName: 'create_booking_request', error: errorMsg, executionDurationMs: Date.now() - startTime };
      }
      parsed.service = matchedService.name;

      // confirmed is true when the UI sends it via context.isConfirmed or input.confirmed=true
      const isConfirmed = context?.isConfirmed || input.confirmed === true;

      if (!isConfirmed) {
        const actionId = `act-${Date.now()}`;
        const summary = `Booking Request Summary:\n- Customer Name: ${parsed.customerName}\n- Phone Number: ${parsed.phone}\n- Service Requested: ${parsed.service}\n- Address: ${parsed.address}\n- Preferred Time: ${parsed.preferredTime}${parsed.notes ? `\n- Notes: ${parsed.notes}` : ''}\n\nWould you like me to confirm and place this booking with OneWayFix now? (Set confirmed=true to finalize)`;

        AuditLogger.logEvent({
          sessionId: context?.sessionId,
          userId: context?.userId,
          toolName: 'create_booking_request',
          riskLevel: 'MEDIUM',
          input,
          status: 'CONFIRMATION_REQUIRED',
          confirmationRequired: true,
          confirmationStatus: 'PENDING',
          details: { pendingActionId: actionId, description: summary },
        });

        return {
          success: true,
          toolName: 'create_booking_request',
          requiresConfirmation: true,
          pendingAction: {
            id: actionId,
            description: summary,
            riskLevel: 'MEDIUM',
            arguments: parsed,
          },
          data: {
            message: summary,
            summary,
            confirmed: false,
          },
        };
      }

      // Execution after confirmation
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'create_booking_request',
        riskLevel: 'MEDIUM',
        input,
        status: 'EXECUTING',
        confirmationRequired: true,
        confirmationStatus: 'APPROVED',
      });

      const booking = await client.createBooking(parsed);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'create_booking_request',
        riskLevel: 'MEDIUM',
        input,
        status: 'SUCCESS',
        confirmationRequired: true,
        confirmationStatus: 'APPROVED',
        executionDurationMs: duration,
        details: { bookingId: booking.bookingId },
      });

      const successSummary = `Booking created successfully!\n- Booking ID: ${booking.bookingId}\n- Status: ${booking.status}\n- Customer: ${booking.customerName}\n- Service: ${booking.service}\n- Address: ${booking.address}\n- Time: ${booking.preferredTime}`;

      return {
        success: true,
        toolName: 'create_booking_request',
        data: {
          booking,
          message: successSummary,
          summary: successSummary,
          confirmed: true,
        },
        source: client.getIsMock() ? 'demo' : 'live',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'create_booking_request',
        riskLevel: 'MEDIUM',
        input,
        status: 'FAILED',
        confirmationRequired: true,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'create_booking_request',
        error: err.message,
        executionDurationMs: duration,
      };
    }
  },
};

// 3. get_booking_status
export const getBookingStatusTool: ToolDefinition = {
  name: 'get_booking_status',
  description: 'Check real-time status and details of an existing OneWayFix service booking using its unique booking ID (e.g. OWF-1001).',
  version: '1.0.0',
  category: 'booking',
  riskLevel: 'READ',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: { type: 'string', description: 'The unique OneWayFix Booking ID (e.g. OWF-1001)' },
    },
    required: ['bookingId'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const client = getClient();
    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'get_booking_status',
      riskLevel: 'READ',
      input,
      status: 'REQUESTED',
      confirmationRequired: false,
    });

    try {
      const parsed = GetBookingStatusInputSchema.parse(input);
      const booking = await client.getBookingStatus(parsed.bookingId);
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'get_booking_status',
        riskLevel: 'READ',
        input,
        status: 'SUCCESS',
        confirmationRequired: false,
        executionDurationMs: duration,
        details: { bookingId: booking.bookingId, status: booking.status },
      });

      const summary = `Booking ${booking.bookingId} Details:\n- Customer: ${booking.customerName}\n- Service: ${booking.service}\n- Status: ${booking.status}\n- Address: ${booking.address}\n- Time: ${booking.preferredTime}`;

      return {
        success: true,
        toolName: 'get_booking_status',
        data: { booking, summary, message: summary },
        source: client.getIsMock() ? 'demo' : 'live',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'get_booking_status',
        riskLevel: 'READ',
        input,
        status: 'FAILED',
        confirmationRequired: false,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'get_booking_status',
        error: err.message,
        executionDurationMs: duration,
      };
    }
  },
};

// 4. cancel_booking (Voice Assistant Ready + Inline Confirmation)
export const cancelBookingTool: ToolDefinition = {
  name: 'cancel_booking',
  description:
    'Cancel an existing OneWayFix service booking. Voice assistant instructions: First specify the booking ID and reason. Then summarize the cancellation request to the customer and ask for their explicit confirmation. ONLY set confirmed=true after the customer explicitly agrees to cancel.',
  version: '1.0.0',
  category: 'booking',
  riskLevel: 'MEDIUM',
  inputSchema: {
    type: 'object',
    properties: {
      bookingId: { type: 'string', description: 'The unique OneWayFix Booking ID to cancel' },
      reason: { type: 'string', description: 'Reason for cancellation' },
      confirmed: {
        type: 'boolean',
        description: 'Set to true ONLY after customer explicitly confirms cancellation',
        default: false,
      },
    },
    required: ['bookingId'],
  },
  async execute(input: Record<string, unknown>, context?: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const client = getClient();

    // SECURITY GUARD: strip confirmed from model input
    const safeInput = { ...input, confirmed: false };

    AuditLogger.logEvent({
      sessionId: context?.sessionId,
      userId: context?.userId,
      toolName: 'cancel_booking',
      riskLevel: 'MEDIUM',
      input: safeInput,
      status: 'REQUESTED',
      confirmationRequired: true,
    });

    try {
      const parsed = CancelBookingInputSchema.parse(safeInput);

      // confirmed is true when UI sends context.isConfirmed or input.confirmed=true
      const isConfirmed = context?.isConfirmed || input.confirmed === true;

      if (!isConfirmed) {
        const actionId = `act-${Date.now()}`;
        const summary = `Cancellation Request Summary:\n- Booking ID: ${parsed.bookingId}${parsed.reason ? `\n- Reason: ${parsed.reason}` : ''}\n\nAre you sure you want to cancel this booking with OneWayFix? (Set confirmed=true to finalize)`;

        AuditLogger.logEvent({
          sessionId: context?.sessionId,
          userId: context?.userId,
          toolName: 'cancel_booking',
          riskLevel: 'MEDIUM',
          input,
          status: 'CONFIRMATION_REQUIRED',
          confirmationRequired: true,
          confirmationStatus: 'PENDING',
          details: { pendingActionId: actionId, description: summary },
        });

        return {
          success: true,
          toolName: 'cancel_booking',
          requiresConfirmation: true,
          pendingAction: {
            id: actionId,
            description: summary,
            riskLevel: 'MEDIUM',
            arguments: parsed,
          },
          data: {
            message: summary,
            summary,
            confirmed: false,
          },
        };
      }

      // Execution after confirmation
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'cancel_booking',
        riskLevel: 'MEDIUM',
        input,
        status: 'EXECUTING',
        confirmationRequired: true,
        confirmationStatus: 'APPROVED',
      });

      const booking = await client.cancelBooking(parsed.bookingId, parsed.reason || '');
      const duration = Date.now() - startTime;

      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'cancel_booking',
        riskLevel: 'MEDIUM',
        input,
        status: 'SUCCESS',
        confirmationRequired: true,
        confirmationStatus: 'APPROVED',
        executionDurationMs: duration,
        details: { bookingId: booking.bookingId, status: booking.status },
      });

      const successSummary = `Booking ${booking.bookingId} cancelled successfully.\n- Status: ${booking.status}`;

      return {
        success: true,
        toolName: 'cancel_booking',
        data: {
          booking,
          message: successSummary,
          summary: successSummary,
          confirmed: true,
        },
        source: client.getIsMock() ? 'demo' : 'live',
        executionDurationMs: duration,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AuditLogger.logEvent({
        sessionId: context?.sessionId,
        userId: context?.userId,
        toolName: 'cancel_booking',
        riskLevel: 'MEDIUM',
        input,
        status: 'FAILED',
        confirmationRequired: true,
        executionDurationMs: duration,
        errorCode: err.message,
      });

      return {
        success: false,
        toolName: 'cancel_booking',
        error: err.message,
        executionDurationMs: duration,
      };
    }
  },
};

export const oneWayFixTools: ToolDefinition[] = [
  listServicesTool,
  createBookingRequestTool,
  getBookingStatusTool,
  cancelBookingTool,
];
