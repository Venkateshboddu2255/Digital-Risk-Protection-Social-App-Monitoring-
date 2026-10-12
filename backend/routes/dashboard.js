import express from "express";
import Brand from "../models/Brand.js";
import Threat from "../models/Threat.js";
import Scan from "../models/Scan.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const [brandCount, totalThreats, statusCounts, typeCounts, riskCounts, latestScans] = await Promise.all([
      Brand.countDocuments(),
      Threat.countDocuments(),
      Threat.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Threat.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
      Threat.aggregate([{ $group: { _id: "$riskLevel", count: { $sum: 1 } } }]),
      Scan.find().populate("brandId", "name").sort({ createdAt: -1 }).limit(8).lean()
    ]);
    const toMap = arr => Object.fromEntries(arr.map(x => [x._id, x.count]));
    res.json({
      success: true,
      summary: {
        brandCount,
        totalThreats,
        newThreats: await Threat.countDocuments({ status: "New" }),
        highOrCritical: await Threat.countDocuments({ riskLevel: { $in: ["High", "Critical"] } }),
        resolved: await Threat.countDocuments({ status: "Resolved" }),
        socialThreats: (toMap(typeCounts).social || 0),
        appThreats: (toMap(typeCounts).app || 0),
        statuses: toMap(statusCounts),
        risks: toMap(riskCounts)
      },
      latestScans
    });
  } catch {
    res.status(500).json({ success: false, message: "Could not load dashboard." });
  }
});

export default router;
