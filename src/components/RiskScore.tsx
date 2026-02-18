import { RiskLevel } from '@/types';

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
}

const colorMap: Record<RiskLevel, string> = {
  SAFE: 'text-emerald-400',
  SUSPICIOUS: 'text-yellow-400',
  DANGEROUS: 'text-red-400',
};

const ringColorMap: Record<RiskLevel, string> = {
  SAFE: 'stroke-emerald-400',
  SUSPICIOUS: 'stroke-yellow-400',
  DANGEROUS: 'stroke-red-400',
};

const glowClass: Record<RiskLevel, string> = {
  SAFE: 'ring-glow-safe',
  SUSPICIOUS: 'ring-glow-suspicious',
  DANGEROUS: 'ring-glow-dangerous',
};

export default function RiskScore({ score, level }: RiskScoreProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${glowClass[level]}`} role="img" aria-label={`Risk score ${score} out of 100, level ${level}`}>
      <svg
        className="w-[140px] h-[140px] -rotate-90"
        viewBox="0 0 120 120"
        aria-hidden="true"
        style={{
          '--ring-circumference': `${circumference}`,
          '--ring-offset': `${offset}`,
        } as React.CSSProperties}
      >
        {/* Background track */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-gray-800"
        />
        {/* Score arc */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${ringColorMap[level]} animate-ring`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold tracking-tight ${colorMap[level]}`}>{score}</span>
        <span className="text-[11px] text-gray-500 font-medium">/ 100</span>
      </div>
    </div>
  );
}
