const { MongoClient, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const serviceAccountPath = path.join(__dirname, "src", "config", "firebase-key.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const dbFirestore = admin.firestore();
const mongoClient = new MongoClient(process.env.MONGO_URI);

function convertMongoTypes(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Convert ObjectId -> string
  if (value instanceof ObjectId) {
    return value.toString();
  }

  // Convert Date -> Firestore Timestamp
  if (value instanceof Date) {
    return admin.firestore.Timestamp.fromDate(value);
  }

  // Convert Array recursively
  if (Array.isArray(value)) {
    return value.map((item) => convertMongoTypes(item));
  }

  // Convert Object recursively
  if (typeof value === "object") {
    const converted = {};
    for (const key in value) {
      converted[key] = convertMongoTypes(value[key]);
    }
    return converted;
  }

  return value;
}

async function migrate() {
  try {
    await mongoClient.connect();
    console.log("✅ MongoDB Connected");

    const db = mongoClient.db("dwarpal");

    const collections = ["users", "gatepasses", "notifications"];

    for (const col of collections) {
      console.log(`🚀 Migrating ${col}...`);

      const data = await db.collection(col).find().toArray();

      for (const doc of data) {
        const id = doc._id.toString();
        delete doc._id;

        const cleanedDoc = convertMongoTypes(doc);

        await dbFirestore.collection(col).doc(id).set(cleanedDoc);
      }

      console.log(`✅ ${col} migrated successfully`);
    }

    console.log("🎉 ALL DATA MIGRATED");
  } catch (error) {
    console.error("❌ Migration Error:", error);
  } finally {
    await mongoClient.close();
  }
}

migrate();