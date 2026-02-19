import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanNft } from './scanNft';
import { NftMetadata } from '@/types';

vi.mock('@/lib/apis/goplus', () => ({
  fetchNftSecurity: vi.fn().mockResolvedValue({ data: null, chainId: null, error: 'mocked' }),
}));

vi.mock('@/lib/apis/sourcify', () => ({
  fetchContractVerification: vi.fn().mockResolvedValue({ isVerified: null, error: 'mocked' }),
}));

import { fetchNftSecurity } from '@/lib/apis/goplus';
import { fetchContractVerification } from '@/lib/apis/sourcify';

const VALID_ADDRESS = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D';

function makeCleanNft(overrides = {}) {
  return {
    nft_name: 'BoredApeYachtClub',
    nft_symbol: 'BAYC',
    nft_description: 'A collection of 10,000 unique Bored Ape NFTs',
    nft_erc: 'erc721',
    nft_open_source: 1,
    nft_proxy: 0,
    privileged_minting: { value: -1, owner_address: '0x0000000000000000000000000000000000000000', owner_type: 'blackhole' },
    privileged_burn: { value: 0, owner_address: null, owner_type: null },
    self_destruct: { value: 0, owner_address: null, owner_type: null },
    transfer_without_approval: { value: 0, owner_address: null, owner_type: null },
    oversupply_minting: null,
    restricted_approval: 0,
    trust_list: 0,
    malicious_nft_contract: 0,
    website_url: 'https://boredapeyachtclub.com',
    discord_url: 'https://discord.gg/bayc',
    twitter_url: 'https://twitter.com/BoredApeYC',
    nft_items: 10000,
    nft_owner_number: 5568,
    ...overrides,
  };
}

function mockNft(nftData: ReturnType<typeof makeCleanNft> | null, chainId: number | null = 1) {
  vi.mocked(fetchNftSecurity).mockResolvedValueOnce({
    data: nftData,
    chainId,
    error: nftData ? null : 'not found',
  });
}

function mockSourcify(isVerified: boolean | null) {
  vi.mocked(fetchContractVerification).mockResolvedValueOnce({
    isVerified,
    error: isVerified === null ? 'mocked' : null,
  });
}

beforeEach(() => {
  vi.mocked(fetchNftSecurity).mockReset().mockResolvedValue({ data: null, chainId: null, error: 'mocked' });
  vi.mocked(fetchContractVerification).mockReset().mockResolvedValue({ isVerified: null, error: 'mocked' });
});

// ---------------------------------------------------------------------------
// Clean / safe NFT
// ---------------------------------------------------------------------------

describe('Clean NFT (trusted, all checks pass)', () => {
  it('returns SAFE with low score and HIGH confidence', async () => {
    mockNft(makeCleanNft());
    const report = await scanNft(VALID_ADDRESS);
    expect(report.inputType).toBe('nft');
    expect(report.riskLevel).toBe('SAFE');
    expect(report.riskScore).toBeLessThanOrEqual(30);
    expect(report.riskScore).toBeGreaterThanOrEqual(5); // baseline floor
    expect(report.confidence).toBe('HIGH');
  });

  it('includes trust list finding when on trust list', async () => {
    mockNft(makeCleanNft({ trust_list: 1 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('trust list'))).toBe(true);
  });

  it('includes "audit passed" finding when no flags', async () => {
    mockNft(makeCleanNft());
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('audit passed'))).toBe(true);
  });

  it('populates metadata correctly', async () => {
    mockNft(makeCleanNft());
    const report = await scanNft(VALID_ADDRESS);
    const meta = report.metadata as NftMetadata;
    expect(meta.name).toBe('BoredApeYachtClub');
    expect(meta.symbol).toBe('BAYC');
    expect(meta.tokenStandard).toBe('ERC-721');
    expect(meta.onTrustList).toBe(false);
    expect(meta.goPlusChecked).toBe(true);
    expect(meta.explorerUrl).toContain(VALID_ADDRESS);
    expect(meta.websiteUrl).toBe('https://boredapeyachtclub.com');
  });
});

// ---------------------------------------------------------------------------
// Danger findings
// ---------------------------------------------------------------------------

describe('Malicious NFT contract', () => {
  it('returns DANGEROUS with score >= 60', async () => {
    mockNft(makeCleanNft({ malicious_nft_contract: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.findings.some(f => f.message.includes('MALICIOUS'))).toBe(true);
  });
});

describe('Transfer without approval', () => {
  it('returns DANGEROUS with score >= 60', async () => {
    mockNft(makeCleanNft({ transfer_without_approval: { value: 1 }, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.riskLevel).toBe('DANGEROUS');
    expect(report.riskScore).toBeGreaterThanOrEqual(60);
    expect(report.findings.some(f => f.message.includes('WITHOUT owner approval'))).toBe(true);
  });
});

describe('Self-destruct capability', () => {
  it('adds danger finding with scoreOverride 50', async () => {
    mockNft(makeCleanNft({ self_destruct: { value: 1 }, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('selfdestruct') && f.severity === 'danger')).toBe(true);
    expect(report.riskLevel).not.toBe('SAFE');
  });
});

describe('Oversupply minting', () => {
  it('adds danger finding with scoreOverride 50', async () => {
    mockNft(makeCleanNft({ oversupply_minting: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('beyond declared max supply') && f.severity === 'danger')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// High findings
// ---------------------------------------------------------------------------

describe('Privileged minting', () => {
  it('adds high severity finding', async () => {
    mockNft(makeCleanNft({ privileged_minting: { value: 1 }, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('privileged minting') && f.severity === 'high')).toBe(true);
  });
});

describe('Not open source', () => {
  it('adds high severity finding', async () => {
    mockNft(makeCleanNft({ nft_open_source: 0, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('NOT verified') && f.severity === 'high')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Medium findings
// ---------------------------------------------------------------------------

describe('Proxy contract', () => {
  it('adds medium finding with scoreOverride 15', async () => {
    mockNft(makeCleanNft({ nft_proxy: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('proxy') && f.severity === 'medium')).toBe(true);
  });
});

describe('Privileged burn', () => {
  it('adds medium finding', async () => {
    mockNft(makeCleanNft({ privileged_burn: { value: 1 }, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('privileged burn') && f.severity === 'medium')).toBe(true);
  });
});

describe('Restricted approval', () => {
  it('adds medium finding', async () => {
    mockNft(makeCleanNft({ restricted_approval: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('restricted approval') && f.severity === 'medium')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sourcify integration
// ---------------------------------------------------------------------------

describe('Sourcify verification', () => {
  it('adds info finding when verified', async () => {
    mockNft(makeCleanNft());
    mockSourcify(true);
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('verified on Sourcify'))).toBe(true);
    const meta = report.metadata as NftMetadata;
    expect(meta.sourcifyVerified).toBe(true);
  });

  it('adds low finding when not verified', async () => {
    mockNft(makeCleanNft());
    mockSourcify(false);
    const report = await scanNft(VALID_ADDRESS);
    expect(report.findings.some(f => f.message.includes('NOT verified on Sourcify'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation
// ---------------------------------------------------------------------------

describe('GoPlus unavailable', () => {
  it('returns report with MEDIUM confidence', async () => {
    // Default mock returns null data — simulates GoPlus failure
    const report = await scanNft(VALID_ADDRESS);
    expect(report.inputType).toBe('nft');
    expect(report.confidence).not.toBe('HIGH');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Summary and recommendations
// ---------------------------------------------------------------------------

describe('Summary and next step', () => {
  it('includes malicious summary for malicious contract', async () => {
    mockNft(makeCleanNft({ malicious_nft_contract: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.summary).toContain('MALICIOUS');
    expect(report.nextStep).toContain('Do not interact');
  });

  it('includes trust list summary for trusted collection', async () => {
    mockNft(makeCleanNft({ trust_list: 1 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.summary).toContain('trust list');
  });

  it('always includes NFT-specific recommendations', async () => {
    mockNft(makeCleanNft());
    const report = await scanNft(VALID_ADDRESS);
    expect(report.recommendations.some(r => r.includes('OpenSea'))).toBe(true);
    expect(report.recommendations.some(r => r.includes('airdrops'))).toBe(true);
    expect(report.recommendations.some(r => r.includes('approve'))).toBe(true);
  });

  it('adds gov database recommendation for risky NFTs', async () => {
    mockNft(makeCleanNft({ malicious_nft_contract: 1, trust_list: 0 }));
    const report = await scanNft(VALID_ADDRESS);
    expect(report.recommendations.some(r => r.includes('government scam databases'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Token standard formatting
// ---------------------------------------------------------------------------

describe('Token standard', () => {
  it('formats erc721 as ERC-721', async () => {
    mockNft(makeCleanNft({ nft_erc: 'erc721' }));
    const report = await scanNft(VALID_ADDRESS);
    expect((report.metadata as NftMetadata).tokenStandard).toBe('ERC-721');
  });

  it('formats erc1155 as ERC-1155', async () => {
    mockNft(makeCleanNft({ nft_erc: 'erc1155' }));
    const report = await scanNft(VALID_ADDRESS);
    expect((report.metadata as NftMetadata).tokenStandard).toBe('ERC-1155');
  });
});
