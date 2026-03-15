import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import type { SignOptions } from "jsonwebtoken";
import profileModel from "../model/profileModel";
import userModel from "../model/userModel";
import userSessionModel from "../model/userSessionModel";
import { env, hasMailConfig } from "../config/env";
import { sendVerificationEmail } from "../utils/EmailVerification";
import {
  buildSessionSnapshot,
  detectBrowser,
  detectDeviceType,
  detectOperatingSystem,
  extractClientIp,
  normalizeClientContext,
} from "../utils/userSessionTelemetry";

interface VerificationTokenPayload {
  purpose: "verify-account";
  userId: string;
}

const sanitizeUser = (user: { toObject?: () => Record<string, unknown> } | Record<string, unknown>) => {
  const plainUser = "toObject" in user && typeof user.toObject === "function" ? user.toObject() : user;
  const safeUser = { ...(plainUser as Record<string, unknown>) };
  delete safeUser.password;
  return safeUser;
};

const createToken = (payload: Express.UserPayload) =>
  jwt.sign(payload, env.jwtSecret(), {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });

const createVerificationToken = (userId: string) =>
  jwt.sign(
    {
      purpose: "verify-account",
      userId,
    } satisfies VerificationTokenPayload,
    env.jwtSecret(),
    {
      expiresIn: "1d",
    },
  );

const sendVerificationEmailSafely = async ({
  email,
  userId,
  userName,
}: {
  email: string;
  userId: string;
  userName: string;
}) => {
  if (!hasMailConfig) {
    return "disabled" as const;
  }

  try {
    await sendVerificationEmail({
      email,
      verificationToken: createVerificationToken(userId),
      userName,
    });
    return "sent" as const;
  } catch (error) {
    console.error("Failed to send verification email", error);
    return "failed" as const;
  }
};

export const createUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      firstName = "",
      lastName = "",
      userName,
      email,
      password,
    } = req.body as {
      firstName?: string;
      lastName?: string;
      userName?: string;
      email?: string;
      password?: string;
    };

    const normalizedEmail = email?.trim().toLowerCase();
    const resolvedUserName = (userName ?? `${firstName} ${lastName}`).trim();

    if (!normalizedEmail || !password || !resolvedUserName) {
      return res.status(400).json({
        success: 0,
        message: "userName or first and last name, email, and password are required",
      });
    }

    const existingUser = await userModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: 0,
        message: "email already in use",
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const registerUser = await userModel.create({
      userName: resolvedUserName,
      email: normalizedEmail,
      password: hashPassword,
    });

    const createProfile = await profileModel.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: "",
      DOB: "",
      avatar: "",
      user: registerUser._id,
    });

    registerUser.profile = createProfile._id;
    await registerUser.save();

    const verificationEmailStatus = await sendVerificationEmailSafely({
      email: normalizedEmail,
      userId: registerUser._id.toString(),
      userName: resolvedUserName,
    });

    return res.status(201).json({
      success: 1,
      message:
        verificationEmailStatus === "sent"
          ? "registration successful, check your email to verify your account"
          : verificationEmailStatus === "failed"
            ? "registration successful, but we could not send the verification email. Try logging in again later to resend it."
            : "registration successful, configure mail delivery and verify the account before login",
      data: {
        user: sanitizeUser(registerUser),
        profile: createProfile,
      },
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "registration failed",
    });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, clientContext } = req.body as {
      email?: string;
      password?: string;
      clientContext?: unknown;
    };

    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: 0,
        message: "email and password are required",
      });
    }

    const checkEmail = await userModel.findOne({ email: normalizedEmail })
      .select("+password")
      .populate("profile");

    if (!checkEmail) {
      return res.status(404).json({
        success: 0,
        message: "user not found",
      });
    }

    const passwordHash = checkEmail.get("password") as string;
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: 0,
        message: "incorrect password",
      });
    }

    if (!checkEmail.get("verify")) {
      const verificationEmailStatus = await sendVerificationEmailSafely({
        email: normalizedEmail,
        userId: checkEmail._id.toString(),
        userName: checkEmail.get("userName") as string,
      });

      return res.status(403).json({
        success: 0,
        message:
          verificationEmailStatus === "sent"
            ? "please verify your account through the email we sent"
            : verificationEmailStatus === "failed"
              ? "your account is not verified yet and we could not resend the verification email. Please try again later."
              : "your account is not verified yet",
      });
    }

    const token = createToken({
      _id: checkEmail._id.toString(),
      userName: checkEmail.get("userName") as string,
      role: checkEmail.get("role") as Express.UserPayload["role"],
    });
    const sessionId = crypto.randomUUID();
    const normalizedClientContext = normalizeClientContext(clientContext);
    const userAgent =
      normalizedClientContext.userAgent?.trim() || String(req.headers["user-agent"] ?? "").trim();
    const platform = normalizedClientContext.platform?.trim() ?? "";
    const decodedToken = jwt.decode(token) as { exp?: number } | null;
    const tokenExpiresAt = typeof decodedToken?.exp === "number"
      ? new Date(decodedToken.exp * 1000)
      : null;
    const trackedSession = await userSessionModel.create({
      sessionId,
      user: checkEmail._id,
      loginAt: new Date(),
      lastSeenAt: new Date(),
      tokenExpiresAt,
      status: normalizedClientContext.visibilityState === "hidden" ? "idle" : "online",
      lastEvent: "login",
      lastPath: normalizedClientContext.path ?? "",
      lastVisibilityState: normalizedClientContext.visibilityState ?? "visible",
      lastOnlineState: normalizedClientContext.online ?? true,
      ipAddress: extractClientIp(req),
      userAgent,
      deviceType: detectDeviceType(userAgent),
      browser: detectBrowser(userAgent),
      os: detectOperatingSystem(userAgent, platform),
      platform,
      language: normalizedClientContext.language ?? "",
      timezone: normalizedClientContext.timezone ?? "",
      referrer: normalizedClientContext.referrer ?? "",
      screen: {
        width: normalizedClientContext.screen?.width ?? 0,
        height: normalizedClientContext.screen?.height ?? 0,
        pixelRatio: normalizedClientContext.screen?.pixelRatio ?? 1,
      },
      utm: {
        source: normalizedClientContext.utm?.source ?? "",
        medium: normalizedClientContext.utm?.medium ?? "",
        campaign: normalizedClientContext.utm?.campaign ?? "",
        term: normalizedClientContext.utm?.term ?? "",
        content: normalizedClientContext.utm?.content ?? "",
      },
    });

    return res.status(200).json({
      success: 1,
      message: "login successful",
      data: {
        token,
        user: sanitizeUser(checkEmail),
        session: buildSessionSnapshot(trackedSession),
      },
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "login failed",
    });
  }
};

export const getSingleUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: 0,
        message: "authentication is required",
      });
    }

    const getSingle = await userModel.findById(userId).populate({
      path: "profile",
      select: "firstName lastName DOB phoneNumber avatar",
    });

    if (!getSingle) {
      return res.status(404).json({
        success: 0,
        message: "user not found",
      });
    }

    return res.status(200).json({
      success: 1,
      message: "single user data",
      data: sanitizeUser(getSingle),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to retrieve this user",
    });
  }
};

export const getAllUsers = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const allUsers = await userModel.find().populate({
      path: "profile",
      select: "firstName lastName DOB phoneNumber avatar",
    });

    return res.status(200).json({
      success: 1,
      message: "all users data",
      data: allUsers.map((user) => sanitizeUser(user)),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to get all users",
    });
  }
};

export const logOut = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: 0,
        message: "authentication is required",
      });
    }

    const { sessionId, clientContext } = req.body as {
      sessionId?: string;
      clientContext?: unknown;
    };

    const normalizedSessionId = String(sessionId ?? "").trim();
    if (!normalizedSessionId) {
      return res.status(400).json({
        success: 0,
        message: "sessionId is required",
      });
    }

    const trackedSession = await userSessionModel.findOne({
      sessionId: normalizedSessionId,
      user: userId,
    });

    if (!trackedSession) {
      return res.status(404).json({
        success: 0,
        message: "session not found",
      });
    }

    const normalizedClientContext = normalizeClientContext(clientContext);
    trackedSession.lastSeenAt = new Date();
    trackedSession.logoutAt = new Date();
    trackedSession.status = "logged_out";
    trackedSession.lastEvent = "logout";
    trackedSession.lastPath = normalizedClientContext.path ?? trackedSession.lastPath;
    trackedSession.lastVisibilityState = normalizedClientContext.visibilityState ?? trackedSession.lastVisibilityState;
    trackedSession.lastOnlineState = normalizedClientContext.online ?? trackedSession.lastOnlineState;
    trackedSession.ipAddress = extractClientIp(req) || trackedSession.ipAddress;
    trackedSession.userAgent = normalizedClientContext.userAgent?.trim() || trackedSession.userAgent;
    trackedSession.platform = normalizedClientContext.platform ?? trackedSession.platform;
    trackedSession.language = normalizedClientContext.language ?? trackedSession.language;
    trackedSession.timezone = normalizedClientContext.timezone ?? trackedSession.timezone;
    trackedSession.referrer = normalizedClientContext.referrer ?? trackedSession.referrer;

    if (normalizedClientContext.screen) {
      trackedSession.screen = {
        width: normalizedClientContext.screen.width ?? trackedSession.screen?.width ?? 0,
        height: normalizedClientContext.screen.height ?? trackedSession.screen?.height ?? 0,
        pixelRatio: normalizedClientContext.screen.pixelRatio ?? trackedSession.screen?.pixelRatio ?? 1,
      };
    }

    if (normalizedClientContext.utm) {
      trackedSession.utm = {
        source: normalizedClientContext.utm.source ?? trackedSession.utm?.source ?? "",
        medium: normalizedClientContext.utm.medium ?? trackedSession.utm?.medium ?? "",
        campaign: normalizedClientContext.utm.campaign ?? trackedSession.utm?.campaign ?? "",
        term: normalizedClientContext.utm.term ?? trackedSession.utm?.term ?? "",
        content: normalizedClientContext.utm.content ?? trackedSession.utm?.content ?? "",
      };
    }

    await trackedSession.save();

    return res.status(200).json({
      success: 1,
      message: "logout successful",
      data: buildSessionSnapshot(trackedSession),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "logout failed",
    });
  }
};

export const verifyUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const verificationToken = String(req.params.id ?? "").trim();

    if (!verificationToken) {
      return res.status(400).json({
        success: 0,
        message: "verification token is required",
      });
    }

    let payload: VerificationTokenPayload;

    try {
      const decodedToken = jwt.verify(verificationToken, env.jwtSecret()) as Partial<VerificationTokenPayload>;

      if (decodedToken.purpose !== "verify-account" || !decodedToken.userId) {
        return res.status(400).json({
          success: 0,
          message: "verification link is invalid or has expired",
        });
      }

      payload = {
        purpose: "verify-account",
        userId: decodedToken.userId,
      };
    } catch {
      return res.status(400).json({
        success: 0,
        message: "verification link is invalid or has expired",
      });
    }

    const verifyData = await userModel.findByIdAndUpdate(
      payload.userId,
      { verify: true },
      { new: true },
    );

    if (!verifyData) {
      return res.status(404).json({
        success: 0,
        message: "user not found",
      });
    }

    return res.status(200).json({
      success: 1,
      message: "account has been verified, proceed to login",
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "account verification failed",
    });
  }
};
