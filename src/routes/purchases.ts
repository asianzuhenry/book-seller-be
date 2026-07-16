// routes/purchases.ts
import { Router, RequestHandler } from "express";
import { getMyPurchases, checkBookAccess } from "../controllers/purchaseController";
import { protect } from "../middleware/auth";

const router = Router();

router.get("/my-books", protect as RequestHandler, getMyPurchases as RequestHandler);
router.get("/check/:bookId", protect as RequestHandler, checkBookAccess as RequestHandler);

export default router;