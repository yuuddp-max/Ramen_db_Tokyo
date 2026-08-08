import Link from "next/link";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";
import { isCsvSourceUrl } from "@/lib/news-links";

function categoryFor(post: WebRamenMentionWithShop) {
  const text = `${post.title} ${post.summary}`;
  if (/テレビ|ニュース|掲載|放送|メディア/.test(text)) return { label: "メディア掲載", className: "bg-[#5f8f45]" };
  if (/ランキング|百名店|受賞|ベスト/.test(text)) return { label: "ランキング", className: "bg-[#b7791f]" };
  if (/限定|新メニュー|コラボ/.test(text)) return { label: "限定メニュー", className: "bg-[#4a2a1d]" };
  if (/開店|オープン|新店/.test(text)) return { label: "新店情報", className: "bg-[#c88924]" };
  if (/営業|休業|再開/.test(text)) return { label: "営業情報", className: "bg-[#5f8f45]" };
  return { label: "トレンド", className: "bg-accent" };
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(value)) : "日付不明"; }

export function FeaturedNewsCarousel({ posts }: { posts: WebRamenMentionWithShop[] }) {
  const featured = posts.slice(0, 6);
  if (!featured.length) return null;
  return <section aria-labelledby="featured-news-title" className="mt-8">
    <div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-accent">FEATURED</p><h2 id="featured-news-title" className="mt-1 text-xl font-black text-ink">注目の東京ラーメン情報</h2></div><span className="text-xs text-text-muted">横にスワイプ</span></div>
    <div className="scrollbar-none -mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {featured.map((post, index) => { const category = categoryFor(post); return <article key={post.mention_id} className={`relative h-[330px] w-[84vw] max-w-[430px] shrink-0 snap-start overflow-hidden rounded-3xl bg-gradient-to-br ${index % 2 ? "from-[#7e2b20] via-[#c24132] to-[#f1b54b]" : "from-[#3b2118] via-[#8f382b] to-[#d69c3a]"} text-white shadow-warm`}>
        <div className="absolute inset-0 flex items-center justify-center text-[110px] opacity-20" aria-hidden="true">🍜</div><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
        <div className="relative flex h-full flex-col justify-between p-5"><div className="flex items-center justify-between"><span className={`rounded-full px-3 py-1 text-xs font-bold ${category.className}`}>{category.label}</span><span className="text-xs text-white/80">{post.matched_area ?? "東京"}</span></div><div><p className="line-clamp-2 text-xl font-black leading-8">{post.ramen_shops?.name ?? post.title}</p><h3 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-white/95">{post.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-white/75">{post.summary}</p><div className="mt-4 flex items-center justify-between"><span className="text-xs text-white/70">{formatDate(post.published_at)}</span>{!isCsvSourceUrl(post.source_url) && <a href={post.source_url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#4a2a1d] transition hover:bg-[#fff7ed]">詳しく見る ↗</a>}</div></div></div>
      </article>; })}
    </div>
    <div className="mt-2 flex justify-center gap-1.5" aria-hidden="true">{featured.map((post, index) => <span key={post.mention_id} className={`h-1.5 rounded-full ${index === 0 ? "w-6 bg-accent" : "w-1.5 bg-border"}`} />)}</div>
  </section>;
}
