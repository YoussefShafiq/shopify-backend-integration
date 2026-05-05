import { Router } from "express";
import successResponse from "../../utils/response/successResponse.js";
import { forgetPassword, login, loginWith2fa, resendOTP, resendResetPasswordOtp, resetPassword, signup, signupWithGoogle, verifyOtp, verifyResetPasswordOtp } from "./auth.service.js";
import { validation } from "../../Middlewares/validation.middleware.js";
import { forgetPasswordSchema, loginSchema, loginWith2faSchema, resendOtpSchema, resendResetPasswordOtpSchema, resetPasswordSchema, signupSchema, signupWithGoogleSchema, verifyOtpSchema, verifyResetPasswordOtpSchema } from "../../utils/validationSchemas/auth.schema.js";

const authRouter = Router()

authRouter.post('/signup', validation(signupSchema), async (req, res) => {
    const result = await signup(req.body)
    return successResponse({ res, data: result, message: 'check your email for OTP verification', statusCode: 201 })
})

authRouter.post('/signup/gmail', validation(signupWithGoogleSchema), async (req, res) => {
    const { tokens, message, status } = await signupWithGoogle(req.body)
    return successResponse({ res, data: tokens, message, statusCode: status })
})

authRouter.post('/verify-otp', validation(verifyOtpSchema), async (req, res) => {
    const result = await verifyOtp(req.body)
    return successResponse({ res, data: result, message: 'user verified successfully', statusCode: 200 })
})

authRouter.post('/resend-otp', validation(resendOtpSchema), async (req, res) => {
    await resendOTP(req.body)
    return successResponse({ res, message: 'OTP resent successfully', statusCode: 200 })
})

authRouter.post('/login', validation(loginSchema), async (req, res) => {
    const { message, data } = await login(req.body)
    return successResponse({ res, data, message, statusCode: 200 })
})

authRouter.post('/login/2fa', validation(loginWith2faSchema), async (req, res) => {
    const result = await loginWith2fa(req.body)
    return successResponse({ res, data: result, message: 'logged in successfully', statusCode: 200 })
})

authRouter.post('/forget-password', validation(forgetPasswordSchema), async (req, res) => {
    await forgetPassword(req.body)
    return successResponse({ res, message: 'check your email for OTP verification', statusCode: 200 })
})

authRouter.post('/send-reset-password-otp', validation(resendResetPasswordOtpSchema), async (req, res) => {
    await resendResetPasswordOtp(req.body)
    return successResponse({ res, message: 'check your email for OTP verification', statusCode: 200 })
})

authRouter.post('/verify-reset-password-otp', validation(verifyResetPasswordOtpSchema), async (req, res) => {
    await verifyResetPasswordOtp(req.body)
    return successResponse({ res, message: 'OTP verified successfully', statusCode: 200 })
})

authRouter.post('/reset-password', validation(resetPasswordSchema), async (req, res) => {
    await resetPassword(req.body)
    return successResponse({ res, message: 'password reset successfully', statusCode: 200 })
})

export default authRouter