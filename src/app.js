import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//Used for configuration & middlewares
app.use(
  // setup cors
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" })); // to set limit in json data
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // to handle urls properly (especially for spaces)
app.use(express.static("public")); // for storing static files in public folder
app.use(cookieParser()); // to use CRUD ops securely in browser cookies

//import routes
import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";

//routes declaration
app.use("/api/v1/users", userRouter);
app.use("/api/v1/video", videoRouter);

export default app;
