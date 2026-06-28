import { Request, Response } from "express";
import User from "../models/User";
import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required").optional(),
});

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = updateProfileSchema.parse(req.body);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        fullName: validated.fullName,
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: user?._id,
        email: user?.email,
        fullName: user?.fullName,
        role: user?.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};
