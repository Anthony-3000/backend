import { Router } from "express";
import { changePassword, forgotPassword, getMe, login, logout, register, resetPassword } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { validateChangePassword, validateForgotPassword, validateLogin, validateRegister, validateResetPassword } from "../validators/authValidator.js";

const router = Router();

router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/logout", logout);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.patch("/reset-password", validateResetPassword, resetPassword);
router.get("/me", authenticate, getMe);
router.patch("/change-password", authenticate, validateChangePassword, changePassword);

export default router;
