import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "E-CommerceAPI-master/.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env"),
];

const envPath = candidateEnvPaths.find((candidatePath) => fs.existsSync(candidatePath));

dotenv.config(envPath ? { path: envPath } : undefined);

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
};

const splitCsv = (value: string | undefined, fallback: string[]) => {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const requireEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const optionalEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  return value.trim() || null;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 2222),
  easyBuyTrackerBaseUrl: process.env.EASYBUY_TRACKER_BASE_URL ?? "https://easybuytrackerbackend.onrender.com",
  ai: {
    provider: optionalEnv("AI_PROVIDER") ?? "openai",
    apiKey: optionalEnv("AI_API_KEY"),
    model: optionalEnv("AI_MODEL") ?? "gpt-5-mini",
    baseUrl: optionalEnv("AI_BASE_URL"),
  },
  mongoUri: () => requireEnv("MONGODB_URI"),
  mongoFallbackUri: () =>
    optionalEnv("MONGODB_URI_FALLBACK") ??
    ((process.env.NODE_ENV ?? "development") === "production" ? null : "mongodb://127.0.0.1:27017/ecommerce"),
  jwtSecret: () => requireEnv("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "40m",
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${toNumber(process.env.PORT, 2222)}`,
  corsOrigins: splitCsv(process.env.CORS_ORIGIN, ["http://localhost:5173"]),
  smtp: {
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: toNumber(process.env.SMTP_PORT, 465),
    secure: toBoolean(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM ?? "Mel Store <noreply@example.com>",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  flutterwave: {
    publicKey: process.env.FLW_PUBLIC_KEY,
    secretKey: process.env.FLW_SECRET_KEY,
    encryptionKey: process.env.FLW_ENCRYPTION_KEY,
  },
};

export const hasMailConfig = Boolean(env.smtp.user && env.smtp.pass);
export const hasCloudinaryConfig = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret,
);
export const hasFlutterwaveConfig = Boolean(
  env.flutterwave.publicKey && env.flutterwave.secretKey && env.flutterwave.encryptionKey,
);
export const hasAiConfig = Boolean(env.ai.provider && env.ai.apiKey && env.ai.model);
