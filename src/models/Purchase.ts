// models/Purchase.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type PurchaseStatus = "pending" | "completed" | "failed";

export interface IPurchase extends Document {
  book: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  currency: string;
  merchantReference: string;
  orderTrackingId?: string;
  status: PurchaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    book: {
      type: Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "UGX",
    },
    merchantReference: {
      type: String,
      required: true,
      unique: true,
    },
    orderTrackingId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// A user should only ever have one completed purchase per book.
purchaseSchema.index({ book: 1, user: 1 }, { unique: false });

export default mongoose.model<IPurchase>("Purchase", purchaseSchema);