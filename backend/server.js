import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import { requireAuth } from "./middleware/auth.js";
import brandRoutes from "./routes/brands.js";
import scanRoutes from "./routes/scans.js";
import threatRoutes from "./routes/threats.js";
import dashboardRoutes from "./routes/dashboard.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5001);
const MONGODB_URI = process.env.MONGODB_URI;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

app.get("/", (_req, res) => res.json({ service: "BrandShield AI API", version: "1.0.0", message: "API is running" }));
app.get("/api/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "healthy" : "database_disconnected",
    database: connected ? "connected" : "disconnected",
    service: "BrandShield AI"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/brands", requireAuth, brandRoutes);
app.use("/api/scans", requireAuth, scanRoutes);
app.use("/api/threats", requireAuth, threatRoutes);
app.use("/api/dashboard", requireAuth, dashboardRoutes);

app.use((_req, res) => res.status(404).json({ success: false, message: "Endpoint not found." }));

async function startServer() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy .env.example to .env.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to a random string of at least 32 characters in backend/.env.");
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected successfully");
  app.listen(PORT, () => console.log(`BrandShield AI API running at http://localhost:${PORT}`));
}

startServer().catch(error => {
  console.error("Failed to start BrandShield AI:", error.message);
  process.exit(1);
});
