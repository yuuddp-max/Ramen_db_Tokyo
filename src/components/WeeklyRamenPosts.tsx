"use client";

import Link from "next/link";
import { useState } from "react";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";

function formatPostedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export function WeeklyRamenPosts({ posts }: { posts: WebRamenMentionWithShop[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = posts.slice(0, expanded ? 20 : 10);
  return <section className="border-t border-white/10 bg-charcoal"><div className="mx-auto max-w-7xl px-5 py-12 sm:px-8"><div><p className="text-xs font-bold tracking-[.24em] text-gold">WEEKLY WEB RESEARCH</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">今週の東京ラーメン話題投稿</h2><p className="mt-2 text-sm text-stone-400">直近7日間にWeb調査で見つけた記事・店舗公式情報を、関連性と新しさをもとに表示しています。</p></div>{visible.length ? <div className="mt-6 grid gap-3 lg:grid-cols-2">{visible.map((post) => <article key={post.mention_id} className="panel rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-bold text-stone-100">{post.source_name}</p><p className="mt-1 text-xs text-stone-500">{post.published_at ? formatPostedAt(post.published_at) : "公開日不明"}</p></div><a href={post.source_url} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-bold text-gold underline underline-offset-4">記事を見る ↗</a></div><h3 className="mt-4 text-base font-bold text-stone-100">{post.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-300">{post.summary.length > 220 ? `${post.summary.slice(0, 220)}…` : post.summary}</p><div className="mt-4 flex flex-wrap gap-2 text-xs">{post.ramen_shops ? <Link href={`/shops/${post.ramen_shops.id}`} className="rounded bg-gold/10 px-2 py-1 font-bold text-gold hover:bg-gold hover:text-ink">関連店舗：{post.ramen_shops.name}</Link> : post.matched_area ? <span className="rounded bg-gold/10 px-2 py-1 font-bold text-gold">地域：{post.matched_area}</span> : null}<span className="rounded bg-white/5 px-2 py-1 text-stone-400">Web関連度 {Math.round(post.source_score)}%</span></div></article>)}</div> : <div className="panel mt-6 rounded-2xl px-6 py-10 text-sm text-stone-400">まだ話題投稿を取得していません。管理画面からWeb調査を実行すると、ここに表示されます。</div>}{posts.length > 10 && <div className="mt-6 text-center"><button onClick={() => setExpanded((current) => !current)} className="rounded-xl border border-gold/60 px-5 py-2.5 text-sm font-bold text-gold transition hover:bg-gold hover:text-ink">{expanded ? "表示を減らす" : "もっと見る"}</button></div>}<p className="mt-5 text-xs leading-5 text-stone-600">本文は必要最小限の要約を表示しています。詳細は各出典ページでご確認ください。</p></div></section>;
}
