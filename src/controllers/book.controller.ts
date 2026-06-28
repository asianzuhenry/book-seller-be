import { Request, Response } from "express";
import { z } from "zod";
import Book from "../models/Book";
import { uploadToR2 } from "../utils/uploadToR2";

const createBookSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  price: z.coerce.number(),
  userId: z.string(),
  author: z.string(),
  category: z.string(),
});

const updateBookSchema = createBookSchema.partial();

export const getAllBooks = async (req: Request, res: Response) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: books,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getBookById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({
      success: true,
      data: book,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createBook = async (
  req: Request,
  res: Response
) => {
  try {
    const validated = createBookSchema.parse(req.body);

    const files = req.files as {
      pdf?: Express.Multer.File[];
    };

    if (!files?.pdf?.length) { 
      return res.status(400).json({
        message: "PDF file is required", 
      });
    }

    const pdfUpload = await uploadToR2(files.pdf[0], "books");

    const book = await Book.create({
      title: validated.title,
      description: validated.description,
      price: validated.price,
      author: validated.author,
      creatorId: validated.userId,
      category: validated.category,
      fileUrl: pdfUpload.url,
      fileKey: pdfUpload.key,
    });

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: book,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        errors: error.flatten(),
      });
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
};


export const updateBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const validated = updateBookSchema.parse(req.body);

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const updatedBook = await Book.findByIdAndUpdate(
      id,
      {
        title: validated.title ?? book.title,
        description: validated.description ?? book.description,
        price: validated.price ?? book.price,
        author: validated.author ?? book.author,
        category: validated.category ?? book.category,
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

export const deleteBook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    await Book.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
