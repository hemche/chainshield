import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');
  const tc = await getTranslations('common');

  const notCollectItems = [
    { main: t('notCollect1'), detail: t('notCollect1Detail') },
    { main: t('notCollect2'), detail: '' },
    { main: t('notCollect3'), detail: t('notCollect3Detail') },
    { main: t('notCollect4'), detail: t('notCollect4Detail') },
    { main: t('notCollect5'), detail: t('notCollect5Detail') },
    { main: t('notCollect6'), detail: '' },
    { main: t('notCollect7'), detail: t('notCollect7Detail') },
    { main: t('notCollect8'), detail: '' },
    { main: t('notCollect9'), detail: t('notCollect9Detail') },
  ];

  const scanSteps = [
    t('scanStep1'),
    t('scanStep2'),
    t('scanStep3'),
    t('scanStep4'),
    t('scanStep5'),
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-10 inline-flex items-center gap-1.5 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {tc('backToScanner')}
      </Link>

      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">{t('title')}</h1>
        <p className="text-gray-500 text-sm">{t('lastUpdated')}</p>
      </div>

      <div className="space-y-10 text-gray-300 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('commitment')}</h2>
          <p className="text-gray-400">{t('commitmentText')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('notCollect')}</h2>
          <ul className="space-y-2.5 text-gray-400">
            {notCollectItems.map(({ main, detail }) => (
              <li key={main} className="flex items-start gap-2.5">
                <svg className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{t.rich('weDoNot', { action: `${main}${detail ? ` ${detail}` : ''}`, strong: (chunks) => <strong className="text-white">{chunks}</strong> })}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('howScansWork')}</h2>
          <p className="text-gray-400 mb-4">{t('howScansIntro')}</p>
          <ol className="space-y-2.5 text-gray-400">
            {scanSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-blue-400/60 font-mono text-sm font-bold mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('thirdParty')}</h2>
          <p className="text-gray-400 mb-4">{t('thirdPartyIntro')}</p>
          <ul className="space-y-2.5 text-gray-400">
            {[
              { name: t('dexScreener'), desc: t('dexScreenerDesc') },
              { name: t('goPlus'), desc: t('goPlusDesc') },
              { name: t('sourcify'), desc: t('sourcifyDesc') },
              { name: t('blockExplorers'), desc: t('blockExplorersDesc') },
            ].map(({ name, desc }) => (
              <li key={name} className="flex items-start gap-2.5">
                <span className="text-gray-600 mt-0.5">-</span>
                <span><strong className="text-white">{name}</strong> — {desc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-gray-500 text-sm">{t('thirdPartyNote')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('shareableReports')}</h2>
          <p className="text-gray-400">{t('shareableReportsText')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('sessionStorage')}</h2>
          <p className="text-gray-400">{t('sessionStorageIntro')}</p>
          <ul className="mt-3 space-y-2 text-gray-400">
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">{t('recentScans')}</strong> — {t('recentScansDesc')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-gray-600 mt-0.5">-</span>
              <span><strong className="text-white">{t('bannerDismissal')}</strong> — {t('bannerDismissalDesc')}</span>
            </li>
          </ul>
          <p className="mt-3 text-gray-400">{t('sessionStorageNote')}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">{t('openSource')}</h2>
          <p className="text-gray-400">{t('openSourceText')}</p>
        </section>

        <div className="pt-8 border-t border-gray-800">
          <p className="text-gray-600 text-xs">{t('footerNote')}</p>
        </div>
      </div>
    </div>
  );
}
