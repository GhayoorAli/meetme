import {
  registerUser,
  setSessionCookie,
  toApiUser,
} from "@/lib/server/auth";
import { fail, json, readBody } from "@/lib/server/http";
import { apiHandler } from "@/lib/server/api-handler";

export const POST = apiHandler(async (request) => {
  const body = await readBody<{
    name?: string;
    email?: string;
    password?: string;
    password_confirmation?: string;
  }>(request);

  if (!body.name?.trim() || !body.email?.trim() || !body.password) {
    return fail("Name, email, and password are required.", 422);
  }
  if (body.password !== body.password_confirmation) {
    return fail("Passwords do not match.", 422, {
      password_confirmation: ["Passwords do not match."],
    });
  }
  if (body.password.length < 8) {
    return fail("Password must be at least 8 characters.", 422);
  }

  try {
    const user = await registerUser({
      name: body.name,
      email: body.email,
      password: body.password,
    });
    const token = await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    return json({ data: toApiUser(user), token }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not register.";
    const status = message.includes("already registered") ? 422 : 500;
    return fail(message, status);
  }
});
