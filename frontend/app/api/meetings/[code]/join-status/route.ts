import { json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { joinStatus } from "@/lib/server/meetings";

export const GET = apiHandler(async (request, context) => {
  const { code } = await context.params;
  const admitToken = new URL(request.url).searchParams.get("admit_token") ?? "";
  return json(await joinStatus(code, admitToken));
});
