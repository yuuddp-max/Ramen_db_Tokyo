"use client";

import Link from "next/link";
import { useState } from "react";
import type { WebRamenMentionWithShop } from "@/types/web-ramen";

function formatPostedAt(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(value)); }

export function WeeklyRamenPosts({ posts }: { posts: WebRamenMentionWithShop[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = posts.slice(0, expanded ? 20 : 4);
  return <section className="border-t border-border bg-background-subtle"><div className="mx-auto max-w-[1440px] px-6 py-12 sm:px-8"><h2 className="text-2xl font-black text-ink sm:text-[26px]">今週の東京ラーメン情報</h2><p className="mt-2 text-sm leading-6 text-text-secondary">新メニュー、限定営業、イベントなど、直近7日間に公開された情報を紹介します。</p>{visible.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{visible.map((post) => <article key={post.mention_id} className="rounded-2xl border border-border bg-white p-5"><div className="flex items-center justify-between gap-3 text-xs text-text-muted"><span>{post.matched_area ? `地域：${post.matched_area}` : "東京ラーメン情報"}</span><span>{post.published_at ? formatPostedAt(post.published_at) : "掲載日不明"}</span></div><p className="mt-3 text-xs font-bold text-accent">{post.source_name}</p><h3 className="mt-2 text-base font-bold leading-6 text-ink">{post.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">{post.summary}</p><div className="mt-4 flex flex-wrap items-center gap-3">{post.ramen_shops && <Link href={`/shops/${post.ramen_shops.id}`} className="text-xs font-bold text-accent hover:underline">店舗詳細を見る</Link>}<a href={post.source_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-accent hover:underline">外部記事を見る ↗</a></div></article>)}</div> : <div className="mt-6 rounded-2xl border border-border bg-white px-6 py-10 text-sm text-text-secondary">まだ今週の情報を取得していません。管理画面からWeb調査を実行してください。</div>}{posts.length > 4 && <div className="mt-6 text-center"><button type="button" onClick={() => setExpanded((current) => !current)} className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-bold text-accent hover:border-accent">{expanded ? "表示を減らす" : "もっと見る"}</button></div>}</div></section>;
}
