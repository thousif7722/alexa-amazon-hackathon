import { AuditEvent, AuditStatus, RiskLevel } from '@actionos/types';

export class AuditLogger {
  private static events: AuditEvent[] = [];

  public static logEvent(params: {
    sessionId?: string;
    userId?: string;
    toolName: string;
    riskLevel: RiskLevel;
    input: Record<string, unknown>;
    status: AuditStatus;
    confirmationRequired: boolean;
    confirmationStatus?: string;
    executionDurationMs?: number;
    errorCode?: string;
    details?: Record<string, unknown>;
  }): AuditEvent {
    const inputHash = AuditLogger.hashInput(params.input);
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      sessionId: params.sessionId || 'session-default',
      userId: params.userId,
      toolName: params.toolName,
      riskLevel: params.riskLevel,
      inputHash,
      status: params.status,
      confirmationRequired: params.confirmationRequired,
      confirmationStatus: params.confirmationStatus,
      executionDurationMs: params.executionDurationMs,
      errorCode: params.errorCode,
      details: {
        ...params.details,
        inputPayload: params.input,
      },
    };

    AuditLogger.events.push(event);
    console.log(`[AUDIT] [${event.status}] ${event.toolName} (Risk: ${event.riskLevel}) - Session: ${event.sessionId}`);
    return event;
  }

  public static getEvents(): AuditEvent[] {
    return [...AuditLogger.events];
  }

  public static clearEvents(): void {
    AuditLogger.events = [];
  }

  private static hashInput(input: Record<string, unknown>): string {
    const str = JSON.stringify(input || {});
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `h_${Math.abs(hash).toString(16)}`;
  }
}
