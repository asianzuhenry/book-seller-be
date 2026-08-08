import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title:       String,
    description: String,
    price:       Number,
    author:      String,
    category:    String,

    // PDF
    fileUrl: String,
    fileKey: String,

    // Video (optional)
    videoUrl: String,
    videoKey: String,

    creatorId: String,

    type: {
      type: String,
      enum: ["pdf", "video"]
    },

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