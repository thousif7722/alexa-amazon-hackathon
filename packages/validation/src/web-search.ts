import { z } from 'zod';

export const SearchWebInputSchema = z.object({
  query: z
    .string()
    .min(2, 'Query must be at least 2 characters long')
    .max(500, 'Query cannot exceed 500 characters'),
  maxResults: z.number().int().min(1).max(10).default(5).optional(),
});

export type SearchWebInput = z.infer<typeof SearchWebInputSchema>;

export const OpenWebPageInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export type OpenWebPageInput = z.infer<typeof OpenWebPageInputSchema>;
