import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { cookieOptions, requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: "Too many authentication attempts. Try again in 15 minutes." } });
const publicUser = user => ({ id: user._id, name: user.name, email: user.email, role: user.role });

function issueSession(user, res) {
  const token = jwt.sign(
    { sub: user._id.toString(), name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h", issuer: "brandshield-ai" }
  );
  res.cookie("brandshield_session", token, { ...cookieOptions(), maxAge: 8 * 60 * 60 * 1000 });
}

router.post("/register", authLimiter, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (name.length < 2 || name.length > 80) return res.status(400).json({ success: false, message: "Name must contain 2 to 80 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ success: false, message: "Enter a valid email address." });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: "Password must contain 8 to 128 characters." });
  try {
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ success: false, message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "analyst" });
    issueSession(user, res);
    return res.status(201).json({ success: true, message: "Account created successfully.", user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists." });
    return res.status(500).json({ success: false, message: "Could not create account." });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required." });
  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: "Incorrect email or password." });
    issueSession(user, res);
    return res.json({ success: true, message: "Login successful.", user: publicUser(user) });
  } catch {
    return res.status(500).json({ success: false, message: "Could not log in right now." });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("brandshield_session", cookieOptions());
  res.json({ success: true, message: "Logged out successfully." });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      res.clearCookie("brandshield_session", cookieOptions());
      return res.status(401).json({ success: false, message: "Account not found. Please log in again." });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch {
    return res.status(500).json({ success: false, message: "Could not verify your session." });
  }
});

router.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 }).lean();
  res.json({ success: true, users });
});

export default router;
