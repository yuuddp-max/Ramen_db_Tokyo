import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const RESEARCH_ADMIN_COOKIE = "ramen_research_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function signature(payload: string) {
  const secret = process.env.RESEARCH_ADMIN_PASSWORD;
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createResearchAdminSession() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `research-admin:${expiresAt}`;
  const signed = signature(payload);
  return signed ? `${expiresAt}.${signed}` : null;
}

export function isResearchAdminSession(value: string | undefined) {
  if (!value) return false;
  const [rawExpiresAt, receivedSignature] = value.split(".");
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < Date.now() || !receivedSignature) return false;
  const expectedSignature = signature(`research-admin:${expiresAt}`);
  if (!expectedSignature || expectedSignature.length !== receivedSignature.length) return false;
  return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));
}

export function isResearchAdminRequest(request: NextRequest) {
  return isResearchAdminSession(request.cookies.get(RESEARCH_ADMIN_COOKIE)?.value);
}

export function isResearchSecretRequest(request: NextRequest) {
  return Boolean(process.env.RESEARCH_API_SECRET && request.headers.get("x-research-secret") === process.env.RESEARCH_API_SECRET);
}
