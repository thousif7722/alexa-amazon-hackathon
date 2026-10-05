import { z } from 'zod';

export const MCPCallToolRequestSchema = z.object({
  params: z.object({
    name: z.string().min(1),
    arguments: z.record(z.unknown()).optional(),
  }),
});
