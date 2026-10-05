import { z } from 'zod';

export const RoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);

export const ToolCallRequestSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});

export const ChatMessageSchema = z.object({
  role: RoleSchema,
  content: z.string(),
  toolCalls: z.array(ToolCallRequestSchema).optional(),
  timestamp: z.string().optional(),
});

export const AgentRunRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  locationContext: z.string().optional(),
  travelPreferences: z.record(z.unknown()).optional(),
});

export const ConfirmationDecisionSchema = z.object({
  sessionId: z.string().min(1),
  actionId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
});
