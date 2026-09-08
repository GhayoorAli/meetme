import { loginUser, setSessionCookie, toApiUser } from "@/lib/server/auth";
import { fail, json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const POST = apiHandler(async (request) => {
  const body = await readBody<{ email?: string; password?: string }>(request);
  if (!body.email || !body.password) {
    return fail("Email and password are required.", 422);
  }
  try {
    const user = await loginUser(body.email, body.password);
    const token = await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    return json({ data: toApiUser(user), token });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid credentials.", 401);
  }
});
