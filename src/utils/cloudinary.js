import { v2 as cloudinary } from "cloudinary";
import fs from "fs"; //node.js file system package

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    //upload on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // console.log(
    //   "file has been uploaded on cloudinary successfully",
    //   response.url
    // );
    fs.unlinkSync(localFilePath); //to unlink/delete synchronously

    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // removes the locally saved temp file as the upload op failed
    return null;
  }
};

export { uploadOnCloudinary };
