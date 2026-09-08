import { getSessionUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { permissionStatus } from "@/lib/server/meetings";

export const GET = apiHandler(async (request, context) => {
  const { code } = await context.params;
  const user = await getSessionUser(request);
  const params = new URL(request.url).searchParams;
  return json(
    await permissionStatus(
      code,
      "recording",
      {
        admit_token: params.get("admit_token") ?? undefined,
        identity: params.get("identity") ?? undefined,
      },
      user,
    ),
  );
});
