import { SafetyReport } from '@/types';
import { detectInputType } from './detectInput';
import { scanUrl } from './scanUrl';
import { scanToken } from './scanToken';
import { scanTxHash } from './scanTxHash';
import { scanWallet } from './scanWallet';
import { scanBtcWallet } from './scanBtcWallet';
import { scanInvalidAddress } from './scanInvalidAddress';
import { isValidEvmAddress, isValidBitcoinAddress } from '@/lib/validation/addressValidation';

export { detectInputType, scanUrl, scanToken, scanTxHash, scanWallet, scanBtcWallet, scanInvalidAddress };

export async function scanInput(input: string): Promise<SafetyReport> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      inputType: 'unknown',
      inputValue: input,
      riskScore: 0,
      riskLevel: 'SAFE',
      confidence: 'LOW',
      confidenceReason: 'No input provided.',
      summary: 'No input was provided to scan.',
      scoreBreakdown: [],
      findings: [{ message: 'No input provided', severity: 'low' }],
      recommendations: ['Please provide a URL, contract address, transaction hash, or wallet address'],
      timestamp: new Date().toISOString(),
    };
  }

  const inputType = detectInputType(trimmed);

  switch (inputType) {
    case 'url':
      return scanUrl(trimmed);
    case 'token': {
      // Validate EVM address checksum before scanning as token
      if (!isValidEvmAddress(trimmed)) {
        return scanInvalidAddress(trimmed);
      }
      // Try token scan first; if DexScreener finds no pairs, this is likely
      // a wallet address (both are 0x + 40 hex chars — indistinguishable by format)
      const tokenReport = await scanToken(trimmed);
      const hasNoPairs = tokenReport.findings.some(
        f => f.severity === 'danger' && f.message.includes('no liquidity pairs')
      );
      if (hasNoPairs) {
        return scanWallet(trimmed);
      }
      return tokenReport;
    }
    case 'txHash':
      return scanTxHash(trimmed);
    case 'wallet': {
      // Validate EVM address format
      if (!isValidEvmAddress(trimmed)) {
        return scanInvalidAddress(trimmed);
      }
      return scanWallet(trimmed);
    }
    case 'btcWallet': {
      // Validate BTC address checksum
      if (!isValidBitcoinAddress(trimmed)) {
        return scanInvalidAddress(trimmed);
      }
      return scanBtcWallet(trimmed);
    }
    default: {
      // Check if input looks like a BTC address attempt (right prefix, wrong chars/checksum)
      const looksLikeBtc = (/^[13]/.test(trimmed) || /^bc1/i.test(trimmed))
        && trimmed.length >= 20 && trimmed.length <= 62;
      if (looksLikeBtc) {
        return scanInvalidAddress(trimmed);
      }

      // Check if this looks like a wallet address from an unsupported chain
      const looksLikeWallet = /^[a-zA-Z0-9]{20,62}$/.test(trimmed);
      if (looksLikeWallet) {
        return {
          inputType: 'unknown',
          inputValue: input,
          riskScore: 5,
          riskLevel: 'SAFE',
          confidence: 'LOW',
          confidenceReason: 'Address format not recognized — chain may not be supported yet.',
          summary: 'Valid address format detected, but chain is not yet supported.',
          scoreBreakdown: [
            { label: 'Baseline risk floor', scoreImpact: 5 },
          ],
          nextStep: 'Try looking up this address on a chain-specific block explorer.',
          findings: [
            { message: 'Address format detected but blockchain not supported', severity: 'info', scoreOverride: 0 },
          ],
          recommendations: [
            'Look up this address on a chain-specific block explorer',
            'ChainShield currently supports EVM (0x...) and Bitcoin addresses',
            'Never share your private key or seed phrase with anyone',
          ],
          timestamp: new Date().toISOString(),
        };
      }
      return {
        inputType: 'unknown',
        inputValue: input,
        riskScore: 50,
        riskLevel: 'SUSPICIOUS',
        confidence: 'LOW',
        confidenceReason: 'Input type could not be determined.',
        summary: 'Could not determine input type — unable to perform a targeted scan.',
        scoreBreakdown: [
          { label: 'Could not determine input type', scoreImpact: 15 },
          { label: 'Input does not match any known format', scoreImpact: 15 },
        ],
        nextStep: 'Verify your input is a valid URL, contract address, transaction hash, or wallet address.',
        findings: [
          { message: 'Could not determine input type', severity: 'medium' },
          { message: 'Input does not match any known format (URL, contract, tx hash, wallet)', severity: 'medium' },
        ],
        recommendations: [
          'Ensure your input is a valid URL, EVM contract address (0x... 42 chars), transaction hash (0x... 66 chars), or wallet address',
          'Double-check for typos or extra spaces',
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }
}
