import { getSessionUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { serializeUser } from "@/lib/server/serialize";

export const GET = apiHandler(async (request) => {
  const user = await getSessionUser(request);
  if (!user?.isAdmin) return fail("Forbidden.", 403);
  const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
  const perPage = 20;
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count(),
  ]);
  return json({
    data: rows.map(serializeUser),
    meta: {
      current_page: page,
      last_page: Math.max(1, Math.ceil(total / perPage)),
      per_page: perPage,
      total,
    },
  });
});
