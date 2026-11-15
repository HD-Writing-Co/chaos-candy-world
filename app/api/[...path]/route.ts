import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest) {
  const base = process.env.WORLD_SERVER_URL;
  const secret = process.env.API_PROXY_SECRET;

  if (!base || !secret) {
    return Response.json(
      { error: "World server setup is incomplete. Follow START-HERE.md." },
      { status: 503 }
    );
  }

  const path = request.nextUrl.pathname;
  const allowedPaths = [
    "/api/auth/login",
    "/api/auth/callback",
    "/api/me",
    "/api/ticket",
    "/api/logout",
  ];

  if (!allowedPaths.includes(path)) {
    return new Response(null, { status: 404 });
  }

  if (
    request.method === "POST" &&
    request.headers.get("origin") !== request.nextUrl.origin
  ) {
    return new Response(null, { status: 403 });
  }

  try {
    const headers: Record<string, string> = {
      "x-world-proxy": secret,
    };

    if (request.headers.has("cookie")) {
      headers.cookie = request.headers.get("cookie")!;
    }

    const response = await fetch(
      new URL(path + request.nextUrl.search, base),
      {
        method: request.method,
        headers,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      }
    );

    const output = new Headers({ "Cache-Control": "no-store" });

    for (const key of ["content-type", "location"]) {
      if (response.headers.has(key)) {
        output.set(key, response.headers.get(key)!);
      }
    }

    for (const value of response.headers.getSetCookie()) {
      output.append("Set-Cookie", value);
    }

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: output,
    });
  } catch {
    return Response.json(
      { error: "The world server is unavailable. Try again shortly." },
      { status: 503 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
