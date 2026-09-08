import { getSessionUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { fail, json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { serializeUser } from "@/lib/server/serialize";

export const PATCH = apiHandler(async (request, context) => {
  const admin = await getSessionUser(request);
  if (!admin?.isAdmin) return fail("Forbidden.", 403);
  const { id } = await context.params;
  const body = await readBody<{ is_admin?: boolean; name?: string }>(request);
  const user = await prisma.user.update({
    where: { id: Number(id) },
    data: {
      ...(typeof body.is_admin === "boolean" ? { isAdmin: body.is_admin } : {}),
      ...(body.name ? { name: body.name } : {}),
    },
  });
  return json({ data: serializeUser(user) });
});
