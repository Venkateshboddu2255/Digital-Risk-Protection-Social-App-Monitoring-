import express from "express";
import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import Threat from "../models/Threat.js";
import Scan from "../models/Scan.js";
import { analyzeCandidate, candidateKey } from "../services/detector.js";
import { socialDemoCandidates, appDemoCandidates } from "../data/demoData.js";

const router = express.Router();

function validateCandidates(candidates) {
  if (!Array.isArray(candidates)) return "Candidates must be an array.";
  if (candidates.length > 500) return "Maximum 500 candidates per scan.";
  for (const c of candidates) {
    if (
      !c ||
      typeof c !== "object" ||
      typeof (c.displayName || c.appName || c.name || c.candidateName) !== "string"
    ) {
      return "Every candidate must include a displayName, appName, name, or candidateName.";
    }
  }
  return null;
}

async function runScan(req, res, type) {
  const { brandId, source = "demo", candidates } = req.body || {};
  if (!mongoose.isValidObjectId(brandId)) {
    return res.status(400).json({ success: false, message: "A valid brandId is required." });
  }
  if (!["demo", "custom"].includes(source)) {
    return res.status(400).json({
      success: false,
      message: "Supported sources are demo and custom. Live sources require a configured approved connector."
    });
  }
  if (source === "custom") {
    const error = validateCandidates(candidates || []);
    if (error) return res.status(400).json({ success: false, message: error });
  }

  const brand = await Brand.findById(brandId);
  if (!brand) return res.status(404).json({ success: false, message: "Brand not found." });

  const list =
    source === "custom"
      ? candidates
      : type === "social"
      ? socialDemoCandidates
      : appDemoCandidates;

  let excludedOfficialCount = 0;
  let newThreatCount = 0;
  const processed = [];

  for (const candidate of list) {
    const analysis = analyzeCandidate(candidate, brand, type);
    if (analysis.isOfficial) {
      excludedOfficialCount++;
      continue;
    }
    const key = candidateKey(candidate, type);
    const displayName =
      candidate.displayName || candidate.appName || candidate.name || candidate.candidateName;
    const doc = {
      brandId: brand._id,
      type,
      candidateName: displayName,
      platform: candidate.platform || (type === "app" ? "App Store listing" : "Social platform"),
      username: candidate.username || "",
      developer: candidate.developer || candidate.publisher || "",
      packageId: candidate.packageId || "",
      sourceUrl: candidate.profileUrl || candidate.storeUrl || candidate.sourceUrl || "",
      description: candidate.description || candidate.bio || "",
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      signals: analysis.signals,
      evidence: analysis.evidence,
      sourceType: source,
      candidateKey: key,
      lastSeenAt: new Date()
    };

    const result = await Threat.findOneAndUpdate(
      { brandId: brand._id, candidateKey: key },
      { $set: doc, $setOnInsert: { status: "New" } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // If timestamps are enabled, detect new threat
    if (result.createdAt && result.updatedAt && result.createdAt.getTime() === result.updatedAt.getTime()) {
      newThreatCount++;
    }
    processed.push(result);
  }

  const scan = await Scan.create({
    brandId: brand._id,
    type,
    sourceType: source,
    scannedCount: list.length,
    excludedOfficialCount,
    newThreatCount,
    status: "completed",
    message: `Processed ${list.length} ${type} candidates.`
  });

  res.json({
    success: true,
    message: `${type === "social" ? "Social" : "App"} scan completed.`,
    scan,
    summary: { scannedCount: list.length, excludedOfficialCount, findings: processed.length, newThreatCount },
    threats: processed
  });
}

router.post("/social", (req, res) =>
  runScan(req, res, "social").catch(err => {
    console.error("Social scan failed:", err.message);
    res.status(500).json({ success: false, message: "Social scan failed." });
  })
);

router.post("/apps", (req, res) =>
  runScan(req, res, "app").catch(err => {
    console.error("App scan failed:", err.message);
    res.status(500).json({ success: false, message: "App scan failed." });
  })
);

export default router;
