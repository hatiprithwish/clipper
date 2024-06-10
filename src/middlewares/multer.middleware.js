import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); // keeps temp file copies in this empty folder
  },
  fileName: function (req, file, cb) {
    cb(null, file.originalName); // TODO: make this fileName unique
  },
});

export const upload = multer({
  storage,
});
