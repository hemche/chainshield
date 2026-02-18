import { NextRequest, NextResponse } from 'next/server';
import { scanInput } from '@/lib/scanners';

// Disable default request logging for privacy
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter (per IP, 30 requests / 60 seconds)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
/** Max unique IPs tracked to prevent memory exhaustion from spoofed headers */
const RATE_LIMIT_MAX_ENTRIES = 10_000;

const requestLog = new Map<string, number[]>();

// Periodic cleanup to prevent memory growth (every 2 minutes)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 120_000) return;
  lastCleanup = now;
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  for (const [ip, timestamps] of requestLog) {
    const recent = timestamps.filter(t => t > cutoff);
    if (recent.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, recent);
    }
  }
}

function isRateLimited(ip: string): boolean {
  cleanupStaleEntries();

  // If Map is too large (potential header spoofing attack), force-limit unknown IPs
  if (requestLog.size >= RATE_LIMIT_MAX_ENTRIES && !requestLog.has(ip)) {
    return true;
  }

  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(ip) || []).filter(t => t > cutoff);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function getClientIp(request: NextRequest): string {
  // In production behind a reverse proxy (Vercel, Cloudflare), these headers
  // are set by the proxy and cannot be spoofed by clients. In direct-exposure
  // deployments, these headers can be forged — deploy behind a reverse proxy.
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { input } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid input to scan' },
        { status: 400 }
      );
    }

    // Limit input length to prevent abuse
    if (input.length > 2000) {
      return NextResponse.json(
        { error: 'Input too long. Maximum 2000 characters.' },
        { status: 400 }
      );
    }

    const report = await scanInput(input);

    // Do NOT log the input or report — privacy first
    return NextResponse.json(report);
  } catch (error) {
    console.error('Scan error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'An error occurred while scanning. Please try again.' },
      { status: 500 }
    );
  }
}
