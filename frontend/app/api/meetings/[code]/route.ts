import { fail, json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { findMeetingByCode } from "@/lib/server/meetings";
import { serializeMeeting } from "@/lib/server/serialize";

export const GET = apiHandler(async (_request, context) => {
  const { code } = await context.params;
  const meeting = await findMeetingByCode(code);
  if (!meeting) return fail("Meeting not found.", 404);
  return json({ data: serializeMeeting(meeting) });
});
