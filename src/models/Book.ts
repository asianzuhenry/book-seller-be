import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: String,

    description: String,

    price: Number,

    author: String,

    category: String,

    fileUrl: String,

    fileKey: String,

    creatorId: String,

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Book", bookSchema);