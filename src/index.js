import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000); // listen on port 8000 in production if not specified
  })
  .catch((error) => console.error("MongoDB connection failed:", error));
