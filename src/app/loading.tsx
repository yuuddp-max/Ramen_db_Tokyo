export default function Loading() {
  return <main className="min-h-screen bg-background-subtle" aria-label="ページを読み込み中">
    <header className="h-[76px] border-b border-border bg-white" />
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="h-14 animate-pulse rounded-2xl border border-border bg-white" />
      <div className="mt-6 h-8 w-48 animate-pulse rounded bg-[#f6eedf]" />
      <div className="mt-3 h-5 w-72 animate-pulse rounded bg-[#f6eedf]" />
      <div className="mt-8 h-14 animate-pulse rounded-xl border border-border bg-white" />
      <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-border bg-white" />)}</div>
    </div>
  </main>;
}
