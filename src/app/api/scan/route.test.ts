import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock scanInput before importing the route
vi.mock('@/lib/scanners', () => ({
  scanInput: vi.fn().mockResolvedValue({
    inputType: 'url',
    inputValue: 'https://example.com',
    riskScore: 5,
    riskLevel: 'SAFE',
    confidence: 'HIGH',
    confidenceReason: 'mock',
    summary: 'mock',
    scoreBreakdown: [],
    findings: [],
    recommendations: [],
    timestamp: '2026-01-01T00:00:00.000Z',
  }),
}));

import { POST } from './route';
import { scanInput } from '@/lib/scanners';

// Helper to create a mock NextRequest
function mockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/scan', () => {
  it('returns 200 with report for valid input', async () => {
    const req = mockRequest({ input: 'https://example.com' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.inputType).toBe('url');
    expect(scanInput).toHaveBeenCalledWith('https://example.com');
  });

  it('returns 400 when input is missing', async () => {
    const req = mockRequest({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('valid input');
  });

  it('returns 400 when input is not a string', async () => {
    const req = mockRequest({ input: 12345 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when input is null', async () => {
    const req = mockRequest({ input: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when input exceeds 2000 characters', async () => {
    const req = mockRequest({ input: 'a'.repeat(2001) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('2000');
  });

  it('accepts input at exactly 2000 characters', async () => {
    const req = mockRequest({ input: 'a'.repeat(2000) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 500 when scanInput throws', async () => {
    vi.mocked(scanInput).mockRejectedValueOnce(new Error('scan failure'));
    const req = mockRequest({ input: 'https://example.com' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('error occurred');
  });

  it('extracts IP from x-forwarded-for header', async () => {
    const req = mockRequest(
      { input: 'https://example.com' },
      { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('extracts IP from x-real-ip header', async () => {
    const req = mockRequest(
      { input: 'https://example.com' },
      { 'x-real-ip': '10.0.0.1' }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });
});
