import { getSessionUser } from "@/lib/server/auth";
import { json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { joinMeeting } from "@/lib/server/meetings";

export const POST = apiHandler(async (request, context) => {
  const { code } = await context.params;
  const user = await getSessionUser(request);
  const body = await readBody<{
    display_name?: string;
    host_token?: string;
    admit_token?: string;
  }>(request);
  return json(await joinMeeting(code, body, user));
});
