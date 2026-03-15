import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Db from "../database/database";
import profileModel from "../model/profileModel";
import type { UserRole } from "../model/userModel";
import userModel from "../model/userModel";

interface SeedAccount {
  role: UserRole;
  userName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

const testAccounts: SeedAccount[] = [
  {
    role: "admin",
    userName: "Test Admin",
    email: "admin.test@melstore.dev",
    password: "Admin123!",
    firstName: "Test",
    lastName: "Admin",
  },
  {
    role: "user",
    userName: "Test User",
    email: "user.test@melstore.dev",
    password: "User123!",
    firstName: "Test",
    lastName: "User",
  },
];

const upsertProfile = async (userId: string, profileId: unknown, account: SeedAccount) => {
  const existingProfile =
    (profileId ? await profileModel.findById(profileId) : null) ?? (await profileModel.findOne({ user: userId }));

  if (existingProfile) {
    existingProfile.firstName = account.firstName;
    existingProfile.lastName = account.lastName;
    existingProfile.set("user", userId);
    await existingProfile.save();
    return existingProfile;
  }

  return profileModel.create({
    firstName: account.firstName,
    lastName: account.lastName,
    phoneNumber: "",
    DOB: "",
    avatar: "",
    user: userId,
  });
};

const upsertVerifiedUser = async (account: SeedAccount) => {
  const hashedPassword = await bcrypt.hash(account.password, 10);
  const existingUser = await userModel.findOne({ email: account.email }).select("+password");

  const user =
    existingUser ??
    (await userModel.create({
      userName: account.userName,
      email: account.email,
      password: hashedPassword,
      role: account.role,
      verify: true,
    }));

  user.userName = account.userName;
  user.email = account.email;
  user.password = hashedPassword;
  user.role = account.role;
  user.verify = true;

  const profile = await upsertProfile(user._id.toString(), user.profile, account);
  user.profile = profile._id;
  await user.save();

  return {
    id: user._id.toString(),
    role: account.role,
    email: account.email,
    password: account.password,
    verified: user.verify,
    profileId: profile._id.toString(),
    status: existingUser ? "updated" : "created",
  };
};

const seedTestUsers = async () => {
  await Db;

  try {
    const results = [];

    for (const account of testAccounts) {
      results.push(await upsertVerifiedUser(account));
    }

    console.table(results);
  } finally {
    await mongoose.disconnect();
  }
};

void seedTestUsers().catch((error) => {
  console.error("Failed to seed verified test users");
  console.error(error);
  void mongoose.disconnect().finally(() => {
    process.exit(1);
  });
});
