import { z } from 'zod';

export const RiskLevelSchema = z.enum(['READ', 'WRITE', 'SENSITIVE', 'LOW', 'MEDIUM', 'HIGH']);

export const ToolCategorySchema = z.enum(['information', 'travel', 'booking', 'services']);

export const ToolExecuteParamsSchema = z.object({
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()),
  sessionId: z.string().min(1),
  actionId: z.string().optional(),
});
