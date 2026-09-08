import { getSessionUser } from "@/lib/server/auth";
import { json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";
import { admitParticipant } from "@/lib/server/meetings";

export const POST = apiHandler(async (request, context) => {
  const { code, participantId } = await context.params;
  const user = await getSessionUser(request);
  const body = await readBody<{ host_token?: string }>(request);
  const participant = await admitParticipant(
    code,
    Number(participantId),
    user,
    body.host_token,
  );
  return json({ message: "Participant admitted.", participant });
});
