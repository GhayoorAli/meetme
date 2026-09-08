import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status: number, errors?: Record<string, string[]>) {
  return NextResponse.json({ message, errors }, { status });
}

export async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function applyCors(response: NextResponse, request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
  }
  return response;
}

export function withCors(
  handler: (request: Request, context?: unknown) => Promise<NextResponse>,
) {
  return async (request: Request, context?: unknown) => {
    if (request.method === "OPTIONS") {
      return applyCors(new NextResponse(null, { status: 204 }), request);
    }
    const response = await handler(request, context);
    return applyCors(response, request);
  };
}
