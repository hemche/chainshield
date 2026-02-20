import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('notFound');
  const tc = useTranslations('common');

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 text-center">
      <div className="text-6xl font-bold text-gray-600 mb-4">404</div>
      <h1 className="text-2xl font-semibold text-gray-200 mb-2">{t('title')}</h1>
      <p className="text-gray-500 mb-8 max-w-md">{t('description')}</p>
      <Link
        href="/"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
      >
        {tc('backToScanner')}
      </Link>
    </div>
  );
}
