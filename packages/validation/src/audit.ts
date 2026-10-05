import { z } from 'zod';
import { RiskLevelSchema } from './tools.js';

export const AuditStatusSchema = z.enum([
  'REQUESTED',
  'VALIDATED',
  'CONFIRMATION_REQUIRED',
  'APPROVED',
  'REJECTED',
  'EXECUTING',
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
]);

export const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  sessionId: z.string(),
  userId: z.string().optional(),
  toolName: z.string(),
  riskLevel: RiskLevelSchema,
  inputHash: z.string(),
  status: AuditStatusSchema,
  confirmationRequired: z.boolean(),
  confirmationStatus: z.string().optional(),
  executionDurationMs: z.number().optional(),
  errorCode: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
