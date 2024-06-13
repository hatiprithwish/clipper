import { User } from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  console.log("Cookies: ", req.cookies);
  console.log("Authorization Header: ", req.header("Authorization"));

  try {
    const token =
      req.cookies["Access Token"] ||
      req.header("Authorization")?.replace("Bearer ", ""); // when token is in header

    // console.log(token);

    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    const decodedToken = await jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    ); //problem to hai

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invaild access token");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invaild access token");
  }
});
