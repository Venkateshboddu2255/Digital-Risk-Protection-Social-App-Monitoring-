import express from "express";
import mongoose from "mongoose";
import Threat from "../models/Threat.js";
import Brand from "../models/Brand.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.brandId) {
      if (!mongoose.isValidObjectId(req.query.brandId)) return res.status(400).json({ success: false, message: "Invalid brandId." });
      filter.brandId = req.query.brandId;
    }
    if (["social", "app"].includes(req.query.type)) filter.type = req.query.type;
    if (["Low", "Medium", "High", "Critical"].includes(req.query.riskLevel)) filter.riskLevel = req.query.riskLevel;
    if (["New", "Under Review", "Resolved", "Dismissed"].includes(req.query.status)) filter.status = req.query.status;
    const threats = await Threat.find(filter).populate("brandId", "name").sort({ riskScore: -1, updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, threats });
  } catch {
    res.status(500).json({ success: false, message: "Could not load threats." });
  }
});

router.patch("/:id/status", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid threat ID." });
  const allowed = ["New", "Under Review", "Resolved", "Dismissed"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ success: false, message: "Invalid status." });
  try {
    const threat = await Threat.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!threat) return res.status(404).json({ success: false, message: "Threat not found." });
    res.json({ success: true, threat });
  } catch {
    res.status(500).json({ success: false, message: "Could not update threat status." });
  }
});

export default router;
