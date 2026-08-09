// models/PasswordResetToken.ts
import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema({
  // Reference to the user who requested the reset
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "User",
    required: true,
  },

  // SHA-256 hash of the raw token sent in the email.
  // We never store the raw token — only its hash.
  tokenHash: {
    type:     String,
    required: true,
  },

  // Token expires 1 hour after creation.
  expiresAt: {
    type:     Date,
    required: true,
  },

  // Whether the token has already been used.
  used: {
    type:    Boolean,
    default: false,
  },
});

// Auto-delete documents once expiresAt has passed (MongoDB TTL index)
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PasswordResetToken", passwordResetTokenSchema);