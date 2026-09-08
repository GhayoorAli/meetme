import { getSessionUser } from "@/lib/server/auth";
import { json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { requestPermission } from "@/lib/server/meetings";

export const POST = apiHandler(async (request, context) => {
  const { code } = await context.params;
  const user = await getSessionUser(request);
  const body = await readBody<{ admit_token?: string; identity?: string }>(request);
  const result = await requestPermission(code, "screenShare", body, user);
  return json({
    message: result.message,
    screen_share_permission: result.permission,
  });
});
