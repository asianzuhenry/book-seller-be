import express from "express";
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  uploadBookVideo,
  deleteBookVideo
} from "../controllers/book.controller";
import { authenticate } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = express.Router();

router.get("/", getAllBooks);
router.get("/:id", getBookById);
router.post(
  "/", authenticate,
  upload.fields([
  { name: "pdf",   maxCount: 1 },
  { name: "video", maxCount: 1 },
]),
  createBook
);
router.put("/:id", authenticate, updateBook);
router.delete("/:id", authenticate, deleteBook);

router.patch("/:id/video", upload.fields([{ name: "video", maxCount: 1 }]), uploadBookVideo);
router.delete("/:id/video", deleteBookVideo);

export default router;
