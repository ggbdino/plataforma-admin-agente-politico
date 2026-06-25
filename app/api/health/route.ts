import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "plataforma_admin",
    version: APP_VERSION,
    checkedAt: new Date().toISOString()
  });
}
