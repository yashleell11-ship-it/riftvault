export default function Loading() {
  return (
    <div className="flex flex-col gap-6 mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="h-8 w-48 bg-bg-hover rounded animate-pulse" />
      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-bg-hover animate-pulse" />
        ))}
      </div>
    </div>
  );
}
