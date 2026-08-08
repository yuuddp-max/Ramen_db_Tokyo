/** CSV files are ingestion sources, not reader-facing article links. */
export function isCsvSourceUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.pathname.toLowerCase().endsWith(".csv") || url.searchParams.get("export") === "download" || (url.hostname === "drive.google.com" && url.pathname.includes("/uc"));
  } catch { return false; }
}
