import nodemailer from 'nodemailer';

export default async function sendResetEmail(to, token) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', // or your preferred email service
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
    auth: {
      user: process.env.NEXT_PRIVATE_EMAIL,
      pass: process.env.NEXT_PRIVATE_PASS,
    },
  });

  const resetUrl = new URL('/auth/reset-password', process.env.NEXT_PUBLIC_BASE_URL);
  if (!['http:', 'https:'].includes(resetUrl.protocol)) throw new Error('Invalid password reset base URL');
  resetUrl.searchParams.set('token', token);
  const resetLink = resetUrl.href;

  const mailOptions = {
    from: process.env.NEXT_PRIVATE_EMAIL,
    to,
    subject: 'Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="https://euodia-foods.vercel.app/logo.svg" alt="Euodia whole foods Logo" style="max-width: 150px;" />
        </div>

        <div style="padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="font-size: 16px;">Hi there,</p>
          <p style="font-size: 16px;">
            You requested to reset your password. Click the button below to reset it. This link is valid for the next 60 minutes.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #28a745; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 16px;">
            If you did not request a password reset, please ignore this email or contact support if you have any concerns.
          </p>
          <p style="font-size: 16px;">Thanks, <br/> The Euodia Whole Foods Team</p>
        </div>

        <div style="text-align: center; margin-top: 20px; color: #999;">
          <p style="font-size: 14px;">&copy; ${new Date().getFullYear()} Euodia Whole Foods. All rights reserved.</p>
          <p style="font-size: 14px;">Lagos | Phone: +234 703 335 6847 | <a href="mailto:seuodiawholefoods.dish@gmail.com" style="color: #28a745;">euodiawholefoods.dish@gmail.com</a></p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}
