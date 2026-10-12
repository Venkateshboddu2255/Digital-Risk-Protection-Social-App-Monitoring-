import mongoose from "mongoose";

const socialAccountSchema = new mongoose.Schema({
  platform: { type: String, required: true, trim: true },
  profileUrl: { type: String, required: true, trim: true },
  accountId: { type: String, trim: true, default: "" }
}, { _id: false });

const officialAppSchema = new mongoose.Schema({
  appName: { type: String, required: true, trim: true },
  packageId: { type: String, trim: true, default: "" },
  publisher: { type: String, required: true, trim: true },
  storeUrl: { type: String, trim: true, default: "" }
}, { _id: false });

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  website: { type: String, trim: true, default: "" },
  logoUrl: { type: String, trim: true, default: "" },
  keywords: { type: [String], default: [] },
  officialSocialAccounts: { type: [socialAccountSchema], default: [] },
  officialApps: { type: [officialAppSchema], default: [] }
}, { timestamps: true });

export default mongoose.model("Brand", brandSchema);
