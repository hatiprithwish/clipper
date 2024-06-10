import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

export const registerUser = asyncHandler(async (req, res) => {
  //S1: get user details from frontend
  const { username, email, fullName, password } = req.body;
  // console.log(username);

  //S2: validation - not empty
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "") // checks if any el is empty
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //S3: check if user already exists - username, email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }], //searches database for existing username or email
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //S4: check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path; //it is what it is
  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //S5: Upload them to cloudinary & check if avatar has been uploaded
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //S6: create user object - entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  //S7: remove password & refresh token field from response
  //find newly created user and remove password & refreshToken from it as they are unnecessary to store in db
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //S8: check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //S9: return res
  return res
    .status(201) // for postman
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
