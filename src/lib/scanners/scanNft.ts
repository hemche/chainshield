import { SafetyReport, Finding, NftMetadata, ConfidenceLevel } from '@/types';
import { calculateRisk } from '@/lib/riskScoring';
import { CHAIN_NAMES, CHAIN_ID_MAP } from '@/config/rules';
import { fetchNftSecurity, GoPlusNftSecurity } from '@/lib/apis/goplus';
import { fetchContractVerification } from '@/lib/apis/sourcify';
import { checkBlocklist } from './checkBlocklist';

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
    metadata.isOpenSource = nft.nft_open_source === '1';
    metadata.isProxy = nft.nft_proxy === '1';
    metadata.canSelfDestruct = nft.self_destruct === '1';
    metadata.privilegedMinting = nft.privileged_minting === '1';
    metadata.privilegedBurn = nft.privileged_burn === '1';
    metadata.transferWithoutApproval = nft.transfer_without_approval === '1';
    metadata.oversupplyMinting = nft.oversupply_minting === '1';
    metadata.restrictedApproval = nft.restricted_approval === '1';
    metadata.maliciousContract = nft.malicious_nft_contract === '1';
    metadata.onTrustList = nft.trust_list === '1';
    metadata.websiteUrl = nft.website_url || undefined;
    metadata.discordUrl = nft.discord_url || undefined;
    metadata.twitterUrl = nft.twitter_url || undefined;

    // --- Risk checks (ordered by severity) ---

    if (nft.malicious_nft_contract === '1') {
      findings.push({
        message: 'NFT contract flagged as MALICIOUS by GoPlus',
        severity: 'danger',
        scoreOverride: 60,
      });
      recommendations.push('Do NOT interact with this NFT contract — it has been flagged as malicious');
    }

    if (nft.transfer_without_approval === '1') {
      findings.push({
        message: 'Contract can transfer NFTs WITHOUT owner approval',
        severity: 'danger',
        scoreOverride: 60,
      });
      recommendations.push('This contract can steal your NFTs — do not approve or interact');
    }

    if (nft.self_destruct === '1') {
      findings.push({
        message: 'Contract contains selfdestruct — can be destroyed',
        severity: 'danger',
        scoreOverride: 50,
      });
    }

    if (nft.oversupply_minting === '1') {
      findings.push({
        message: 'Contract can mint beyond declared max supply',
        severity: 'danger',
        scoreOverride: 50,
      });
    }

    if (nft.privileged_minting === '1') {
      findings.push({
        message: 'Admin can mint NFTs at will (privileged minting)',
        severity: 'high',
      });
      recommendations.push('Admin-only minting can dilute the collection value');
    }

    if (nft.nft_open_source === '0') {
      findings.push({
        message: 'Contract source code is NOT verified/open source',
        severity: 'high',
      });
    }

    if (nft.privileged_burn === '1') {
      findings.push({
        message: 'Admin can burn NFTs (privileged burn)',
        severity: 'medium',
      });
    }

    if (nft.nft_proxy === '1') {
      findings.push({
        message: 'Contract is a proxy — logic can be changed',
        severity: 'medium',
        scoreOverride: 15,
      });
    }

    if (nft.restricted_approval === '1') {
      findings.push({
        message: 'Contract uses restricted approval patterns',
        severity: 'medium',
      });
    }

    // Positive signals
    if (nft.trust_list === '1') {
      findings.push({
        message: 'NFT collection is on the GoPlus trust list',
        severity: 'info',
        scoreOverride: 0,
      });
    }

    // All clear check
    const dangerFlags = [
      nft.malicious_nft_contract, nft.self_destruct,
      nft.transfer_without_approval, nft.oversupply_minting,
    ];
    const highFlags = [
      nft.privileged_minting,
      nft.nft_open_source === '0' ? '1' : '0',
    ];
    const mediumFlags = [nft.privileged_burn, nft.nft_proxy, nft.restricted_approval];
    const hasAnyFlag = [...dangerFlags, ...highFlags, ...mediumFlags].some(f => f === '1');
    if (!hasAnyFlag) {
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
