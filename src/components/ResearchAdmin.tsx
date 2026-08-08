"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TabelogAwardsImport } from "@/components/TabelogAwardsImport";
import { ShopNameMaintenance } from "@/components/ShopNameMaintenance";
import { ClassificationCsvImport } from "@/components/ClassificationCsvImport";

const SOUPS = [
  "醤油",
  "塩",
  "味噌",
  "豚骨",
  "豚骨醤油",
  "豚骨魚介",
  "鶏白湯",
  "煮干し",
  "魚介",
  "貝出汁",
  "担々麺",
  "牛骨",
  "その他",
  "不明",
];
const STYLES = [
  "中華そば",
  "家系",
  "二郎系",
  "二郎インスパイア",
  "つけ麺",
  "油そば・まぜそば",
  "博多系",
  "札幌系",
  "淡麗系",
  "濃厚系",
  "背脂系",
  "ちゃんぽん",
  "その他",
  "不明",
];
type Menu =
  | "research"
  | "google"
  | "webposts"
  | "summary"
  | "local-csv"
  | "classification-import"
  | "name-maintenance";
type PredictionScope = "unclassified" | "include-review" | "all" | "updated";
type PredictionStats = { fetched: number; candidates: number; output: number; unchanged: number; missingText: number; duplicate: number };
type Draft = {
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  soupCategory: string | null;
  styleCategory: string | null;
  soupConfidence: number | null;
  styleConfidence: number | null;
  classificationMethod: string | null;
  classificationStatus: string | null;
  research_evidence_summary: string | null;
};
type Metrics = {
  recordCount: number;
  deletedCount: number;
  total: number;
  soupRegistered: number;
  soupRegistrationRate: number;
  styleRegistered: number;
  styleRegistrationRate: number;
  websiteRegistered: number;
  websiteRegistrationRate: number;
  photoRegistered: number;
  photoRegistrationRate: number;
  soupBreakdown: CategoryMetric[];
  styleBreakdown: CategoryMetric[];
};
type CategoryMetric = { category: string; count: number; rate: number };
type ClassificationMetrics = {
  total: number;
  processed: number;
  autoApproved: number;
  needsReview: number;
  ai: number;
  error: number;
  progress: number;
};
type WebFetchLog = {
  started_at: string;
  status: string;
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  matched_count: number;
  excluded_count: number;
  error_count: number;
  api_status: number | null;
  error_summary: string | null;
} | null;

const menus: { key: Menu; label: string; description: string }[] = [
  {
    key: "google",
    label: "新規データ取得",
    description: "Google Mapsで検索し、未登録店舗だけを追加します。",
  },
  {
    key: "local-csv",
    label: "CSV出力",
    description: "生成AI APIを使わず、ローカル分類モデル用のCSVを出力します。",
  },
  {
    key: "classification-import",
    label: "CSV取込",
    description: "ローカル環境で分類したCSVを取り込み、登録済み分類を更新します。",
  },
  {
    key: "name-maintenance",
    label: "データメンテナンス",
    description: "登録済み店舗の店名や削除状態を管理します。",
  },
  {
    key: "webposts",
    label: "今週の話題投稿",
    description: "Web調査で直近の東京ラーメン情報を取得します。",
  },
  {
    key: "summary",
    label: "登録データ集計",
    description: "店舗データの登録状況・充足率を確認できます。",
  },
];

function Card({
  label,
  value,
  suffix = "店",
  tone = "text-white",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-stone-500">
          {suffix}
        </span>
      </p>
    </div>
  );
}

function DashboardCard({ label, value, suffix = "店", accent = false }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  return <div className="rounded-2xl border border-[#E7E3DD] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><p className="text-sm font-medium text-[#77736D]">{label}</p><p className={`mt-2 text-3xl font-black ${accent ? "text-[#D28A11]" : "text-[#222]"}`}>{value.toLocaleString()}<span className="ml-1 text-sm font-normal text-[#77736D]">{suffix}</span></p></div>;
}

function BreakdownRow({ category, count, rate, total }: { category: string; count: number; rate: number; total: number }) {
  return <div className={`rounded-xl px-3 py-2 ${count === 0 ? "text-[#AAA59D]" : "text-[#222]"}`}><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{category}</span><span className="whitespace-nowrap">{count.toLocaleString()}店 <span className="ml-2 text-xs text-[#77736D]">{rate}%</span></span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEEAE4]"><div className="h-full rounded-full bg-[#D28A11]" style={{ width: `${total ? Math.min(100, (count / total) * 100) : 0}%` }} /></div></div>;
}

export function ResearchAdmin({
  authenticated,
  drafts,
  metrics,
  classificationMetrics,
  webFetchLog,
}: {
  authenticated: boolean;
  drafts: Draft[];
  metrics: Metrics;
  classificationMetrics: ClassificationMetrics;
  webFetchLog: WebFetchLog;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [active, setActive] = useState<Menu>("google");
  const [query, setQuery] = useState("ラーメン");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [manual, setManual] = useState<
    Record<string, { soup: string; style: string }>
  >({});
  const [predictionScope, setPredictionScope] = useState<PredictionScope>("unclassified");
  const [predictionBusy, setPredictionBusy] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState("");
  const [predictionStats, setPredictionStats] = useState<PredictionStats | null>(null);
  useEffect(() => {
    setExcludeKeywords(window.localStorage.getItem("ramen-admin-exclude-keywords") ?? "");
  }, []);
  const request = async (url: string, options: RequestInit = {}) => {
    setBusy(true);
    setMessage(url.includes("/web-ramen") ? "Web調査を開始しています。完了までしばらくお待ちください…" : "");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 240_000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers ?? {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "処理に失敗しました。");
      if (data.job)
        setMessage(
          data.message ??
            `分類ジョブ ${data.job.id} を登録しました。バックグラウンド処理を開始しています。`,
        );
      else if (data.imported != null)
        setMessage(
          `Google Mapsで${data.found ?? 0}店を確認。新規${data.imported}店、登録済み${data.skippedExisting ?? 0}店をスキップしました。${data.excludedByKeyword ? `除外キーワードで${data.excludedByKeyword}店を除外しました。` : ""}`,
        );
      else if (data.fetched != null)
        setMessage(
          `Web調査: ${data.fetched}件取得、新規${data.inserted ?? 0}件、更新${data.updated ?? 0}件。`,
        );
      else setMessage(data.message ?? "保存しました。");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "処理が4分を超えたためタイムアウトしました。時間を置いて再実行してください。"
          : error instanceof Error ? error.message : "処理に失敗しました。",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };
  const setManualValue = (
    placeId: string,
    key: "soup" | "style",
    value: string,
  ) =>
    setManual((current) => ({
      ...current,
      [placeId]: {
        ...(current[placeId] ?? { soup: "", style: "" }),
        [key]: value,
      },
    }));
  const saveManual = (shop: Draft) => {
    const values = manual[shop.place_id] ?? {
      soup: shop.soupCategory ?? "",
      style: shop.styleCategory ?? "",
    };
    request("/api/research/admin/manual-classification", {
      method: "POST",
      body: JSON.stringify({
        placeId: shop.place_id,
        soupCategory: values.soup,
        styleCategory: values.style,
      }),
    });
  };
  const excludeShop = (shop: Draft) => {
    if (!window.confirm(`「${shop.name}」をラーメン店ではない店舗として一覧・分類対象から除外しますか？\n\nデータは完全削除されず、必要なら復元できます。`)) return;
    request("/api/research/admin/exclude-shop", {
      method: "POST",
      body: JSON.stringify({ placeId: shop.place_id }),
    });
  };
  const exportPredictionCsv = async () => {
    if (predictionBusy) return;
    setPredictionBusy(true);
    setPredictionMessage("Supabaseから店舗データを取得しています…");
    setPredictionStats(null);
    try {
      const query = `?mode=preview&scope=${encodeURIComponent(predictionScope)}`;
      const previewResponse = await fetch(`/api/research/admin/shops-to-predict.csv${query}`, { cache: "no-store" });
      const preview = await previewResponse.json().catch(() => ({}));
      if (!previewResponse.ok) throw new Error(preview.error ?? "CSVの出力に失敗しました");
      const stats = preview.stats as PredictionStats;
      setPredictionStats(stats);
      setPredictionMessage("分類用テキストを生成しています…");
      if (!stats.output) {
        setPredictionMessage("出力対象の未分類店舗はありません");
        return;
      }
      const scopeLabel = predictionScope === "all" ? "全店舗" : predictionScope === "updated" ? "更新された店舗" : predictionScope === "include-review" ? "未分類・確認待ち店舗" : "未分類店舗";
      if (!window.confirm(`${scopeLabel}${stats.output}件をCSV出力します。\nこの処理では生成AI APIを使用せず、トークンも消費しません。\n出力を開始しますか？`)) {
        setPredictionMessage("CSV出力をキャンセルしました。");
        return;
      }
      setPredictionMessage("CSVファイルを作成しています…");
      const downloadResponse = await fetch(`/api/research/admin/shops-to-predict.csv?mode=download&scope=${encodeURIComponent(predictionScope)}`, { cache: "no-store" });
      if (!downloadResponse.ok) {
        const error = await downloadResponse.json().catch(() => ({}));
        throw new Error(error.error ?? "CSVの出力に失敗しました");
      }
      const blob = await downloadResponse.blob();
      const disposition = downloadResponse.headers.get("content-disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `shops_to_predict_${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14)}.csv`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPredictionMessage(`${stats.output}件の店舗データを出力しました`);
    } catch (error) {
      console.error("shops_to_predict CSV export failed", error);
      setPredictionMessage(error instanceof Error ? error.message : "CSVの出力に失敗しました");
    } finally {
      setPredictionBusy(false);
    }
  };
  if (!authenticated)
    return (
      <main className="mx-auto max-w-md px-5 py-20">
        <div className="panel rounded-2xl p-6">
          <p className="text-xs font-bold tracking-[.2em] text-gold">ADMIN</p>
          <h1 className="mt-2 text-2xl font-black">管理画面</h1>
          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              request("/api/research/admin/session", {
                method: "POST",
                body: JSON.stringify({ password }),
              });
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              placeholder="管理者パスワード"
              required
            />
            <button
              disabled={busy}
              className="w-full rounded-xl bg-gold px-4 py-3 font-bold text-ink"
            >
              ログイン
            </button>
          </form>
          {message && <p className="mt-4 text-sm text-gold">{message}</p>}
        </div>
      </main>
    );
  const activeMenu = menus.find((menu) => menu.key === active)!;
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-gold">
            ADMIN · RAMEN DATABASE
          </p>
          <h1 className="mt-2 text-3xl font-black">管理画面</h1>
          <p className="mt-2 text-sm text-stone-400">
            {activeMenu.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={busy}
            onClick={() => window.location.reload()}
            className="rounded-xl border border-gold/50 px-4 py-2 text-sm font-bold text-gold hover:bg-gold/10 disabled:cursor-wait disabled:opacity-50"
          >
            リロード
          </button>
          <button
            disabled={busy}
            onClick={() =>
              request("/api/research/admin/session", { method: "DELETE" })
            }
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-stone-400"
          >
            ログアウト
          </button>
        </div>
      </div>
      <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-[#E7E3DD]">
        {menus.map((menu) => (
          <button
            key={menu.key}
            onClick={() => {
              setActive(menu.key);
              setMessage("");
            }}
            className={`border-b-[3px] px-1 py-3 text-left text-sm font-bold transition-colors ${active === menu.key ? "border-[#D28A11] text-[#C77B00]" : "border-transparent text-[#77736D] hover:text-[#C77B00]"}`}
          >
            {menu.label}
          </button>
        ))}
      </nav>
      {message && (
        <p className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          {message}
        </p>
      )}
      {active === "research" && (
        <section className="mt-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              label="全対象店舗数"
              value={classificationMetrics.total}
              tone="text-gold"
            />
            <Card
              label="処理済み件数"
              value={classificationMetrics.processed}
            />
            <Card
              label="自動確定件数"
              value={classificationMetrics.autoApproved}
              tone="text-emerald-400"
            />
            <Card
              label="確認待ち件数"
              value={classificationMetrics.needsReview}
              tone="text-ramen"
            />
            <Card label="AI判定件数" value={classificationMetrics.ai} />
            <Card
              label="エラー件数"
              value={classificationMetrics.error}
              tone="text-ramen"
            />
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
              <p className="text-xs text-stone-500">処理進捗率</p>
              <p className="mt-1 text-2xl font-black text-gold">
                {classificationMetrics.progress.toFixed(1)}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gold"
                  style={{
                    width: `${Math.min(100, classificationMetrics.progress)}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-5">
            <p className="text-sm text-stone-400">
              未分類のうち、Google評価・口コミ数が高い店舗からバックグラウンドで処理します。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  request("/api/research/admin/classification-jobs", {
                    method: "POST",
                    body: JSON.stringify({ limit: 10 }),
                  })
                }
                className="rounded-xl border border-gold px-4 py-3 text-sm font-bold text-gold"
              >
                今すぐ実行（10件）
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  request("/api/research/admin/classification-jobs", {
                    method: "POST",
                    body: JSON.stringify({ limit: 100 }),
                  })
                }
                className="rounded-xl bg-gold px-4 py-3 text-sm font-bold text-ink"
              >
                今すぐ実行（100件）
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("review-list")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-stone-200"
              >
                確認待ち店舗を表示
              </button>
            </div>
          </div>
          <div id="review-list" className="mt-5 space-y-4">
            {drafts.length ? (
              drafts.map((shop) => {
                const values = manual[shop.place_id] ?? {
                  soup: shop.soupCategory ?? "",
                  style: shop.styleCategory ?? "",
                };
                return (
                  <article
                    key={shop.place_id}
                    className="panel rounded-2xl p-5"
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <h2 className="min-w-0 text-lg font-bold">{shop.name}</h2>
                      <p className="text-sm text-stone-400">{shop.address}</p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="rounded bg-white/5 px-2 py-1 text-gold">
                          ★ Google {shop.rating?.toFixed(1) ?? "–"}
                        </span>
                        <span className="rounded bg-white/5 px-2 py-1">
                          口コミ{" "}
                          {shop.user_ratings_total?.toLocaleString() ?? "–"}件
                        </span>
                        <span className="rounded bg-white/5 px-2 py-1">
                          {shop.classificationMethod ?? "-"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] lg:items-end">
                      <label>
                        スープ分類
                        <select
                          value={values.soup}
                          onChange={(event) =>
                            setManualValue(
                              shop.place_id,
                              "soup",
                              event.target.value,
                            )
                          }
                          className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2"
                        >
                          <option value="">選択してください</option>
                          {SOUPS.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        スタイル分類
                        <select
                          value={values.style}
                          onChange={(event) =>
                            setManualValue(
                              shop.place_id,
                              "style",
                              event.target.value,
                            )
                          }
                          className="mt-1 block w-full rounded-lg border border-white/15 bg-black px-3 py-2"
                        >
                          <option value="">選択してください</option>
                          {STYLES.map((value) => (
                            <option key={value}>{value}</option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap items-end gap-2 lg:col-span-1">
                        <p className="mr-auto text-sm text-stone-400">
                          確信度: soup {shop.soupConfidence?.toFixed(2) ?? "-"} /
                          style {shop.styleConfidence?.toFixed(2) ?? "-"}
                        </p>
                        <button
                          disabled={busy || !values.soup || !values.style}
                          onClick={() => saveManual(shop)}
                          className="rounded-lg border border-gold px-3 py-2 text-sm font-bold text-gold"
                        >
                          手動分類を保存
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            request("/api/research/soup/approve", {
                              method: "POST",
                              body: JSON.stringify({ placeIds: [shop.place_id] }),
                            })
                          }
                          className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-ink"
                        >
                          手動承認
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => excludeShop(shop)}
                          className="rounded-lg border border-red-500/60 px-3 py-2 text-sm font-bold text-red-400 hover:bg-red-500/10"
                        >
                          ラーメン店ではないため削除
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="panel rounded-2xl px-6 py-16 text-center text-stone-400">
                確認待ち店舗はありません。
              </div>
            )}
          </div>
        </section>
      )}
      {active === "google" && (
        <section className="panel mt-8 rounded-2xl p-6">
          <h2 className="text-2xl font-black">新規店舗を取得</h2>
          <p className="mt-3 text-sm text-stone-400">
            対象地域は東京都固定です。
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-5 block w-full max-w-xl rounded-xl border border-white/10 bg-black/30 px-4 py-3"
          />
          <button
            disabled={busy}
            onClick={() =>
              request("/api/research/admin/google-import", {
                method: "POST",
                body: JSON.stringify({ query, excludeKeywords }),
              })
            }
            className="mt-4 rounded-xl bg-gold px-4 py-3 font-bold text-ink"
          >
            Google Mapsから検索・登録
          </button>
          <label className="mt-5 block max-w-xl text-sm font-bold text-stone-700">
            除外キーワード（カンマ・改行区切り）
            <input
              value={excludeKeywords}
              onChange={(event) => {
                const value = event.target.value;
                setExcludeKeywords(value);
                window.localStorage.setItem("ramen-admin-exclude-keywords", value);
              }}
              placeholder="例：閉店、居酒屋、焼肉"
              className="mt-1 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-normal text-stone-900"
            />
            <span className="mt-1 block font-normal text-stone-500">店舗名・住所・Googleのジャンルに含まれる店舗を登録前に除外します。</span>
          </label>
        </section>
      )}
      {active === "webposts" && (
        <section className="panel mt-8 rounded-2xl p-6">
          <h2 className="text-2xl font-black">今週の東京ラーメン話題投稿</h2>
          <button
            disabled={busy}
            onClick={() =>
              request("/api/research/admin/web-ramen", { method: "POST" })
            }
            className="mt-5 rounded-xl bg-gold px-4 py-3 font-bold text-ink disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Web調査を実行中…" : "Web調査を実行"}
          </button>
          {webFetchLog && (
            <p className="mt-4 text-sm text-stone-400">
              前回: {webFetchLog.fetched_count}件取得 / 新規
              {webFetchLog.inserted_count}件 / 更新{webFetchLog.updated_count}件
            </p>
          )}
        </section>
      )}
      {active === "summary" && (
        <section className="mt-8 space-y-10">
          <div><h2 className="mb-4 text-2xl font-bold text-[#222]">主要KPI</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><DashboardCard label="総レコード数" value={metrics.recordCount} /><DashboardCard label="登録店舗数" value={metrics.total} accent /></div></div>
          <div className="grid gap-4 sm:grid-cols-3"><DashboardCard label="総レコード" value={metrics.recordCount} /><DashboardCard label="有効店舗" value={metrics.total} /><DashboardCard label="削除済み" value={metrics.deletedCount} /></div>
          <div className="grid gap-8 lg:grid-cols-2"><div className="rounded-2xl border border-[#E7E3DD] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><h2 className="mb-4 text-2xl font-bold text-[#222]">スープ系統別集計</h2><div className="space-y-1">{[...metrics.soupBreakdown].sort((a, b) => b.count - a.count).map((item) => <BreakdownRow key={item.category} {...item} total={metrics.total} />)}</div></div><div className="rounded-2xl border border-[#E7E3DD] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"><h2 className="mb-4 text-2xl font-bold text-[#222]">カテゴリ別集計</h2><div className="space-y-1">{[...metrics.styleBreakdown].sort((a, b) => b.count - a.count).map((item) => <BreakdownRow key={item.category} {...item} total={metrics.total} />)}</div></div></div>
        </section>
      )}
      {active === "classification-import" && (
        <>
          <ClassificationCsvImport />
          <TabelogAwardsImport />
        </>
      )}
      {active === "local-csv" && (
        <section className="panel mt-8 rounded-2xl p-6">
          <h2 className="text-2xl font-black">CSV出力</h2>
          <p className="mt-3 text-sm text-stone-400">ramen_shopsのid・name・addressと、classification_training_examplesの分類結果を出力します。生成AI APIやAPIトークンは使用しません。</p>
          <code className="mt-3 block overflow-x-auto text-xs text-stone-500">id,name,address,soup_category,style_category</code>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-white">
              出力対象
              <select value={predictionScope} onChange={(event) => { const next = event.target.value as PredictionScope; if (next === "all" && !window.confirm("全店舗を出力対象にします。大量のデータが出力される可能性があります。続行しますか？")) return; setPredictionScope(next); setPredictionStats(null); setPredictionMessage(""); }} className="mt-1 block min-w-64 rounded-lg border border-white/15 bg-black px-3 py-2 text-white">
                <option value="unclassified">未分類のみ</option>
                <option value="all">全店舗</option>
                <option value="updated">更新された店舗のみ</option>
              </select>
            </label>
            <button disabled={predictionBusy} onClick={() => void exportPredictionCsv()} className="rounded-xl bg-gold px-4 py-3 font-bold text-ink disabled:cursor-wait disabled:opacity-50">
              {predictionBusy ? "CSV作成中…" : "未分類店舗CSVを出力"}
            </button>
          </div>
          {predictionMessage && <p className="mt-4 text-sm text-gold">{predictionMessage}</p>}
          {predictionStats && <div className="mt-4 grid gap-2 text-xs text-stone-400 sm:grid-cols-2 lg:grid-cols-5">
            <span>取得: {predictionStats.fetched}件</span>
            <span>対象: {predictionStats.candidates}件</span>
            <span>出力: {predictionStats.output}件</span>
            <span>変更なし除外: {predictionStats.unchanged}件</span>
            <span>テキスト不足: {predictionStats.missingText}件 / 重複除外: {predictionStats.duplicate}件</span>
          </div>}
        </section>
      )}
      {active === "name-maintenance" && <ShopNameMaintenance />}
    </main>
  );
}
