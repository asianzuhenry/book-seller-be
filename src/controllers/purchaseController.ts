// controllers/purchaseController.ts
import { Response } from "express";
import Purchase from "../models/Purchase";
import { AuthenticatedRequest } from "../middleware/auth";

// ---------------------------------------------------------------------------
// GET /api/purchases/my-books
// ---------------------------------------------------------------------------
/**
 * Returns all books the logged-in user has successfully purchased,
 * with the book details populated so the frontend can render a library
 * grid without a second round-trip.
 */
export const getMyPurchases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const purchases = await Purchase.find({
      user: req.user.id,
      status: "completed",
    })
      .populate("book")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    console.error("❌ [Purchases] Failed to fetch user purchases:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/purchases/check/:bookId
// ---------------------------------------------------------------------------
/**
 * Lightweight check the reader page can call before loading a PDF:
 * "does this user own this book?" Returns a boolean rather than the
 * full purchase record, since the reader only needs a yes/no gate.
 */
export const checkBookAccess = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { bookId } = req.params as { bookId: string };

    const purchase = await Purchase.findOne({
      user: req.user.id,
      book: bookId,
      status: "completed",
    });

    res.json({
      success: true,
      data: {
        hasAccess: !!purchase,
      },
    });
  } catch (error) {
    console.error("❌ [Purchases] Failed to check book access:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};