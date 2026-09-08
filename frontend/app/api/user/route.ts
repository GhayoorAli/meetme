import { getSessionUser, toApiUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const GET = apiHandler(async (request) => {
  const session = await getSessionUser(request);
  if (!session) return fail("Unauthenticated.", 401);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return fail("Unauthenticated.", 401);
  return json({ data: toApiUser(user) });
});
