import { clearSessionCookie } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const POST = apiHandler(async () => {
  await clearSessionCookie();
  return json({ message: "Logged out." });
});
