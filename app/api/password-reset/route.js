import { createHash, randomBytes } from "node:crypto";
import sendResetMailToUser from "@/utils/lib/sendResetMailToUser";
import { client, getUserByEmail } from "@/utils/sanity/client";

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return Response.json(
        { message: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    // Prefer the registered account when multiple guest purchases share an email.
    const user = await getUserByEmail(email.trim().toLowerCase());
    if (user) {
      const token = randomBytes(32).toString("hex");
      await client
        .patch(user._id)
        .set({
          resetTokenHash: createHash("sha256").update(token).digest("hex"),
          resetTokenExpiry: new Date(Date.now() + 3600000).toISOString(),
        })
        .unset(["resetToken"])
        .commit();
      await sendResetMailToUser(user.email, token);
    }
    return Response.json({
      message: "If we have this email, a password link has been sent.",
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ message: "Invalid request." }, { status: 400 });
    console.error("Password link request failed:", error.name);
    return Response.json(
      { message: "We couldn't send a password link. Please try again later." },
      { status: 503 },
    );
  }
}
