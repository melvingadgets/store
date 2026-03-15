import nodemailer from "nodemailer";
import { env, hasMailConfig } from "../config/env";

interface SendVerificationEmailOptions {
  email: string;
  verificationToken: string;
  userName: string;
}

const createTransporter = () =>
  nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });

export const sendVerificationEmail = async ({
  email,
  verificationToken,
  userName,
}: SendVerificationEmailOptions) => {
  if (!hasMailConfig) {
    return false;
  }

  const verificationUrl = `${env.appBaseUrl}/api/v1/verify-account/${encodeURIComponent(verificationToken)}`;

  await createTransporter().sendMail({
    from: env.smtp.from,
    to: email,
    subject: "Verify your Mel Store account",
    html: `
      <p>Hello ${userName},</p>
      <p>Use the link below to verify your account:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    `,
  });

  return true;
};
