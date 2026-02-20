// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportCard from './ReportCard';
import { SafetyReport } from '@/types';

function makeReport(overrides: Partial<SafetyReport> = {}): SafetyReport {
  return {
    inputType: 'url',
    inputValue: 'https://example.com',
    riskScore: 5,
    riskLevel: 'SAFE',
    confidence: 'HIGH',
    confidenceReason: 'Trusted domain with HTTPS',
    summary: 'This site appears safe.',
    scoreBreakdown: [{ label: 'Baseline floor', scoreImpact: 5 }],
    nextStep: 'No action needed.',
    findings: [],
    recommendations: ['Always verify URLs before entering credentials.'],
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderReport(overrides: Partial<SafetyReport> = {}) {
  const onCopyReport = vi.fn();
  const onNewScan = vi.fn();
  const report = makeReport(overrides);
  const utils = render(
    <ReportCard report={report} onCopyReport={onCopyReport} onNewScan={onNewScan} />
  );
  return { ...utils, onCopyReport, onNewScan, report };
}

describe('ReportCard', () => {
  describe('header section', () => {
    it('renders the risk score', () => {
      renderReport({ riskScore: 42 });
      expect(screen.getByText('42')).toBeDefined();
    });

    it('renders the risk level badge', () => {
      renderReport({ riskLevel: 'SUSPICIOUS' });
      expect(screen.getByText('SUSPICIOUS')).toBeDefined();
    });

    it('renders the confidence badge', () => {
      renderReport({ confidence: 'MEDIUM' });
      expect(screen.getByText('MEDIUM confidence')).toBeDefined();
    });

    it('renders the input type label', () => {
      renderReport({ inputType: 'token' });
      expect(screen.getByText('Token Contract')).toBeDefined();
    });

    it('renders Solana Token label', () => {
      renderReport({ inputType: 'solanaToken' });
      expect(screen.getByText('Solana Token')).toBeDefined();
    });

    it('shortens long tx hashes', () => {
      const hash = '0x' + 'a'.repeat(64);
      renderReport({ inputType: 'txHash', inputValue: hash });
      // Should show shortened version, not the full hash
      expect(screen.getByText(`${hash.slice(0, 10)}...${hash.slice(-8)}`)).toBeDefined();
    });

    it('shortens wallet addresses', () => {
      const addr = '0x' + 'b'.repeat(40);
      renderReport({ inputType: 'wallet', inputValue: addr });
      expect(screen.getByText(`${addr.slice(0, 8)}...${addr.slice(-6)}`)).toBeDefined();
    });
  });

  describe('summary section', () => {
    it('renders summary text', () => {
      renderReport({ summary: 'This is a test summary.' });
      expect(screen.getByText('This is a test summary.')).toBeDefined();
    });

    it('renders confidence reason', () => {
      renderReport({ confidenceReason: 'Test reason here' });
      expect(screen.getByText('Test reason here')).toBeDefined();
    });

    it('renders the next step', () => {
      renderReport({ nextStep: 'Do something next.' });
      expect(screen.getByText('Do something next.')).toBeDefined();
    });
  });

  describe('findings section', () => {
    it('shows all-clear message when no findings', () => {
      renderReport({ findings: [] });
      expect(screen.getByText(/all checks passed/i)).toBeDefined();
    });

    it('renders findings list', () => {
      renderReport({
        findings: [
          { message: 'Uses HTTP instead of HTTPS', severity: 'high' },
          { message: 'Valid SSL certificate', severity: 'info' },
        ],
      });
      expect(screen.getByText('Uses HTTP instead of HTTPS')).toBeDefined();
      expect(screen.getByText('Valid SSL certificate')).toBeDefined();
    });
  });

  describe('recommendations section', () => {
    it('renders recommendations', () => {
      renderReport({
        recommendations: ['Check the contract source code.', 'Use a hardware wallet.'],
      });
      expect(screen.getByText('Check the contract source code.')).toBeDefined();
      expect(screen.getByText('Use a hardware wallet.')).toBeDefined();
    });
  });

  describe('collapsible sections', () => {
    it('toggles score breakdown on click', () => {
      renderReport({
        scoreBreakdown: [
          { label: 'Suspicious TLD', scoreImpact: 15 },
          { label: 'Baseline', scoreImpact: 5 },
        ],
      });
      // Breakdown should be collapsed initially
      expect(screen.queryByText('Suspicious TLD')).toBeNull();

      // Click to open
      fireEvent.click(screen.getByText(/why this score/i));
      expect(screen.getByText('Suspicious TLD')).toBeDefined();
      expect(screen.getByText('+15')).toBeDefined();
      expect(screen.getByText('+5')).toBeDefined();
    });

    it('toggles checks performed on click', () => {
      renderReport({
        checksPerformed: [
          { label: 'HTTPS check', passed: true },
          { label: 'Phishing DB', passed: false, detail: 'unavailable' },
        ],
      });

      // Should show count in title
      expect(screen.getByText(/checks performed \(1\/2\)/i)).toBeDefined();

      // Content collapsed initially
      expect(screen.queryByText('HTTPS check')).toBeNull();

      // Click to expand
      fireEvent.click(screen.getByText(/checks performed/i));
      expect(screen.getByText('HTTPS check')).toBeDefined();
      expect(screen.getByText('Phishing DB')).toBeDefined();
      expect(screen.getByText('unavailable')).toBeDefined();
    });
  });

  describe('invalid address warning', () => {
    it('shows warning for invalidAddress type', () => {
      renderReport({ inputType: 'invalidAddress' });
      expect(screen.getByText(/invalid address.*checksum failed/i)).toBeDefined();
    });

    it('does not show warning for valid types', () => {
      renderReport({ inputType: 'wallet' });
      expect(screen.queryByText(/checksum failed/i)).toBeNull();
    });
  });

  describe('metadata cards', () => {
    it('renders URL metadata', () => {
      renderReport({
        inputType: 'url',
        metadata: {
          hostname: 'example.com',
          protocol: 'https',
          isHttps: true,
          urlReachable: true,
          statusCode: 200,
        },
      });
      expect(screen.getByText('example.com')).toBeDefined();
      expect(screen.getByText('Yes (200)')).toBeDefined();
    });

    it('renders token metadata with DexScreener link', () => {
      renderReport({
        inputType: 'token',
        metadata: {
          name: 'TestToken',
          symbol: 'TT',
          chain: 'Ethereum',
          dex: 'Uniswap',
          liquidityUsd: 50000,
          dexscreenerUrl: 'https://dexscreener.com/test',
        },
      });
      expect(screen.getByText('TestToken (TT)')).toBeDefined();
      expect(screen.getByText('$50,000')).toBeDefined();
      expect(screen.getByText('View on DexScreener')).toBeDefined();
    });

    it('renders Solana metadata with Solscan link', () => {
      renderReport({
        inputType: 'solanaToken',
        metadata: {
          name: 'SolToken',
          symbol: 'SOL',
          chain: 'Solana',
          dex: 'Raydium',
          liquidityUsd: 25000,
          mintAddress: 'SomeAddress123',
          dexscreenerUrl: 'https://dexscreener.com/solana/test',
        },
      });
      expect(screen.getByText('SolToken (SOL)')).toBeDefined();
      expect(screen.getByText('View on Solscan')).toBeDefined();
    });

    it('renders wallet metadata with explorer links', () => {
      renderReport({
        inputType: 'wallet',
        metadata: {
          explorerUrls: [
            { name: 'Etherscan', url: 'https://etherscan.io/address/0x...' },
          ],
        },
      });
      expect(screen.getByText('Etherscan')).toBeDefined();
    });

    it('renders tx metadata with detected chain highlighted', () => {
      renderReport({
        inputType: 'txHash',
        inputValue: '0x' + 'a'.repeat(64),
        metadata: {
          chain: 'Ethereum',
          detectedChain: 'Ethereum',
        },
      });
      expect(screen.getByText('Ethereum')).toBeDefined();
      expect(screen.getByText('Detected')).toBeDefined();
    });
  });

  describe('action buttons', () => {
    it('calls onCopyReport when Copy Report clicked', () => {
      const { onCopyReport } = renderReport();
      fireEvent.click(screen.getByText('Copy Report'));
      expect(onCopyReport).toHaveBeenCalled();
    });

    it('calls onNewScan when New Scan clicked', () => {
      const { onNewScan } = renderReport();
      fireEvent.click(screen.getByText('New Scan'));
      expect(onNewScan).toHaveBeenCalled();
    });
  });

  describe('ENS metadata card', () => {
    it('renders ENS Name label for ens input type', () => {
      renderReport({ inputType: 'ens' });
      expect(screen.getByText('ENS Name')).toBeDefined();
    });

    it('renders ENS metadata with resolved address', () => {
      renderReport({
        inputType: 'ens',
        metadata: {
          ensName: 'vitalik.eth',
          resolvedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          resolutionStatus: 'resolved' as const,
        },
      });
      expect(screen.getByText('vitalik.eth')).toBeDefined();
      expect(screen.getByText('Resolved')).toBeDefined();
      expect(screen.getByText('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBeDefined();
    });

    it('renders ENS resolution failure', () => {
      renderReport({
        inputType: 'ens',
        metadata: {
          ensName: 'nonexistent.eth',
          resolvedAddress: '',
          resolutionStatus: 'failed' as const,
          resolutionError: 'ENS name does not resolve',
        },
      });
      expect(screen.getByText('Failed')).toBeDefined();
      expect(screen.getByText('ENS name does not resolve')).toBeDefined();
    });
  });

  describe('NFT metadata card', () => {
    it('renders NFT Contract label for nft input type', () => {
      renderReport({ inputType: 'nft' });
      expect(screen.getByText('NFT Contract')).toBeDefined();
    });

    it('renders NFT metadata with collection name and standard', () => {
      renderReport({
        inputType: 'nft',
        metadata: {
          name: 'BoredApeYachtClub',
          symbol: 'BAYC',
          tokenStandard: 'ERC-721',
          chain: 'Ethereum',
          isOpenSource: true,
          onTrustList: true,
          description: 'A collection of 10,000 unique Bored Ape NFTs',
          explorerUrl: 'https://etherscan.io/address/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
        },
      });
      expect(screen.getByText('BoredApeYachtClub (BAYC)')).toBeDefined();
      expect(screen.getByText('ERC-721')).toBeDefined();
      expect(screen.getByText('Ethereum')).toBeDefined();
      expect(screen.getByText('A collection of 10,000 unique Bored Ape NFTs')).toBeDefined();
    });

    it('renders NFT metadata for malicious contract', () => {
      renderReport({
        inputType: 'nft',
        riskLevel: 'DANGEROUS',
        riskScore: 80,
        metadata: {
          name: 'FakeNFT',
          maliciousContract: true,
          isOpenSource: false,
          onTrustList: false,
        },
      });
      expect(screen.getByText('DANGEROUS')).toBeDefined();
    });
  });

  describe('score explainer', () => {
    it('toggles score explainer on ? button click', () => {
      renderReport();
      // Explainer hidden initially
      expect(screen.queryByText(/what does this score mean/i)).toBeNull();

      // Click the ? button
      fireEvent.click(screen.getByLabelText('Why this score?'));
      expect(screen.getByText(/0-30/)).toBeDefined();
      expect(screen.getByText(/31-60/)).toBeDefined();
      expect(screen.getByText(/61-100/)).toBeDefined();
    });
  });
});
