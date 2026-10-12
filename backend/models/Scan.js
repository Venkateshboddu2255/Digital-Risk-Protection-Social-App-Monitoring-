import mongoose from "mongoose";

const scanSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
  type: { type: String, enum: ["social", "app"], required: true },
  sourceType: { type: String, enum: ["demo", "custom", "api"], default: "demo" },
  scannedCount: { type: Number, default: 0 },
  excludedOfficialCount: { type: Number, default: 0 },
  newThreatCount: { type: Number, default: 0 },
  completedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["completed", "failed"], default: "completed" },
  message: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("Scan", scanSchema);
