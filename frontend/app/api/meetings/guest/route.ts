import { json, fail, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { createGuestMeeting } from "@/lib/server/meetings";

export const POST = apiHandler(async (request) => {
  const body = await readBody<{ display_name?: string; title?: string }>(request);
  if (!body.display_name?.trim()) {
    return fail("Display name is required.", 422);
  }
  const result = await createGuestMeeting(body.display_name.trim(), body.title);
  return json(result, 201);
});
