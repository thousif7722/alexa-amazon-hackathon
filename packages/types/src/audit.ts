import { RiskLevel } from './risk.js';

export type AuditStatus =
  | 'REQUESTED'
  | 'VALIDATED'
  | 'CONFIRMATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT';

export interface AuditEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  userId?: string;
  toolName: string;
  riskLevel: RiskLevel;
  inputHash: string;
  status: AuditStatus;
  confirmationRequired: boolean;
  confirmationStatus?: string;
  executionDurationMs?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
}
