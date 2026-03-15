import type { Request, Response } from "express";
import { env, hasCloudinaryConfig } from "../config/env";
import profileModel from "../model/profileModel";
import cloudinary from "../utils/cloudinary";

const canAccessProfile = (req: Request, profileUserId?: string) =>
  req.user?.role === "admin" ||
  req.user?.role === "superadmin" ||
  req.user?._id === profileUserId;

export const updateProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    const existingProfile = await profileModel.findById(req.params.proId);

    if (!existingProfile) {
      return res.status(404).json({
        success: 0,
        message: "profile not found",
      });
    }

    if (!canAccessProfile(req, existingProfile.user?.toString())) {
      return res.status(403).json({
        success: 0,
        message: "you do not have permission to update this profile",
      });
    }

    const { firstName, lastName, phoneNumber, DOB } = req.body as {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      DOB?: string;
    };

    const profileUpdate = await profileModel.findByIdAndUpdate(
      req.params.proId,
      {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phoneNumber !== undefined ? { phoneNumber } : {}),
        ...(DOB !== undefined ? { DOB } : {}),
      },
      {
        new: true,
      },
    );

    return res.status(200).json({
      success: 1,
      message: "profile updated successfully",
      data: profileUpdate,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "profile update failed",
    });
  }
};

export const editImage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const existingProfile = await profileModel.findById(req.params.proId);

    if (!existingProfile) {
      return res.status(404).json({
        success: 0,
        message: "profile not found",
      });
    }

    if (!canAccessProfile(req, existingProfile.user?.toString())) {
      return res.status(403).json({
        success: 0,
        message: "you do not have permission to update this profile image",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "image upload is required",
      });
    }

    let avatarUrl = `${env.appBaseUrl}/uploads/${req.file.filename}`;

    if (hasCloudinaryConfig) {
      const imageUpload = await cloudinary.uploader.upload(req.file.path);
      avatarUrl = imageUpload.secure_url;
    }

    const updateImage = await profileModel.findByIdAndUpdate(
      req.params.proId,
      { avatar: avatarUrl },
      { new: true },
    );

    return res.status(200).json({
      success: 1,
      message: "image successfully updated",
      data: updateImage,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to upload image",
    });
  }
};
