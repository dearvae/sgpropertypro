/** Skeleton loading placeholder - matches zen theme */
export function Skeleton({ className = '', ...rest }: React.ComponentProps<'div'>) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[#53868e]/15 ${className}`}
      role="status"
      aria-label="Loading"
      {...rest}
    />
  )
}

export function PageSkeleton() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}
    >
      {/* Header skeleton */}
      <div className="border-b border-[#53868e]/20 rounded-b-2xl mx-4 mt-2 sm:mx-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Content area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/2" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-20 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  )
}

/** Skeleton for full-page loading (auth check, etc.) */
export function FullPageSkeleton({ message }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl">
          <Skeleton className="w-full h-full rounded-xl" />
        </div>
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-48 mx-auto" />
        </div>
      </div>
      {message && <p className="text-[#2b5843]/70 text-sm">{message}</p>}
    </div>
  )
}

/** Skeleton for client view / agent public page loading */
export function ViewPageSkeleton({ message }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #f6f3f1 0%, #e8ebe8 100%)' }}
    >
      <header className="border-b border-[#53868e]/20 px-4 py-4">
        <Skeleton className="h-6 w-40" />
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 rounded-xl border border-[#53868e]/20">
              <Skeleton className="h-20 w-24 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
      {message && (
        <p className="text-center text-[#2b5843]/70 text-sm pb-8">{message}</p>
      )}
    </div>
  )
}
