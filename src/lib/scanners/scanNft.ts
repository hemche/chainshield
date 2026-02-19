import { SafetyReport, Finding, NftMetadata, ConfidenceLevel } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { CHAIN_NAMES, CHAIN_ID_MAP } from '@/config/rules';
import { fetchNftSecurity, GoPlusNftSecurity, GoPlusNftFlag } from '@/lib/apis/goplus';
import { fetchContractVerification } from '@/lib/apis/sourcify';
import { checkBlocklist } from './checkBlocklist';

/**
 * Extract a boolean-like value from GoPlus NFT flag fields.
 * Fields can be: number (0/1), object { value: 0|1|-1 }, or null.
 * Returns true if the flag indicates a positive/risky value (1).
 * Returns false for 0, -1 (renounced/blackhole), or null.
 */
function isFlagged(flag: GoPlusNftFlag | undefined): boolean {
  if (flag === null || flag === undefined) return false;
  if (typeof flag === 'number') return flag === 1;
  if (typeof flag === 'object' && 'value' in flag) return flag.value === 1;
  return false;
}

/** Check if a flag is explicitly safe (0 or object with value 0) */
function isNotFlagged(flag: GoPlusNftFlag | undefined): boolean {
  if (flag === null || flag === undefined) return false;
  if (typeof flag === 'number') return flag === 0;
  if (typeof flag === 'object' && 'value' in flag) return flag.value === 0 || flag.value === -1;
  return false;
}

export async function scanNft(address: string): Promise<SafetyReport> {
  const findings: Finding[] = [];
  const recommendations: string[] = [];
  const metadata: NftMetadata = {};
  let hasGoPlusData = false;

  // Blocklist check
  const blocklistMatch = checkBlocklist(address);
  if (blocklistMatch) {
    findings.push({
      message: `This address is flagged as: ${blocklistMatch.label} (source: ${blocklistMatch.source})`,
      severity: 'danger',
    });
  }

  // Address format validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    findings.push({ message: 'Invalid contract address format', severity: 'high' });
  }

  // GoPlus NFT Security + Sourcify (parallel)
  const [nftResult, verifyResult] = await Promise.allSettled([
    fetchNftSecurity(address),
    fetchContractVerification(address, 1),
  ]);

  // Process GoPlus NFT security
  if (nftResult.status === 'fulfilled' && nftResult.value.data) {
    const nft: GoPlusNftSecurity = nftResult.value.data;
    const matchedChainId = nftResult.value.chainId;
    hasGoPlusData = true;
    metadata.goPlusChecked = true;

    // Populate metadata
    metadata.name = nft.nft_name || undefined;
    metadata.symbol = nft.nft_symbol || undefined;
    metadata.description = nft.nft_description || undefined;
    if (matchedChainId) {
      const chainEntry = Object.entries(CHAIN_ID_MAP).find(([, v]) => v === matchedChainId);
      if (chainEntry) {
        metadata.chain = CHAIN_NAMES[chainEntry[0]] || chainEntry[0];
        metadata.chainId = chainEntry[0];
      }
    }
    if (nft.nft_erc) {
      metadata.tokenStandard = nft.nft_erc.toUpperCase().replace('ERC', 'ERC-');
    }
    metadata.isOpenSource = isFlagged(nft.nft_open_source);
    metadata.isProxy = isFlagged(nft.nft_proxy);
    metadata.canSelfDestruct = isFlagged(nft.self_destruct);
    metadata.privilegedMinting = isFlagged(nft.privileged_minting);
    metadata.privilegedBurn = isFlagged(nft.privileged_burn);
    metadata.transferWithoutApproval = isFlagged(nft.transfer_without_approval);
    metadata.oversupplyMinting = isFlagged(nft.oversupply_minting);
    metadata.restrictedApproval = isFlagged(nft.restricted_approval);
    metadata.maliciousContract = isFlagged(nft.malicious_nft_contract);
    metadata.onTrustList = isFlagged(nft.trust_list);
    metadata.websiteUrl = nft.website_url || undefined;
    metadata.discordUrl = nft.discord_url || undefined;
    metadata.twitterUrl = nft.twitter_url || undefined;

    // --- Risk checks (ordered by severity) ---

    if (isFlagged(nft.malicious_nft_contract)) {
      findings.push({
        message: 'NFT contract flagged as MALICIOUS by GoPlus',
        severity: 'danger',
        scoreOverride: 60,
      });
      recommendations.push('Do NOT interact with this NFT contract — it has been flagged as malicious');
    }

    if (isFlagged(nft.transfer_without_approval)) {
      findings.push({
        message: 'Contract can transfer NFTs WITHOUT owner approval',
        severity: 'danger',
        scoreOverride: 60,
      });
      recommendations.push('This contract can steal your NFTs — do not approve or interact');
    }

    if (isFlagged(nft.self_destruct)) {
      findings.push({
        message: 'Contract contains selfdestruct — can be destroyed',
        severity: 'danger',
        scoreOverride: 50,
      });
    }

    if (isFlagged(nft.oversupply_minting)) {
      findings.push({
        message: 'Contract can mint beyond declared max supply',
        severity: 'danger',
        scoreOverride: 50,
      });
    }

    if (isFlagged(nft.privileged_minting)) {
      findings.push({
        message: 'Admin can mint NFTs at will (privileged minting)',
        severity: 'high',
      });
      recommendations.push('Admin-only minting can dilute the collection value');
    }

    if (isNotFlagged(nft.nft_open_source)) {
      findings.push({
        message: 'Contract source code is NOT verified/open source',
        severity: 'high',
      });
    }

    if (isFlagged(nft.privileged_burn)) {
      findings.push({
        message: 'Admin can burn NFTs (privileged burn)',
        severity: 'medium',
      });
    }

    if (isFlagged(nft.nft_proxy)) {
      findings.push({
        message: 'Contract is a proxy — logic can be changed',
        severity: 'medium',
        scoreOverride: 15,
      });
    }

    if (isFlagged(nft.restricted_approval)) {
      findings.push({
        message: 'Contract uses restricted approval patterns',
        severity: 'medium',
      });
    }

    // Positive signals
    if (isFlagged(nft.trust_list)) {
      findings.push({
        message: 'NFT collection is on the GoPlus trust list',
        severity: 'info',
        scoreOverride: 0,
      });
    }

    // Copycat detection
    if (nft.same_nfts && nft.same_nfts.length > 0) {
      findings.push({
        message: `${nft.same_nfts.length} copycat collection${nft.same_nfts.length > 1 ? 's' : ''} detected with the same name — verify you have the original`,
        severity: 'medium',
      });
      recommendations.push('Verify the contract address matches the official collection — copycats exist');
    }

    // All clear check
    const allFlags = [
      nft.malicious_nft_contract, nft.self_destruct,
      nft.transfer_without_approval, nft.oversupply_minting,
      nft.privileged_minting, nft.privileged_burn,
      nft.nft_proxy, nft.restricted_approval,
    ];
    const hasAnyRiskFlag = allFlags.some(f => isFlagged(f));
    const isClosedSource = isNotFlagged(nft.nft_open_source);
    if (!hasAnyRiskFlag && !isClosedSource) {
      findings.push({
        message: 'GoPlus NFT security audit passed — no red flags detected',
        severity: 'info',
        scoreOverride: 0,
      });
    }
  }

  // Process Sourcify verification
  if (verifyResult.status === 'fulfilled' && verifyResult.value.isVerified !== null) {
    metadata.sourcifyVerified = verifyResult.value.isVerified;
    if (verifyResult.value.isVerified) {
      findings.push({
        message: 'Contract source code verified on Sourcify',
        severity: 'info',
        scoreOverride: 0,
      });
    } else {
      findings.push({
        message: 'Contract NOT verified on Sourcify',
        severity: 'low',
      });
    }
  }

  // Recommendations
  recommendations.push('Check the NFT collection on OpenSea or other marketplaces for community verification');
  recommendations.push('Verify the contract on the block explorer before interacting');
  recommendations.push('Be cautious of free NFT airdrops — they are often scam vectors');
  recommendations.push('Never approve a contract without understanding what permissions you are granting');

  const { score, level, breakdown } = calculateRisk(findings);

  if (level !== 'SAFE') {
    recommendations.push('Cross-check with government scam databases (DFPI, CFTC, SEC, FCA, ASIC, AMF) for additional verification');
  }

  // Baseline risk floor
  let riskScore = score;
  if (level === 'SAFE') {
    riskScore = Math.max(5, riskScore);
  }
  if (riskScore > score) {
    breakdown.push({
      label: 'Baseline risk floor (no NFT contract is truly zero-risk)',
      scoreImpact: riskScore - score,
    });
  }

  // Confidence
  let confidence: ConfidenceLevel;
  let confidenceReason: string;
  if (hasGoPlusData) {
    confidence = 'HIGH';
    confidenceReason = `GoPlus NFT security audit performed with ${findings.length} signals analyzed.`;
  } else if (findings.length > 0) {
    confidence = 'MEDIUM';
    confidenceReason = 'Limited data — GoPlus NFT endpoint returned no data for this contract.';
  } else {
    confidence = 'LOW';
    confidenceReason = 'Unable to retrieve NFT security data.';
  }
  if (metadata.sourcifyVerified !== undefined) {
    confidenceReason += ' Contract verification checked on Sourcify.';
  }

  // Summary
  const nftLabel = metadata.name ? `${metadata.name}${metadata.symbol ? ` (${metadata.symbol})` : ''}` : 'This NFT contract';

  let summary: string;
  if (metadata.maliciousContract) {
    summary = `${nftLabel} is flagged as MALICIOUS — do not interact.`;
  } else if (metadata.transferWithoutApproval) {
    summary = `${nftLabel} can transfer NFTs without owner approval — extremely risky.`;
  } else if (level === 'DANGEROUS') {
    summary = `High-risk signals detected on ${nftLabel} — avoid interacting.`;
  } else if (level === 'SUSPICIOUS') {
    summary = `Some suspicious patterns detected on ${nftLabel} — review carefully.`;
  } else if (metadata.onTrustList) {
    summary = `${nftLabel} is on the GoPlus trust list and passed all security checks.`;
  } else {
    summary = `${nftLabel} — no major risk signals detected.`;
  }

  // Next step
  let nextStep: string;
  if (level === 'DANGEROUS') {
    nextStep = 'Do not interact with this NFT contract.';
  } else if (level === 'SUSPICIOUS') {
    nextStep = 'Research this collection thoroughly before minting or purchasing.';
  } else {
    nextStep = 'Always verify the collection on a marketplace and check the contract on a block explorer.';
  }

  // Explorer URL
  metadata.explorerUrl = `https://etherscan.io/address/${address}`;

  return {
    inputType: 'nft',
    inputValue: address,
    riskScore,
    riskLevel: level,
    confidence,
    confidenceReason,
    summary,
    scoreBreakdown: breakdown,
    nextStep,
    findings,
    recommendations,
    metadata,
    timestamp: new Date().toISOString(),
  };
}
