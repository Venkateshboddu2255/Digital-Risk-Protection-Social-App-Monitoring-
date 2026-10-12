import mongoose from "mongoose";

const threatSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
  type: { type: String, enum: ["social", "app"], required: true, index: true },
  candidateName: { type: String, required: true, trim: true },
  platform: { type: String, default: "" },
  username: { type: String, default: "" },
  developer: { type: String, default: "" },
  packageId: { type: String, default: "" },
  sourceUrl: { type: String, default: "" },
  description: { type: String, default: "" },
  riskScore: { type: Number, min: 0, max: 100, required: true, index: true },
  riskLevel: { type: String, enum: ["Low", "Medium", "High", "Critical"], required: true },
  signals: { type: [String], default: [] },
  evidence: { type: [String], default: [] },
  status: { type: String, enum: ["New", "Under Review", "Resolved", "Dismissed"], default: "New", index: true },
  sourceType: { type: String, enum: ["demo", "custom", "api"], default: "demo" },
  candidateKey: { type: String, required: true },
  lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

threatSchema.index({ brandId: 1, candidateKey: 1 }, { unique: true });

export default mongoose.model("Threat", threatSchema);
