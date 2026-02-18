import { RiskLevel } from '@/types';

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
}

const styles: Record<RiskLevel, string> = {
  SAFE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-emerald-500/5',
  SUSPICIOUS: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25 shadow-yellow-500/5',
  DANGEROUS: 'bg-red-500/15 text-red-400 border-red-500/25 shadow-red-500/5',
};

const sizeStyles = {
  sm: 'text-[10px] px-2 py-0.5 tracking-wider',
  md: 'text-xs px-3 py-1 tracking-wider',
  lg: 'text-sm px-4 py-1.5 tracking-wide',
};

export default function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  return (
    <span className={`inline-flex items-center font-bold rounded-full border shadow-sm ${styles[level]} ${sizeStyles[size]}`}>
      {level}
    </span>
  );
}
