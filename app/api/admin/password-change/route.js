import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { client } from "@/utils/sanity/client";

export async function POST(req) {
  let stage = "token_lookup";
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
            "Use a valid password link and a password of at least 8 characters (maximum 72 bytes).",
        },
        { status: 400 },
      );
    }
    const user = await client.fetch(
      '*[_type == "admin" && resetTokenHash == $tokenHash && resetTokenExpiry > now()][0]{_id,_rev}',
      { tokenHash: createHash("sha256").update(token).digest("hex") },
    );
    if (!user)
      return Response.json(
        {
          message:
            "Invalid or expired password link. Please request a new one.",
        },
        { status: 400 },
      );
    const password = await bcrypt.hash(newPassword, 10);
    stage = "password_save";
    await client
      .patch(user._id)
      .ifRevisionId(user._rev)
      .set({ password, isVerified: true })
      .unset(["resetToken", "resetTokenHash", "resetTokenExpiry"])
      .commit();
    return Response.json({
      message: "Password reset successful. You can now sign in.",
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
    console.error("Admin password change failed", {
      stage,
      status: Number(error.statusCode) || null,
    });
    return Response.json(
      {
        message: "We couldn't save your password. Please try again later.",
        code: "ADMIN_PASSWORD_SAVE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}
