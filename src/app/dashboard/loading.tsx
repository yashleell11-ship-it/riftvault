export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 bg-bg-hover rounded animate-pulse" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-bg-hover animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-bg-hover animate-pulse" />
    </div>
  );
}
