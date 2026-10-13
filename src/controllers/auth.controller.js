import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler, HttpError, requireFields } from "../utils/http.js";

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export const register = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "email", "password"]);
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;
  if (name.length > 80)
    throw new HttpError(400, "Name must be 80 characters or fewer");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, "Enter a valid email address");
  if (password.length < 8)
    throw new HttpError(400, "Password must be at least 8 characters");
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  requireFields(req.body, ["email", "password"]);
  const user = await User.findOne({
    email: req.body.email.trim().toLowerCase(),
  }).select("+passwordHash");
  if (!user) {
    throw new HttpError(
      404,
      "No account found for this email. Create an account to get started.",
    );
  }
  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new HttpError(401, "Email or password is incorrect");
  }
  res.json({ token: createToken(user), user: publicUser(user) });
});

export function logout(_req, res) {
  res.json({ message: "Signed out" });
}

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, "Account no longer exists");
  res.json({ user: publicUser(user) });
});
