import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/web-ramen-jobs", () => ({ runWebRamenResearch: vi.fn() }));
import { GET } from "@/app/api/cron/web-ramen/route";

describe("web ramen cron authentication", () => {
  beforeEach(() => { process.env.CRON_SECRET = "cron-test-secret"; });
  it("rejects an invalid secret", async () => { expect((await GET(new NextRequest("https://example.test/api/cron/web-ramen", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401); });
});
