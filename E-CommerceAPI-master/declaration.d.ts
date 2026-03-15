declare module "flutterwave-node-v3";
declare module "uuid";

declare global {
  namespace Express {
    interface UserPayload {
      _id: string;
      userName: string;
      role: "user" | "admin" | "superadmin";
    }

    interface Request {
      user?: UserPayload;
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      MONGODB_URI?: string;
      MONGODB_URI_FALLBACK?: string;
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;
      APP_BASE_URL?: string;
      CORS_ORIGIN?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_SECURE?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      MAIL_FROM?: string;
      CLOUDINARY_CLOUD_NAME?: string;
      CLOUDINARY_API_KEY?: string;
      CLOUDINARY_API_SECRET?: string;
      FLW_PUBLIC_KEY?: string;
      FLW_SECRET_KEY?: string;
      FLW_ENCRYPTION_KEY?: string;
      AI_PROVIDER?: string;
      AI_API_KEY?: string;
      AI_MODEL?: string;
      AI_BASE_URL?: string;
    }
  }
}

export {};
