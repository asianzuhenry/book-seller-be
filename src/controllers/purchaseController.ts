// controllers/purchaseController.ts
import { Response } from "express";
import Purchase from "../models/Purchase";
import { AuthenticatedRequest } from "../middleware/auth";

// ---------------------------------------------------------------------------
// GET /api/purchases/my-books
// ---------------------------------------------------------------------------
/**
 * Returns all completed purchases for the logged-in user with book details
 * populated. Each entry also exposes contentType and hasVideo so the
 * frontend library grid can show a "Includes Video" badge without an
 * extra round-trip.
 */
export const getMyPurchases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const purchases = await Purchase.find({
      user:   req.user.id,
      status: "completed",
    })
      .populate("book")
      .sort({ createdAt: -1 });

    // Shape each purchase so the frontend gets a flat, convenient object
    const data = purchases.map((p) => ({
      purchaseId:   p._id,
      purchasedAt:  p.createdAt,
      amount:       p.amount,
      currency:     p.currency,
      contentType:  p.contentType ?? "pdf",
      hasVideo:     p.contentType === "pdf_and_video",
      book:         p.book,  // fully populated Book document
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ [Purchases] Failed to fetch user purchases:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/purchases/check/:bookId
// ---------------------------------------------------------------------------
/**
 * Access gate for the reader page.
 * Returns hasAccess (bool), and if the user owns the book, also tells
 * the frontend whether they have video access — so the player can be
 * shown or hidden without a separate call.
 */
export const checkBookAccess = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { bookId } = req.params as { bookId: string };

    const purchase = await Purchase.findOne({
      user:   req.user.id,
      book:   bookId,
      status: "completed",
    });

    if (!purchase) {
      return res.json({
        success: true,
        data: {
          hasAccess:    false,
          hasVideo:     false,
          contentType:  null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        hasAccess:   true,
        hasVideo:    purchase.contentType === "pdf_and_video",
        contentType: purchase.contentType ?? "pdf",
      },
    });
  } catch (error) {
    console.error("❌ [Purchases] Failed to check book access:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};