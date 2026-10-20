import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { client } from "@/utils/sanity/client";

export async function POST(req) {
  try {
    const { token, newPassword } = await req.json();
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof newPassword !== "string" ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    ) {
      return Response.json(
        {
          message:
            "Use a valid password link and a password between 8 and 72 bytes.",
        },
        { status: 400 },
      );
    }
    const user = await client.fetch(
      '*[_type == "customer" && resetTokenHash == $tokenHash && resetTokenExpiry > now()][0]',
      { tokenHash: createHash("sha256").update(token).digest("hex") },
    );
    if (!user)
      return Response.json(
        { message: "Invalid or expired password link." },
        { status: 400 },
      );
    const password = await bcrypt.hash(newPassword, 10);
    // Only someone with the emailed token can activate a guest account. A
    // revision guard makes the token single-use even under concurrent requests.
    await client
      .patch(user._id)
      .ifRevisionId(user._rev)
      .set({ password, isAnonymous: false })
      .unset(["resetToken", "resetTokenHash", "resetTokenExpiry"])
      .commit();
    return Response.json({
      message: "Your password is set. You can now sign in.",
    });
  } catch (error) {
    if (error instanceof SyntaxError || error.statusCode === 409) {
      return Response.json(
        {
          message:
            "Invalid or expired password link. Please request a new one.",
        },
        { status: 400 },
      );
    }
    console.error("Password change failed:", error.name);
    return Response.json(
      { message: "We couldn't set your password. Please try again later." },
      { status: 503 },
    );
  }
}
