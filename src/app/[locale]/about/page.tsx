import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tc = await getTranslations('common');

  const scanners = [
    { title: t('urlScanner'), items: t('urlItems').split('|') },
    { title: t('tokenScanner'), items: t('tokenItems').split('|') },
    { title: t('txScanner'), items: t('txItems').split('|') },
    { title: t('walletScanner'), items: t('walletItems').split('|') },
  ];

  const privacyItems = [
    t('privacyItem1'),
    t('privacyItem2'),
    t('privacyItem3'),
    t('privacyItem4'),
    t('privacyItem5'),
  ];

  const steps = [t('step1'), t('step2'), t('step3'), t('step4')];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-10 inline-flex items-center gap-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {tc('backToScanner')}
      </Link>

      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-3">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-gray-500 text-sm">{t('subtitle')}</p>
      </div>

      <div className="space-y-10 text-gray-300 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('whatIsThis')}</h2>
          <p className="text-gray-400">{t('whatIsThisText')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('howItWorks')}</h2>
          <ol className="space-y-3 text-gray-400">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-blue-400/60 font-mono text-sm font-bold mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">{t('whatWeScan')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {scanners.map((scanner) => (
              <div key={scanner.title} className="glass-card rounded-xl p-4">
                <h3 className="text-white font-medium text-sm mb-2.5">{scanner.title}</h3>
                <ul className="text-xs text-gray-500 space-y-1.5">
                  {scanner.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('privacyPrinciples')}</h2>
          <ul className="space-y-2 text-gray-400">
            {privacyItems.map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <svg className="w-3.5 h-3.5 text-emerald-500/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-gray-500 text-sm">
            {t('readPrivacy', {
              link: '',
            }).split('').length > 0 && (
              <>
                {t('readPrivacy', { link: '' }).split('{link}')[0]}
                <Link href="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">{t('privacyLink')}</Link>
                {t('readPrivacy', { link: '' }).split('{link}')[1] || ''}
              </>
            )}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('limitations')}</h2>
          <p className="text-gray-400">{t('limitationsText')}</p>
        </section>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs">{t('disclaimerFooter')}</p>
        </div>
      </div>
    </div>
  );
}
