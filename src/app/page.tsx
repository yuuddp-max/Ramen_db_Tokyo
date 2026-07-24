import { SearchExperience } from "@/components/SearchExperience";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { RamenShop } from "@/types/ramen";

export const dynamic = "force-dynamic";

export default async function Home() {
  let shops: RamenShop[] = [];
  let total = 0;
  if (supabase) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("ramen_shops").select("*").order("rating", { ascending: false, nullsFirst: false }).limit(60),
      supabase.from("ramen_shops").select("id", { count: "exact", head: true }),
    ]);
    shops = (data as RamenShop[] | null) ?? []; total = count ?? 0;
  }
  return <main><header className="border-b border-white/10 bg-ink"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="font-black tracking-tight">TOKYO <span className="text-ramen">RAMEN</span></Link><span className="text-xs tracking-[.18em] text-stone-500">RAMEN DIRECTORY</span></div></header><SearchExperience initialShops={shops} initialTotal={total} /><footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-stone-600">© {new Date().getFullYear()} TOKYO RAMEN GUIDE</footer></main>;
}
