export default function ReportLoading() {
  return (
    <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-12 sm:py-20">
      <div className="w-full max-w-3xl mx-auto space-y-4" role="status" aria-label="Loading report">
        {/* Score ring skeleton */}
        <div className="glass-card rounded-2xl p-8 flex items-center gap-8">
          <div className="skeleton w-[140px] h-[140px] rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="skeleton h-6 w-32" />
            <div className="skeleton h-4 w-48" />
            <div className="skeleton h-4 w-64" />
          </div>
        </div>
        {/* Summary skeleton */}
        <div className="skeleton h-24 w-full rounded-2xl" />
        {/* Findings skeleton */}
        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-full rounded-xl" />
          <div className="skeleton h-10 w-5/6 rounded-xl" />
        </div>
      </div>
    </main>
  );
}
