import cloudinary from "cloudinary";
import { env, hasCloudinaryConfig } from "../config/env";

const client = cloudinary.v2;

if (hasCloudinaryConfig) {
  client.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
}

export const ensureCloudinaryConfigured = () => {
  if (!hasCloudinaryConfig) {
    throw new Error("Cloudinary configuration is missing");
  }
};

export default client;
