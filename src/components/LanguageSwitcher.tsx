'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { locales } from '@/i18n/config';

const localeLabels: Record<string, string> = {
  en: 'EN',
  es: 'ES',
  zh: '中文',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
            l === locale
              ? 'text-white bg-gray-700'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
          }`}
          aria-label={l}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
