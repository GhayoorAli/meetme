import { getSessionUser } from "@/lib/server/auth";
import { json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { leaveMeeting } from "@/lib/server/meetings";

export const POST = apiHandler(async (request, context) => {
  const { code } = await context.params;
  await getSessionUser(request);
  const body = await readBody<{ admit_token?: string; identity?: string }>(request);
  await leaveMeeting(code, body);
  return json({ message: "Left meeting." });
});
