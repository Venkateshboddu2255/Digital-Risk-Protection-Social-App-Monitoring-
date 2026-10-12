import express from "express";
import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Threat from "../models/Threat.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

function validOptionalUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function validateBrand(body) {
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) return "Brand name is required.";
  if (body.name.trim().length > 100) return "Brand name must be 100 characters or fewer.";
  if (!validOptionalUrl(body.website) || !validOptionalUrl(body.logoUrl)) return "Website and logo URL must use HTTP or HTTPS.";
  if (body.keywords != null && !Array.isArray(body.keywords)) return "Keywords must be an array.";
  if (body.officialSocialAccounts != null && !Array.isArray(body.officialSocialAccounts)) return "Official social accounts must be an array.";
  if (body.officialApps != null && !Array.isArray(body.officialApps)) return "Official apps must be an array.";
  for (const item of body.officialSocialAccounts || []) {
    if (!item.platform?.trim() || !validOptionalUrl(item.profileUrl)) return "Each social account needs a platform and valid HTTP(S) URL.";
  }
  for (const item of body.officialApps || []) {
    if (!item.appName?.trim() || !item.publisher?.trim() || !validOptionalUrl(item.storeUrl)) return "Each official app needs a name, publisher, and valid HTTP(S) store URL.";
  }
  return null;
}

function brandPayload(body) {
  return {
    name: body.name.trim(),
    website: body.website?.trim() || "",
    logoUrl: body.logoUrl?.trim() || "",
    keywords: (body.keywords || []).filter(v => typeof v === "string").map(v => v.trim()).filter(Boolean).slice(0, 100),
    officialSocialAccounts: body.officialSocialAccounts || [],
    officialApps: body.officialApps || []
  };
}

router.get("/", async (_req, res) => {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, brands });
  } catch {
    res.status(500).json({ success: false, message: "Could not load brands." });
  }
});

router.post("/", async (req, res) => {
  const error = validateBrand(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const brand = await Brand.create(brandPayload(req.body));
    res.status(201).json({ success: true, message: "Brand profile created.", brand });
  } catch (err) {
    res.status(400).json({ success: false, message: err.name === "ValidationError" ? "Please check the brand details." : "Could not create brand." });
  }
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid brand ID." });
  const brand = await Brand.findById(req.params.id).lean().catch(() => null);
  if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
  res.json({ success: true, brand });
});

router.put("/:id", requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid brand ID." });
  const error = validateBrand(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, brandPayload(req.body), { new: true, runValidators: true });
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
    res.json({ success: true, brand });
  } catch {
    res.status(400).json({ success: false, message: "Could not update brand." });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid brand ID." });
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });
    await Threat.deleteMany({ brandId: brand._id });
    res.json({ success: true, message: "Brand and its threats deleted." });
  } catch {
    res.status(500).json({ success: false, message: "Could not delete brand." });
  }
});

export default router;
