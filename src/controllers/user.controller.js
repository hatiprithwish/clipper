import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const registerUser = asyncHandler(async (req, res) => {
  //S1: get user details from frontend
  const { username, email, fullName, password } = req.body;

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
    throw new ApiError(
      400,
      "Something went wrong while uploading avatar to cloudinary"
    );
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
  //find newly created user and remove password & refreshToken from it as they are unnecessary to send to frontend
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

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.save({ validateBeforeSave: false }); // to make sure only refreshToken field of User model is updated

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

export const loginUser = asyncHandler(async (req, res) => {
  // req body -> user data
  // username or email
  // find the user
  // password check
  // access & refresh token
  // send cookie

  const { email, username, password } = req.body;

  if (!username) {
    throw new ApiError(400, "Username or email required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invaild user credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user._id).select(
    "-password, -refreshToken"
  ); // to get the updated user (with refresh token)

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("Access Token", accessToken, options)
    .cookie("Refresh Token", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          // sending it again in response so that user can save this information
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

export const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user,
    { $set: { refreshToken: undefined } },
    { new: true } // to get the new value in return
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("Access Token", options)
    .clearCookie("Refresh Token", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

// Refresh tokens are used to verify users without email & password
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies["Refresh Token"] || req.body["Refresh Token"];

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token not found");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "No such user found");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { newAccessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);
    console.log(newAccessToken, newRefreshToken);
    return res
      .status(200)
      .cookie("Access Token", newAccessToken, options)
      .cookie("Refresh Token", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
          "Tokens refreshed successfullyy"
        )
      );
  } catch (error) {
    throw new ApiError(401, error.message || "Can't refresh tokens");
  }
});

export const upatePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  // console.log(req.body, oldPassword, newPassword);

  const user = await User.findById(req.user?._id);
  console.log(user);
  const isOldPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isOldPasswordValid) {
    throw new ApiError(401, "Old Password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Fetched current user successfully"));
});

export const updateUserDetails = asyncHandler(async (req, res) => {
  const { email, fullName, username } = req.body;
  // console.log(req.body, email, fullName, username);

  const existingUsernameOrEmail = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUsernameOrEmail) {
    throw new ApiError(401, "Username or email already exists");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email,
        fullName: fullName,
        username,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //TODO: delete old image - assignment

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

export const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage) {
    throw new ApiError(500, "Failed to upload coverImage to cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  // TODO: Create a util function to delete temp files and use it here, and updateUserAvatar and registerUser

  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage url updated successfully"));
});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params; //coming from url
  console.log(username);

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers", //use $ before fields
        },
        subscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            //is user exists in subscribers, returns true otherwise false
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true, //saves "true" in isSubscribed field if above condition is true
            else: false, //saves "false" in isSubscribed field if above condition is false
          },
        },
      },
    },
    {
      //projection of how many fields you want (bcz professionals don't congestate data)
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  console.log(channel);

  if (channel?.length === 0) {
    throw new ApiError(404, "Channel doesn't exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "Channel Data fetched successfully")
    );
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id), // req.user._id is a string, not exactly mongoDB objectId. because we are using mongoose, it's taking care of it. But aggregation pipelines work directly with MongoDB hence we need to convert it into mongoDB objectId. That's why we are doing new mongoose ...
      },
    },
    {
      $lookup: {
        // get video ids from videos
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              // getting owner id of each video
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  // getting only neccessary values of owner from user model
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              // to make owner an object instead of keeping it an array
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Fetched watch history successfully"
      )
    );
});
