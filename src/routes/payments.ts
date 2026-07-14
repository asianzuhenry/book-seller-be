// routes/payments.ts
import { Router, Response, Request, RequestHandler } from "express";
import axios, { AxiosError } from "axios";
import Book from "../models/Book";
import Purchase, { PurchaseStatus } from "../models/Purchase";
import { protect } from "../middleware/auth";

const router = Router();

// ... (trim, normalizeUrl, getPesapalToken, registerIPN — unchanged from before)

interface InitializePaymentBody {
  bookId: string;
  buyer: {
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
  };
}

export const initializePayment = async (req: Request, res: Response) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { bookId, buyer } = req.body as InitializePaymentBody;
    const userId = req.user._id;

    if (!bookId) {
      return res.status(400).json({ success: false, message: "bookId is required" });
    }

    if (!buyer || !buyer.email || !buyer.firstName) {
      return res.status(400).json({
        success: false,
        message: "buyer.email and buyer.firstName are required",
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    const existing = await Purchase.findOne({
      book: bookId,
      user: userId,
      status: "completed" as PurchaseStatus,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You already own this book",
      });
    }

    const orderReference = `BOOK-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;

    const purchase = await Purchase.create({
      book: bookId,
      user: userId,
      amount: book.price,
      currency: "UGX",
      merchantReference: orderReference,
      status: "pending" as PurchaseStatus,
    });

    // ... rest identical to before (mock mode, Pesapal submission, etc.)
    // just replace every `buyer.userId` reference — there isn't one anymore,
    // since `userId` now comes from req.user.id above.

  } catch (error) {
    // ... unchanged
  }
};

// Placeholder handlers to satisfy route typings and to be implemented elsewhere in this file
export const getPaymentStatus = async (req: Request, res: Response) => {
  return res.status(501).json({ success: false, message: "Not implemented" });
};

export const handleIPN = async (req: Request, res: Response) => {
  return res.status(204).send();
};

export const handlePesapalIPNAlt = async (req: Request, res: Response) => {
  return res.status(204).send();
};

// Apply auth middleware on the routes that need identity
// protect has a custom request type; cast to RequestHandler to satisfy express overloads
router.post("/initialize", protect as unknown as RequestHandler, initializePayment);
router.get("/status/:paymentTrackingId", protect as unknown as RequestHandler, getPaymentStatus);
router.get("/ipn", handleIPN);           // Pesapal calls this — no user auth applies
router.get("/PesapalIPN", handlePesapalIPNAlt);

export default router;