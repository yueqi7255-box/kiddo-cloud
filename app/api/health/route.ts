import { NextResponse } from "next/server";
import type { ApiHealth } from "@/lib/types";

export function GET() {
  const payload: ApiHealth = {
    status: "ok",
    timestamp: new Date().toISOString(),
    note: "Kiddo Cloud mock backend ready",
  };

  return NextResponse.json(payload);
}
