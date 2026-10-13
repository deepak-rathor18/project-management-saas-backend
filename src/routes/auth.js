import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);

export default router;
