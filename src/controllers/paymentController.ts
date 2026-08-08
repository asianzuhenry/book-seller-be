// controllers/paymentController.ts
import { Response } from "express";
import axios, { AxiosError } from "axios";
import Book from "../models/Book";
import Purchase, { PurchaseStatus } from "../models/Purchase";
import { AuthenticatedRequest } from "../middleware/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InitializePaymentBody {
  bookId: string;
  buyer: {
    email:      string;
    firstName:  string;
    lastName?:  string;
    phone?:     string;
  };
}

interface PesapalTokenResponse       { token: string; }
interface PesapalIPNResponse         { ipn_id: string; }
interface PesapalOrderResponse       { order_tracking_id: string; redirect_url: string; }
interface PesapalTransactionStatusResponse {
  payment_status_description: "Completed" | "Failed" | "Pending" | string;
  amount:   number;
  currency: string;
  [key: string]: unknown;
}

// Content type included in a purchase
type PurchaseContentType = "pdf" | "pdf_and_video";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const trim = (value?: string | null): string | undefined =>
  typeof value === "string" ? value.trim() : undefined;

const normalizeUrl = (value?: string | null): string | undefined =>
  trim(value)?.replace(/\/+$|\s+/g, "");

/** Build a human-readable description for Pesapal based on what the book includes */
const buildOrderDescription = (title: string, hasVideo: boolean): string =>
  hasVideo
    ? `Purchase: ${title} (PDF + Video)`
    : `Purchase: ${title} (PDF)`;

/** Derive content type from book fields */
const getContentType = (videoUrl?: string | null): PurchaseContentType =>
  videoUrl ? "pdf_and_video" : "pdf";

// ---------------------------------------------------------------------------
// Token Cache
// ---------------------------------------------------------------------------

let pesapalToken: string | null = null;
let tokenExpiry:  number | null = null;

const getPesapalToken = async (): Promise<string> => {
  if (pesapalToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log("✅ [Payments] Using cached Pesapal token");
    return pesapalToken;
  }

  const apiUrl         = normalizeUrl(process.env.PESAPAL_API_URL);
  const consumerKey    = trim(process.env.PESAPAL_CONSUMER_KEY);
  const consumerSecret = trim(process.env.PESAPAL_CONSUMER_SECRET);

  if (!apiUrl || !consumerKey || !consumerSecret) {
    throw new Error(
      "Missing Pesapal config: PESAPAL_API_URL, PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET"
    );
  }

  try {
    console.log("🔑 [Payments] Requesting new Pesapal token...");

    const response = await axios.post<PesapalTokenResponse>(
      `${apiUrl}/api/Auth/RequestToken`,
      { consumer_key: consumerKey, consumer_secret: consumerSecret },
      { headers: { "Content-Type": "application/json", Accept: "application/json" } }
    );

    if (response.data?.token) {
      pesapalToken = response.data.token;
      tokenExpiry  = Date.now() + 4 * 60 * 1000; // cache for 4 min
      console.log("✅ [Payments] Pesapal token obtained and cached");
      return pesapalToken;
    }

    throw new Error("Invalid token response: " + JSON.stringify(response.data));
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: { code?: string } }>;
    const detail     = axiosError.response?.data;
    console.error("❌ [Payments] Token error:", detail || axiosError.message);

    let msg = "Failed to authenticate with Pesapal";
    if (detail?.error?.code) msg += `: ${detail.error.code}`;
    throw new Error(msg);
  }
};

const registerIPN = async (token: string): Promise<string | null> => {
  try {
    const apiUrl = normalizeUrl(process.env.PESAPAL_API_URL);
    const ipnUrl =
      normalizeUrl(process.env.IPN_URL) ||
      `http://localhost:${process.env.PORT || 3000}/api/payments/ipn`;

    console.log("📡 [Payments] Registering IPN URL:", ipnUrl);

    const response = await axios.post<PesapalIPNResponse>(
      `${apiUrl}/api/URLSetup/RegisterIPN`,
      { url: ipnUrl, ipn_notification_type: "GET" },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("✅ [Payments] IPN registered:", response.data);
    return response.data.ipn_id || null;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    console.warn(
      "⚠️  [Payments] IPN registration warning:",
      axiosError.response?.data?.message || axiosError.message
    );
    return null;
  }
};

// ---------------------------------------------------------------------------
// POST /api/payments/initialize
// ---------------------------------------------------------------------------
export const initializePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { bookId, buyer } = req.body as InitializePaymentBody;
    const userId = req.user.id;

    if (!bookId) {
      return res.status(400).json({ success: false, message: "bookId is required" });
    }
    if (!buyer?.email || !buyer?.firstName) {
      return res.status(400).json({
        success: false,
        message: "buyer.email and buyer.firstName are required",
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }
    if (book.price == null) {
      return res.status(400).json({ success: false, message: "Book price is not available" });
    }

    // Check if already purchased
    const existing = await Purchase.findOne({
      book:   bookId,
      user:   userId,
      status: "completed" as PurchaseStatus,
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "You already own this book" });
    }

    const orderReference  = `BOOK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const hasVideo        = !!book.videoUrl;
    const contentType     = getContentType(book.videoUrl);
    const orderDescription = buildOrderDescription(book.title as string, hasVideo);

    console.log("📚 [Payments] New purchase request:", {
      book:        book.title,
      contentType,
      amount:      book.price,
      buyer:       buyer.email,
      reference:   orderReference,
    });

    // Create pending purchase — store contentType so we know what was bought
    const purchase = await Purchase.create({
      book:              bookId,
      user:              userId,
      amount:            book.price,
      currency:          "UGX",
      merchantReference: orderReference,
      status:            "pending" as PurchaseStatus,
      contentType,                   // ← "pdf" | "pdf_and_video"
    });

    // ── Mock mode ────────────────────────────────────────────────────────
    if (process.env.MOCK_PAYMENT === "true") {
      console.log("🧪 [Payments] MOCK MODE — skipping Pesapal");

      const mockTrackingId = `MOCK-PAY-${Date.now()}`;
      purchase.orderTrackingId = mockTrackingId;
      await purchase.save();

      const mockRedirectUrl =
        `${process.env.FRONTEND_URL}/payment-success` +
        `?OrderTrackingId=${mockTrackingId}&bookId=${bookId}`;

      return res.status(200).json({
        success: true,
        message: "Payment initialized (MOCK MODE)",
        data: {
          paymentTrackingId: mockTrackingId,
          merchantReference: orderReference,
          redirectUrl:       mockRedirectUrl,
          contentType,
          hasVideo,
        },
      });
    }

    // ── Real Pesapal flow ─────────────────────────────────────────────────
    const token  = await getPesapalToken();
    const ipnId  = await registerIPN(token);
    const apiUrl = normalizeUrl(process.env.PESAPAL_API_URL);

    const orderPayload = {
      id:              orderReference,
      currency:        "UGX",
      amount:          book.price,
      description:     orderDescription,          // ← "PDF" or "PDF + Video"
      callback_url:
        `${normalizeUrl(process.env.PESAPAL_CALLBACK_URL)}` +
        `?bookId=${bookId}&ref=${orderReference}`,
      notification_id: ipnId,
      billing_address: {
        email_address: buyer.email,
        phone_number:  buyer.phone    || "",
        country_code:  "UG",
        first_name:    buyer.firstName,
        middle_name:   "",
        last_name:     buyer.lastName || "",
        line_1: "", line_2: "", city: "", state: "", postal_code: "", zip_code: "",
      },
    };

    console.log("📤 [Payments] Submitting order to Pesapal...", orderReference);

    const response = await axios.post<PesapalOrderResponse>(
      `${apiUrl}/api/Transactions/SubmitOrderRequest`,
      orderPayload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept:          "application/json",
          Authorization:  `Bearer ${token}`,
        },
      }
    );

    if (response.data?.redirect_url && response.data?.order_tracking_id) {
      purchase.orderTrackingId = response.data.order_tracking_id;
      await purchase.save();

      console.log("✅ [Payments] Pesapal order created:", orderReference);

      return res.status(200).json({
        success: true,
        message: "Payment initialized successfully",
        data: {
          paymentTrackingId: response.data.order_tracking_id,
          merchantReference: orderReference,
          redirectUrl:       response.data.redirect_url,
          contentType,       // ← frontend can show "includes video" badge
          hasVideo,
        },
      });
    }

    throw new Error("Unexpected Pesapal response: " + JSON.stringify(response.data));
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: { message?: string }; message?: string }>;
    console.error("❌ [Payments] Initialization error:", axiosError.response?.data || axiosError.message);

    return res.status(500).json({
      success:  false,
      message:  "Failed to initialize payment",
      error:
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Unknown error",
      details: process.env.NODE_ENV === "development" ? axiosError.stack : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/payments/status/:paymentTrackingId
// ---------------------------------------------------------------------------
export const getPaymentStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Not authorized" });
    }

    const { paymentTrackingId } = req.params as { paymentTrackingId: string };
    console.log("🔍 [Payments] Checking status for:", paymentTrackingId);

    // ── Mock mode ────────────────────────────────────────────────────────
    if (process.env.MOCK_PAYMENT === "true" || paymentTrackingId.startsWith("MOCK-PAY-")) {
      console.log("🧪 [Payments] MOCK STATUS — marking completed");

      const purchase = await Purchase.findOneAndUpdate(
        { orderTrackingId: paymentTrackingId },
        { status: "completed" as PurchaseStatus },
        { new: true }
      ).populate("book");

      return res.status(200).json({
        success: true,
        data: {
          order_tracking_id:           paymentTrackingId,
          payment_status_description:  "Completed",
          status:                      200,
          amount:                      purchase?.amount   ?? 0,
          currency:                    "UGX",
          contentType:                 purchase?.contentType ?? "pdf",
          hasVideo:                    purchase?.contentType === "pdf_and_video",
        },
      });
    }

    // ── Real Pesapal status check ─────────────────────────────────────────
    const token  = await getPesapalToken();
    const apiUrl = normalizeUrl(process.env.PESAPAL_API_URL);

    const response = await axios.get<PesapalTransactionStatusResponse>(
      `${apiUrl}/api/Transactions/GetTransactionStatus`,
      {
        params:  { orderTrackingId: paymentTrackingId },
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }
    );

    const description = response.data.payment_status_description;
    console.log("✅ [Payments] Status:", description);

    let purchase = null;

    if (description === "Completed") {
      purchase = await Purchase.findOneAndUpdate(
        { orderTrackingId: paymentTrackingId },
        { status: "completed" as PurchaseStatus },
        { new: true }
      );
    } else if (description === "Failed") {
      purchase = await Purchase.findOneAndUpdate(
        { orderTrackingId: paymentTrackingId },
        { status: "failed" as PurchaseStatus },
        { new: true }
      );
    } else {
      purchase = await Purchase.findOne({ orderTrackingId: paymentTrackingId });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...response.data,
        contentType: purchase?.contentType ?? "pdf",
        hasVideo:    purchase?.contentType === "pdf_and_video",
      },
    });
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error("❌ [Payments] Status check error:", axiosError.response?.data || axiosError.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment status",
      error:   axiosError.message,
    });
  }
};

// ---------------------------------------------------------------------------
// GET /api/payments/ipn
// ---------------------------------------------------------------------------
export const handleIPN = async (req: AuthenticatedRequest, res: Response) => {
  const {
    OrderTrackingId,
    OrderMerchantReference,
    OrderNotificationType,
  } = req.query as {
    OrderTrackingId?:        string;
    OrderMerchantReference?: string;
    OrderNotificationType?:  string;
  };

  console.log("📬 [Payments] IPN received:", {
    orderTrackingId:    OrderTrackingId,
    merchantReference:  OrderMerchantReference,
    notificationType:   OrderNotificationType,
    timestamp:          new Date().toISOString(),
  });

  // Acknowledge Pesapal immediately
  res.status(200).send("IPN received");

  try {
    if (!OrderTrackingId || !OrderMerchantReference) {
      console.warn("⚠️  [Payments] IPN missing tracking id or merchant reference");
      return;
    }

    const token  = await getPesapalToken();
    const apiUrl = normalizeUrl(process.env.PESAPAL_API_URL);

    const statusResponse = await axios.get<PesapalTransactionStatusResponse>(
      `${apiUrl}/api/Transactions/GetTransactionStatus`,
      {
        params:  { orderTrackingId: OrderTrackingId },
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      }
    );

    const description = statusResponse.data.payment_status_description;
    const newStatus: PurchaseStatus =
      description === "Completed" ? "completed" :
      description === "Failed"    ? "failed"    : "pending";

    await Purchase.findOneAndUpdate(
      { merchantReference: OrderMerchantReference },
      { status: newStatus, orderTrackingId: OrderTrackingId }
    );

    console.log(`✅ [Payments] Purchase ${OrderMerchantReference} → ${newStatus}`);
  } catch (error) {
    console.error("❌ [Payments] IPN update failed:", (error as Error).message);
  }
};

// ---------------------------------------------------------------------------
// GET /api/payments/PesapalIPN  (alternate IPN endpoint)
// ---------------------------------------------------------------------------
export const handlePesapalIPNAlt = async (req: AuthenticatedRequest, res: Response) => {
  return handleIPN(req, res);
};