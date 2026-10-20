import { createHash, randomBytes } from "node:crypto";
import sendResetEmail from "@/utils/lib/sendResetMail";
import { client } from "@/utils/sanity/client";

export async function POST(req) {
  let stage = "configuration";
  try {
    const { email } = await req.json();
    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return Response.json(
        { message: "Please enter a valid email address." },
        { status: 400 },
      );
    }
    const missing = [
      "NEXT_PRIVATE_EMAIL",
      "NEXT_PRIVATE_PASS",
      "NEXT_PUBLIC_BASE_URL",
    ].filter((name) => !process.env[name]?.trim());
    if (
      !(
        process.env.SANITY_API_TOKEN?.trim() ||
        process.env.NEXT_SANITY_API_TOKEN?.trim()
      )
    ) {
      missing.push("SANITY_API_TOKEN or NEXT_SANITY_API_TOKEN");
    }
    let validBaseUrl = false;
    try {
      validBaseUrl = ["http:", "https:"].includes(
        new URL(process.env.NEXT_PUBLIC_BASE_URL).protocol,
      );
    } catch {
      /* invalid configuration */
    }
    if (missing.length || !validBaseUrl) {
      console.error("Admin password reset configuration incomplete", {
        missing,
        validBaseUrl,
      });
      return Response.json(
        {
          message:
            "Password reset is temporarily unavailable. Please contact support. Reference: ADMIN_RESET_CONFIGURATION",
          code: "ADMIN_RESET_CONFIGURATION",
        },
        { status: 503 },
      );
    }
    stage = "account_lookup";
    const user = await client.fetch(
      '*[_type == "admin" && lower(email) == $email][0]{_id,email}',
      { email: email.trim().toLowerCase() },
    );
    // The same response for unknown accounts avoids revealing admin membership.
    if (user) {
      const token = randomBytes(32).toString("hex");
      stage = "reset_token_save";
      await client
        .patch(user._id)
        .set({
          resetTokenHash: createHash("sha256").update(token).digest("hex"),
          resetTokenExpiry: new Date(Date.now() + 3600000).toISOString(),
        })
        .unset(["resetToken"])
        .commit();
      stage = "email_delivery";
      await sendResetEmail(user.email, token);
    }
    return Response.json({
      message: "If we have this admin email, a password link has been sent.",
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ message: "Invalid request." }, { status: 400 });
    const status = Number(error.statusCode || error.responseCode) || null;
    const smtpCode = [
      "EAUTH",
      "ESOCKET",
      "ETIMEDOUT",
      "ECONNECTION",
      "EENVELOPE",
      "EDNS",
      "ECONNRESET",
    ].includes(error.code)
      ? error.code
      : null;
    // Never log raw SDK/SMTP objects, tokens, passwords, or recipient addresses.
    console.error("Admin password reset failed", { stage, status, smtpCode });
    const code =
      stage === "email_delivery"
        ? smtpCode === "EAUTH"
          ? "ADMIN_RESET_EMAIL_AUTH"
          : "ADMIN_RESET_EMAIL_UNAVAILABLE"
        : [401, 403].includes(status)
          ? "ADMIN_RESET_STORAGE_PERMISSIONS"
          : "ADMIN_RESET_STORAGE_UNAVAILABLE";
    return Response.json(
      {
        message: `We couldn't send a password link. Please contact support. Reference: ${code}`,
        code,
      },
      { status: 503 },
    );
  }
}
