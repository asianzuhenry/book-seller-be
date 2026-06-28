import dotenv from "dotenv";
dotenv.config(); // 👈 MUST be first

import express from "express";
import cors from "cors";
import helmet from "helmet";

import connectDB from "./config/mongodb";
import authRoutes from "./routes/auth.routes";
import bookRoutes from "./routes/book.routes";
import userRoutes from "./routes/user.routes";

const app = express();

connectDB();

const allowedOrigins = ["http://localhost:5173", "https://example.com"];

app.use(cors({ origin: allowedOrigins }));
app.use(helmet());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Book Seller API Running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);

export default app;