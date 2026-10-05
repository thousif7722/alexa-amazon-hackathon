import { NextResponse } from 'next/server';
import { runBedrockNovaAgent } from '@actionos/agent';
import { z } from '@actionos/validation';

export const runtime = 'nodejs';

// Simple sliding-window rate limiter: max 30 requests per minute per IP
const rateMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MIN = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - 60 * 1000;
  const timestamps = (rateMap.get(ip) || []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS_PER_MIN) {
    return false;
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return true;
}

const RequestSchema = z.object({
  message: z.string().optional().default(''),
  messages: z.array(z.any()).optional(),
  confirmationResponse: z
    .object({
      action: z.enum(['confirm', 'cancel']),
      pendingAction: z.any(),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          text: 'Rate limit exceeded. Please wait a moment before sending another message.',
          error: 'Rate limit exceeded (30 req/min).',
        },
        { status: 429 }
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { text: 'Invalid request payload format.', error: parsed.error.message },
        { status: 400 }
      );
    }

    const { message, messages, confirmationResponse } = parsed.data;

    const result = await runBedrockNovaAgent({
      prompt: message,
      messages,
      confirmationResponse: confirmationResponse as any,
      sessionId: `web-session-${Date.now()}`,
      userId: 'user-web-demo',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        text: 'An unexpected error occurred while processing your request. Please try again.',
        error: err.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
