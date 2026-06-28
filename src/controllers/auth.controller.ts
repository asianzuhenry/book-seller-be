import { Request, Response } from "express";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/jwt";
import { z } from "zod";

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
