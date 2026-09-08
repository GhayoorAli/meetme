import { getSessionUser } from "@/lib/server/auth";
import { fail, json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { createMeeting, listHostMeetings } from "@/lib/server/meetings";

export const GET = apiHandler(async (request) => {
  const user = await getSessionUser(request);
  if (!user) return fail("Unauthenticated.", 401);
  return json({ data: await listHostMeetings(user.id) });
});

export const POST = apiHandler(async (request) => {
  const user = await getSessionUser(request);
  if (!user) return fail("Unauthenticated.", 401);
  const body = await readBody<{ title?: string }>(request);
  const meeting = await createMeeting(user, body.title);
  return json({ data: meeting }, 201);
});
