// routes/payments.ts
import { Router } from "express";
import {
  initializePayment,
  getPaymentStatus,
  handleIPN,
  handlePesapalIPNAlt,
} from "../controllers/paymentController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/initialize", protect, initializePayment);
router.get("/status/:paymentTrackingId", protect, getPaymentStatus);
router.get("/ipn", handleIPN);
router.get("/PesapalIPN", handlePesapalIPNAlt);

export default router;