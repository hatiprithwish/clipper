import { Router } from "express";
import {
  getUserChannelProfile,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  upatePassword,
  updateUserAvatar,
  updateUserCoverImage,
  updateUserDetails,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar", //the name should be same in frontend form field
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

//secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/forgot-password").post(verifyJWT, upatePassword);
router.route("/update-account-details").post(verifyJWT, updateUserDetails);
router
  .route("/update-user-avatar")
  .post(upload.fields([{ name: "avatar", maxCount: 1 }]), updateUserAvatar);
router
  .route("/update-user-coverImage")
  .post(
    upload.fields([{ name: "coverImage", maxCount: 1 }]),
    updateUserCoverImage
  );
router.route("/:username").post(getUserChannelProfile);

export default router;
