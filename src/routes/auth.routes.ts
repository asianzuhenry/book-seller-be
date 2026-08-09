import express from "express";
import { register, login } from "../controllers/auth.controller";
import { forgotPassword, resetPassword } from "../controllers/passwordResetController";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// POST /api/auth/forgot-password  — sends reset email
router.post("/forgot-password", forgotPassword);

// POST /api/auth/reset-password   — validates token + updates password
router.post("/reset-password", resetPassword);


export default router;
