'use client';

import { useSyncExternalStore } from 'react';

const BANNER_KEY = 'chainshield_banner_dismissed';

let bannerVersion = 0;
const bannerListeners = new Set<() => void>();
function subscribeBanner(cb: () => void) {
  bannerListeners.add(cb);
  return () => { bannerListeners.delete(cb); };
}
function getBannerSnapshot() { return bannerVersion; }
function getBannerServerSnapshot() { return 0; }

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

export default function PrivacyBanner() {
  useSyncExternalStore(subscribeBanner, getBannerSnapshot, getBannerServerSnapshot);
  const dismissed = isDismissed();

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(BANNER_KEY, '1');
    } catch {
      // sessionStorage unavailable
    }
    bannerVersion++;
    bannerListeners.forEach((l) => l());
  };

  if (dismissed) return null;

  return (
    <div className="bg-emerald-950/60 border-b border-emerald-800/30 text-emerald-300 text-sm px-4 py-2 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-2.5 mx-auto">
        <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <span className="text-emerald-300/90 text-xs tracking-wide">
          Privacy First — Zero tracking, zero cookies, zero data stored
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="text-emerald-500/60 hover:text-emerald-300 ml-4 flex-shrink-0 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
