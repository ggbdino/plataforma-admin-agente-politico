import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const forceHttps = process.env.APP_FORCE_HTTPS === "true";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (forceHttps && forwardedProto === "http" && !isLocalhost) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
