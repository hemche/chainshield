import { Finding, RiskLevel, ScoreBreakdownItem } from '@/types';

const SEVERITY_SCORES: Record<Finding['severity'], number> = {
  info: 0,
  danger: 60,
  high: 25,
  medium: 15,
  low: 8,
};

export interface RiskResult {
  score: number;
  level: RiskLevel;
  breakdown: ScoreBreakdownItem[];
}

export function calculateRisk(findings: Finding[]): RiskResult {
  let raw = 0;
  const breakdown: ScoreBreakdownItem[] = [];

  for (const finding of findings) {
    const impact = finding.scoreOverride ?? SEVERITY_SCORES[finding.severity];
    raw += impact;
    breakdown.push({
      label: finding.message,
      scoreImpact: impact,
    });
  }

  const score = Math.min(100, Math.max(0, raw));
  const level = getRiskLevel(score, findings);

  return { score, level, breakdown };
}

/**
 * Determine the risk level from a numeric score, with severity-based overrides.
 *
 * If any finding has severity 'danger':
 *   - riskLevel cannot be SAFE
 *   - if score >= 60, mark as DANGEROUS
 *   - otherwise, at least SUSPICIOUS
 */
export function getRiskLevel(score: number, findings?: Finding[]): RiskLevel {
  const hasDanger = findings?.some(f => f.severity === 'danger') ?? false;

  if (hasDanger) {
    return score >= 60 ? 'DANGEROUS' : 'SUSPICIOUS';
  }

  if (score <= 30) return 'SAFE';
  if (score <= 60) return 'SUSPICIOUS';
  return 'DANGEROUS';
}
