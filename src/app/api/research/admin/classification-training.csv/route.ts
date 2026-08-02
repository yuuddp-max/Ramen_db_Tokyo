import { NextRequest, NextResponse } from "next/server";
import { isResearchAdminRequest } from "@/lib/research-admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

function csv(value: string | null | undefined) {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!isResearchAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 500 });
  const { data, error } = await supabaseAdmin.from("classification_training_examples").select("classification_text,source_hash,soup_category,style_category,created_at").order("created_at", { ascending: false }).limit(10_000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ["classification_text,source_hash,soup_category,style_category,created_at", ...(data ?? []).map((row) => [csv(row.classification_text), csv(row.source_hash), csv(row.soup_category), csv(row.style_category), csv(row.created_at)].join(","))];
  return new NextResponse(`\uFEFF${rows.join("\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ramen-classification-training.csv"' } });
}
