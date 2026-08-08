import { Request, Response } from "express";
import { z } from "zod";
import Book from "../models/Book";
import { uploadToR2 } from "../utils/uploadToR2";
import { deleteFromR2 } from "../utils/deleteFromR2";

// ─── Validation schemas ───────────────────────────────────────────────────────
const createBookSchema = z.object({
  title:       z.string().min(3),
  description: z.string().optional(),
  price:       z.coerce.number(),
  userId:      z.string(),
  author:      z.string(),
  category:    z.string(),
  type:        z.enum(["pdf", "video"]) // field to indicate the type of book (pdf or video)
});

const updateBookSchema = createBookSchema.partial();

// ─── Allowed video MIME types ─────────────────────────────────────────────────
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const MAX_VIDEO_SIZE_MB   = 500;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// ─── Helper: validate video file ──────────────────────────────────────────────
const validateVideoFile = (file: Express.Multer.File): string | null => {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return `Invalid video type. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`;
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return `Video exceeds maximum size of ${MAX_VIDEO_SIZE_MB}MB`;
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK CRUD
// ═══════════════════════════════════════════════════════════════════════════════

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getBookById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const book   = await Book.findById(id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    res.json({ success: true, data: book });
    console.log("Book retrieved:", book);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Create book (PDF and video are optional and can be uploaded separately) ─
export const createBook = async (req: Request, res: Response) => {
  try {
    const validated = createBookSchema.parse(req.body);

    const files = req.files as {
      pdf?:   Express.Multer.File[];
      video?: Express.Multer.File[];
    };

    // Validate video if provided
    if (files?.video?.length) {
      const videoError = validateVideoFile(files.video[0]);
      if (videoError) return res.status(400).json({ message: videoError });
    }

    let pdfUpload: { url: string; key: string } | undefined;

    if (files?.pdf?.length) {
      pdfUpload = await uploadToR2(files.pdf[0], "books/pdf");
    }

    // Upload video if provided
    let videoUrl: string | undefined;
    let videoKey: string | undefined;

    if (files?.video?.length) {
      const videoUpload = await uploadToR2(files.video[0], "books/video");
      videoUrl = videoUpload.url;
      videoKey = videoUpload.key;
    }

    console.log(validated);

    const bookPayload: any = {
      title:       validated.title,
      description: validated.description,
      price:       validated.price,
      author:      validated.author,
      creatorId:   validated.userId,
      category:    validated.category,
      type:        validated.type,
      ...(pdfUpload && { fileUrl: pdfUpload.url, fileKey: pdfUpload.key }),
      ...(videoUrl && { videoUrl }),
      ...(videoKey && { videoKey }),
    };

    const book = await Book.create(bookPayload);

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: book,
    });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Update book metadata + optional new PDF or video ────────────────────────
export const updateBook = async (req: Request, res: Response) => {
  try {
    const { id }    = req.params as { id: string };
    const validated = updateBookSchema.parse(req.body);

    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const files = req.files as {
      pdf?:   Express.Multer.File[];
      video?: Express.Multer.File[];
    };

    // Optional PDF replacement
    let newFileUrl = book.fileUrl;
    let newFileKey = book.fileKey;

    if (files?.pdf?.length) {
      // Delete the old PDF from R2 first
      if (book.fileKey) {
        try { await deleteFromR2(book.fileKey); } catch (e) {
          console.error("Failed to delete old PDF from R2:", e);
        }
      }
      const pdfUpload = await uploadToR2(files.pdf[0], "books/pdf");
      newFileUrl = pdfUpload.url;
      newFileKey = pdfUpload.key;
    }

    // Optional video replacement
    let newVideoUrl = book.videoUrl;
    let newVideoKey = book.videoKey;

    if (files?.video?.length) {
      const videoError = validateVideoFile(files.video[0]);
      if (videoError) return res.status(400).json({ message: videoError });

      // Delete the old video from R2 first
      if (book.videoKey) {
        try { await deleteFromR2(book.videoKey); } catch (e) {
          console.error("Failed to delete old video from R2:", e);
        }
      }
      const videoUpload = await uploadToR2(files.video[0], "books/video");
      newVideoUrl = videoUpload.url;
      newVideoKey = videoUpload.key;
    }

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      {
        title:       validated.title       ?? book.title,
        description: validated.description ?? book.description,
        price:       validated.price       ?? book.price,
        author:      validated.author      ?? book.author,
        category:    validated.category    ?? book.category,
        fileUrl:     newFileUrl,
        fileKey:     newFileKey,
        videoUrl:    newVideoUrl,
        videoKey:    newVideoKey,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Book updated successfully",
      data: updatedBook,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Delete book (removes both PDF and video from R2) ────────────────────────
export const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const book   = await Book.findById(id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    // Delete PDF from R2
    if (book.fileKey) {
      try {
        await deleteFromR2(book.fileKey);
      } catch (r2Error) {
        console.error("Failed to delete PDF from R2:", r2Error);
        return res.status(500).json({ message: "Failed to delete PDF from storage" });
      }
    }

    // Delete video from R2 if one exists
    if (book.videoKey) {
      try {
        await deleteFromR2(book.videoKey);
      } catch (r2Error) {
        // Log but don't block — the PDF already deleted; orphaned video is recoverable
        console.error("Failed to delete video from R2:", r2Error);
      }
    }

    await Book.findByIdAndDelete(id);

    res.json({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STANDALONE VIDEO ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Upload / replace video on an existing book ───────────────────────────────
// PATCH /books/:id/video
export const uploadBookVideo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const book   = await Book.findById(id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    const file = (req.files as { video?: Express.Multer.File[] })?.video?.[0]
               ?? (req.file as Express.Multer.File | undefined);

    if (!file) return res.status(400).json({ message: "Video file is required" });

    const videoError = validateVideoFile(file);
    if (videoError) return res.status(400).json({ message: videoError });

    // Delete existing video from R2 before replacing
    if (book.videoKey) {
      try { await deleteFromR2(book.videoKey); } catch (e) {
        console.error("Failed to delete old video:", e);
      }
    }

    const upload = await uploadToR2(file, "books/video");

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      { videoUrl: upload.url, videoKey: upload.key },
      { new: true }
    );

    res.json({
      success: true,
      message: "Video uploaded successfully",
      data: updatedBook,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Remove video from a book without deleting the book ──────────────────────
// DELETE /books/:id/video
export const deleteBookVideo = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const book   = await Book.findById(id);

    if (!book) return res.status(404).json({ message: "Book not found" });

    if (!book.videoKey) {
      return res.status(404).json({ message: "This book has no video attached" });
    }

    await deleteFromR2(book.videoKey);

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      { $unset: { videoUrl: "", videoKey: "" } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Video removed successfully",
      data: updatedBook,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};