import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const score = parseInt(searchParams.get('score') || '0', 10);
  const level = searchParams.get('level') || 'SAFE';
  const type = searchParams.get('type') || 'unknown';
  const input = searchParams.get('input') || '';

  // Determine colors based on risk level
  const levelColors: Record<string, { bg: string; ring: string; text: string }> = {
    SAFE: { bg: '#064e3b', ring: '#10b981', text: '#6ee7b7' },
    SUSPICIOUS: { bg: '#713f12', ring: '#eab308', text: '#fde047' },
    DANGEROUS: { bg: '#7f1d1d', ring: '#ef4444', text: '#fca5a5' },
  };

  const colors = levelColors[level] || levelColors.SAFE;

  const typeLabels: Record<string, string> = {
    url: 'Website URL',
    token: 'Token Contract',
    txHash: 'Transaction Hash',
    wallet: 'Wallet Address',
    btcWallet: 'Bitcoin Address',
    solanaToken: 'Solana Token',
    unknown: 'Unknown Input',
  };

  const truncated = input.length > 40
    ? `${input.slice(0, 18)}...${input.slice(-12)}`
    : input;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0f',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{ fontSize: '28px', color: '#60a5fa', display: 'flex' }}>🛡️</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px' }}>
            ChainShield
          </div>
        </div>

        {/* Score ring (simplified) */}
        <div
          style={{
            width: '140px',
            height: '140px',
            borderRadius: '70px',
            border: `6px solid ${colors.ring}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            marginBottom: '24px',
          }}
        >
          <div style={{ fontSize: '48px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>/100</div>
        </div>

        {/* Risk level badge */}
        <div
          style={{
            padding: '8px 24px',
            borderRadius: '9999px',
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '1px',
            marginBottom: '20px',
          }}
        >
          {level}
        </div>

        {/* Input type + value */}
        <div style={{ fontSize: '16px', color: '#6b7280', marginBottom: '4px' }}>
          {typeLabels[type] || type}
        </div>
        {truncated && (
          <div style={{ fontSize: '18px', color: '#d1d5db', fontFamily: 'monospace' }}>
            {truncated}
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
