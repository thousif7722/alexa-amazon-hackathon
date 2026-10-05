import { NextResponse } from 'next/server';
import { runActionOSAgent } from '@actionos/agent';
import { z } from '@actionos/validation';

export const runtime = 'nodejs';

// Rate limiter: max 40 requests per minute per IP
const rateMap = new Map<string, number[]>();
const MAX_REQUESTS_PER_MIN = 40;

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
  prompt: z.string().optional(),
  message: z.string().optional(),
  messages: z.array(z.any()).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  modelProvider: z.string().optional(),
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
          error: 'Rate limit exceeded (40 req/min).',
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

    const { prompt, message, messages, sessionId, userId, modelProvider, confirmationResponse } = parsed.data;
    const userPrompt = prompt || message || '';

    // Preserve session continuity if provided, otherwise generate fallback ID
    const activeSessionId = sessionId || `session-${Date.now()}`;
    const activeUserId = userId || 'user-web-demo';

    const result = await runActionOSAgent({
      prompt: userPrompt,
      messages,
      confirmationResponse: confirmationResponse as any,
      sessionId: activeSessionId,
      userId: activeUserId,
      modelProvider: modelProvider || process.env.MODEL_PROVIDER || 'gemini',
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
