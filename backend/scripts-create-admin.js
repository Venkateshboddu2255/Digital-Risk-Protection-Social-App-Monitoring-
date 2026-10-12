import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!MONGODB_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before creating an admin.");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters long.");
  process.exit(1);
}
try {
  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { name: ADMIN_NAME.trim(), email, passwordHash, role: "admin" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin account ready: ${user.email}`);
} catch (error) {
  console.error("Could not create admin account:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
