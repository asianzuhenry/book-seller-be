import { Request, Response } from "express";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { z } from "zod";
import crypto from "crypto";

const registerSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const register = async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validated.email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await hashPassword(validated.password);

    const user = await User.create({
      fullName: validated.fullName,
      email: validated.email,
      passwordHash,
    });

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await comparePassword(
      validated.password,
      user.passwordHash
    );

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    const user = await User.findOne({ email });

    if (!user) {
      // don't reveal whether email exists
      return res.json({ message: "If that email is registered, a reset token has been sent" });
    }

    // generate a secure token
    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600_000; // 1 hour
    await user.save();

    // Returns token for development testing (can be sent via email in production)
    return res.json({ message: "If that email is registered, a reset token has been sent", resetToken });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, resetToken, newPassword } = resetPasswordSchema.parse(req.body);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (user.resetPasswordToken !== resetToken) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    if (user.resetPasswordExpires && user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "Reset token has expired" });
    }

    const passwordHash = await hashPassword(newPassword);

    user.passwordHash = passwordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
