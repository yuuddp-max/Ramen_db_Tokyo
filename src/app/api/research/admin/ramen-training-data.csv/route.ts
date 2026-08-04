import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { buildTrainingClassificationText } from "@/lib/shop-classification";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER = "id,text,soup_category,style_category";

function csv(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isHumanConfirmed(shop: Record<string, unknown>) {
  return shop.classificationMethod === "manual" || shop.classificationStatus === "manually-approved";
}

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });

  const { data, error } = await supabaseAdmin.from("ramen_shops").select([
    "id",
    "name",
    "shop_description",
    "representative_menu",
    "review_summary",
    '"soupCategory"',
    '"styleCategory"',
    '"classificationMethod"',
    '"classificationStatus"',
    "feature_text",
    "feature_status",
    "feature_method",
  ].join(",")).eq("is_excluded", false).limit(10_000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const rows: string[] = [];
  for (const raw of data ?? []) {
    const shop = raw as unknown as Record<string, unknown>;
    const soup = normalize(shop.soupCategory);
    const style = normalize(shop.styleCategory);
    if (!shop.id || seen.has(String(shop.id)) || !soup || !style || !isHumanConfirmed(shop)) continue;

    const featureText = shop.feature_status === "completed" && shop.feature_method === "manual"
      ? normalize(shop.feature_text)
      : "";
    const fallbackText = buildTrainingClassificationText({
      name: normalize(shop.name),
      description: normalize(shop.shop_description),
      representativeMenu: normalize(shop.representative_menu),
      reviewSummary: normalize(shop.review_summary),
    });
    const text = featureText || normalize(fallbackText) || normalize(shop.name);
    if (!text) continue;
    seen.add(String(shop.id));
    rows.push([csv(shop.id), csv(text), csv(soup), csv(style)].join(","));
  }

  const filename = `ramen_training_data_${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}.csv`;
  return new NextResponse(`\uFEFF${[HEADER, ...rows].join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
