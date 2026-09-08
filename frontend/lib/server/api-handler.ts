import { NextResponse } from "next/server";
import { ApiError } from "@/lib/server/meetings";
import { applyCors } from "@/lib/server/http";

export function apiHandler(
  fn: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ) => {
    if (request.method === "OPTIONS") {
      return applyCors(new NextResponse(null, { status: 204 }), request);
    }
    try {
      const response = await fn(request, context);
      return applyCors(response, request);
    } catch (error) {
      if (error instanceof ApiError) {
        return applyCors(
          NextResponse.json({ message: error.message }, { status: error.status }),
          request,
        );
      }
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      return applyCors(
        NextResponse.json({ message }, { status: 500 }),
        request,
      );
    }
  };
}
