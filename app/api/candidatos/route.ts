import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/repositories/candidates";

export async function GET() {
  const items = await listCandidates();
  return NextResponse.json({ items });
}
