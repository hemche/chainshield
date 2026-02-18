import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 text-center">
      <div className="text-6xl font-bold text-gray-600 mb-4">404</div>
      <h1 className="text-2xl font-semibold text-gray-200 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist. Head back to the scanner to check a URL, token, or wallet address.
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
      >
        Back to Scanner
      </Link>
    </div>
  );
}
