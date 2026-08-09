// controllers/passwordResetController.ts
import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User";
import PasswordResetToken from "../models/PasswordResetToken";
import { sendMail } from "../utils/mailer";
import { passwordResetEmail } from "../utils/emailTemplates";

const ONE_HOUR_MS = 60 * 60 * 1000;

/** SHA-256 hash a raw token string */
const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password
// Body: { email: string }
// ---------------------------------------------------------------------------
/**
 * 1. Look up the user by email.
 * 2. Delete any existing (unused) reset tokens for that user.
 * 3. Generate a secure random token, store its hash, send the raw token by email.
 *
 * Always responds with 200 — we never reveal whether the email exists
 * to prevent user enumeration attacks.
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Always return 200 — don't leak whether the email exists
    if (!user) {
      console.log(`[PasswordReset] No account found for ${email} — responding 200 anyway`);
      return res.status(200).json({
        success: true,
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    // Invalidate any existing unused tokens for this user
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Generate a cryptographically secure 32-byte random token
    const rawToken  = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    await PasswordResetToken.create({
      userId:    user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    });

    // Build the reset URL — the raw token goes in the URL, not the hash
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await sendMail({
      to:      user.email,
      subject: "Reset your EduBooks password",
      html:    passwordResetEmail(resetUrl),
    });

    console.log(`✅ [PasswordReset] Reset email sent to ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    console.error("❌ [PasswordReset] forgotPassword error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password
// Body: { token: string, password: string, confirm: string }
// ---------------------------------------------------------------------------
/**
 * 1. Hash the incoming raw token and look it up in the DB.
 * 2. Verify it hasn't expired or been used.
 * 3. Hash the new password and update the user.
 * 4. Mark the token as used (belt-and-suspenders on top of TTL deletion).
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password, confirm } = req.body as {
    token?:    string;
    password?: string;
    confirm?:  string;
  };

  if (!token || !password || !confirm) {
    return res.status(400).json({
      success: false,
      message: "Token, password, and confirm are all required.",
    });
  }

  if (password !== confirm) {
    return res.status(400).json({ success: false, message: "Passwords do not match." });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters.",
    });
  }

  try {
    const tokenHash   = hashToken(token);
    const resetRecord = await PasswordResetToken.findOne({ tokenHash, used: false });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has already been used.",
      });
    }

    if (resetRecord.expiresAt < new Date()) {
      await PasswordResetToken.deleteOne({ _id: resetRecord._id });
      return res.status(400).json({
        success: false,
        message: "This reset link has expired. Please request a new one.",
      });
    }

    // Fetch the user document so we can call .save()
    const user = await User.findById(resetRecord.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // User model stores the hash in `passwordHash` (no pre-save hook)
    // so we hash manually before saving.
    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();

    // Mark token as used so it can't be replayed before TTL removes it
    await PasswordResetToken.findByIdAndUpdate(resetRecord._id, { used: true });

    console.log(`✅ [PasswordReset] Password updated for user ${resetRecord.userId}`);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("❌ [PasswordReset] resetPassword error:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};