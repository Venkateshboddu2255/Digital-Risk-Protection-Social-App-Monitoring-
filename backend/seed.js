import mongoose from "mongoose";
import dotenv from "dotenv";
import Brand from "./models/Brand.js";

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/brandshield");

  // --- Social Media Demo ---
  const existingSocial = await Brand.findOne({ name: "Social Media Demo" });
  if (existingSocial) {
    console.log(`Demo brand already exists: ${existingSocial._id}`);
  } else {
    const socialBrand = await Brand.create({
      name: "Social Media Demo",
      website: "https://example.com",
      keywords: ["socialmedia", "socialmedia support", "socialmedia rewards"],
      officialSocialAccounts: [
        {
          platform: "Twitter",
          profileUrl: "https://demo.example/social/socialmedia-official",
          accountId: "demo-socialmedia-social-id"
        }
      ],
      officialApps: [
        {
          appName: "SocialMedia Demo",
          packageId: "demo.socialmedia.official",
          publisher: "SocialMedia Demo Publisher",
          storeUrl: "https://demo.example/apps/socialmedia-official"
        }
      ]
    });
    console.log(`Created demo brand: ${socialBrand._id}`);
  }

  // --- OttApps Demo ---
  const existingOtt = await Brand.findOne({ name: "OttApps Demo" });
  if (existingOtt) {
    console.log(`Demo brand already exists: ${existingOtt._id}`);
  } else {
    const ottBrand = await Brand.create({
      name: "OttApps Demo",
      website: "https://example.com",
      keywords: ["ottapps", "ottapps support", "ottapps rewards"],
      officialSocialAccounts: [
        {
          platform: "Netflix",
          profileUrl: "https://demo.example/social/ottapps-official",
          accountId: "demo-ottapps-social-id"
        }
      ],
      officialApps: [
        {
          appName: "OttApps Demo",
          packageId: "demo.ottapps.official",
          publisher: "OttApps Demo Publisher",
          storeUrl: "https://demo.example/apps/ottapps-official"
        }
      ]
    });
    const brand = await Brand.create({
      name: "FakeProfile & CyberSafety",
      website: "https://example.com",
      keywords: [
        "fakeprofile",
        "cyberbully",
        "harassment",
        "online abuse",
        "fake rewards"
      ],
      officialSocialAccounts: [
        {
          platform: "Instagram",
          profileUrl: "https://demo.example/social/fakeprofile-official",
          accountId: "demo-fakeprofile-social-id"
        }
      ],
      officialApps: [
        {
          appName: "Threatdetect App",
          packageId: "demo.fakeprofile.official",
          publisher: "FakeProfile Demo Publisher",
          storeUrl: "https://demo.example/apps/fakeprofile-official"
        }
      ]
    });
    console.log(`Created demo brand: ${ottBrand._id}`);
  }

  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});

















