import Link from "next/link";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";

function categoryFor(post: WebRamenMentionWithShop) {
  const text = `${post.title} ${post.summary}`;
  if (/テレビ|ニュース|掲載|放送|メディア/.test(text)) return { label: "メディア掲載", color: "text-[#5f8f45] bg-[#edf5e9]" };
  if (/ランキング|百名店|受賞|ベスト/.test(text)) return { label: "ランキング", color: "text-[#9a6514] bg-[#fbf2df]" };
  if (/限定|新メニュー|コラボ/.test(text)) return { label: "限定メニュー", color: "text-[#4a2a1d] bg-[#f6eedf]" };
  if (/開店|オープン|新店/.test(text)) return { label: "新店情報", color: "text-[#9a6514] bg-[#fbf2df]" };
  if (/営業|休業|再開/.test(text)) return { label: "営業情報", color: "text-[#5f8f45] bg-[#edf5e9]" };
  return { label: "トレンド", color: "text-accent bg-accent-light" };
}

export function NewsList({ posts, category }: { posts: WebRamenMentionWithShop[]; category: string }) {
  const filtered = posts.filter((post) => category === "all" || categoryFor(post).label === category).slice(0, 20);
  return <section aria-labelledby="news-list-title" className="mt-10"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-accent">LATEST</p><h2 id="news-list-title" className="mt-1 text-xl font-black text-ink">新着ラーメン情報</h2></div><span className="text-xs text-text-muted">{filtered.length}件</span></div><div className="mt-4 space-y-3">{filtered.length ? filtered.map((post) => { const categoryInfo = categoryFor(post); return <article key={post.mention_id} className="group flex gap-3 rounded-2xl border border-border bg-white p-3 shadow-warm transition duration-200 hover:-translate-y-0.5 active:scale-[.99] sm:gap-4 sm:p-4"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f6eedf] to-[#fff8ef] text-4xl" aria-label="ラーメン画像プレースホルダー">🍜</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${categoryInfo.color}`}>{categoryInfo.label}</span><span className="shrink-0 text-xs text-text-muted">{post.published_at ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(post.published_at)) : "日付不明"}</span></div><h3 className="mt-2 line-clamp-2 text-sm font-black leading-5 text-ink sm:text-base">{post.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{post.summary}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted"><span>{post.matched_area ?? "東京"}</span>{post.ramen_shops && <Link href={`/shops/${post.ramen_shops.id}`} className="font-bold text-accent hover:underline">{post.ramen_shops.name}</Link>}</div></div><a href={post.source_url} target="_blank" rel="noreferrer" aria-label={`${post.title}を読む`} className="hidden self-center text-2xl text-text-muted transition group-hover:text-accent sm:block">›</a></article>; }) : <div className="rounded-2xl border border-border bg-white px-6 py-12 text-center text-sm text-text-secondary">このカテゴリの情報はまだありません。</div>}</div></section>;
}
