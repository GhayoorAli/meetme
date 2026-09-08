import { getSessionUser } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { fail, json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const GET = apiHandler(async (request) => {
  const user = await getSessionUser(request);
  if (!user?.isAdmin) return fail("Forbidden.", 403);

  const [users, meetings, activeMeetings, totalParticipants] = await Promise.all([
    prisma.user.count(),
    prisma.meeting.count(),
    prisma.meeting.count({ where: { status: "active" } }),
    prisma.meetingParticipant.count(),
  ]);

  return json({
    users,
    meetings,
    active_meetings: activeMeetings,
    total_participants: totalParticipants,
  });
});
