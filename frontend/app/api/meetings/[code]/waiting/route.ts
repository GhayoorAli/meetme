import { getSessionUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { listWaiting } from "@/lib/server/meetings";

export const GET = apiHandler(async (request, context) => {
  const { code } = await context.params;
  const user = await getSessionUser(request);
  const hostToken = new URL(request.url).searchParams.get("host_token") ?? undefined;
  return json({ data: await listWaiting(code, user, hostToken) });
});
