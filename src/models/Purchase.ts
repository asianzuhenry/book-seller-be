import { Schema, model, Types } from 'mongoose';

const purchaseSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookId: {
      type: Types.ObjectId,
      ref: 'Book',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default model('Purchase', purchaseSchema);
