import { getSessionUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const DELETE = apiHandler(async (request, context) => {
  const admin = await getSessionUser(request);
  if (!admin?.isAdmin) return fail("Forbidden.", 403);
  const { id } = await context.params;
  await prisma.meeting.delete({ where: { id: Number(id) } });
  return json({ message: "Meeting deleted." });
});
