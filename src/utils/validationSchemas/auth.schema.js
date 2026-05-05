import Joi from 'joi'
import { UserGenders, UserRoles } from '../enums/user.enum.js'
import { commonValidation } from '../../Middlewares/validation.middleware.js'

export const signupSchema = {
    body: Joi.object({
        name: Joi.string().alphanum().required().min(3).messages({
            "string.alphanum": "name cannot contain special characters"
        }),
        email: commonValidation.email.required(),
        password: commonValidation.password,
        phone: commonValidation.phone.required(),
        DOB: commonValidation.DOB.required(),
        role: commonValidation.role.required(),
        gender: commonValidation.gender,
    }).required()
}

export const loginSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
        password: commonValidation.password.required(),
    }).required()
}

export const loginWith2faSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
        otp: commonValidation.otp.required(),
    }).required()
}

export const signupWithGoogleSchema = {
    body: Joi.object({
        idToken: Joi.string().required(),
    }).required()
}

export const verifyOtpSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
        otp: commonValidation.otp.required(),
    }).required()
}

export const resendOtpSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
    }).required()
}

export const forgetPasswordSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
    }).required()
}

export const resendResetPasswordOtpSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
    }).required()
}

export const verifyResetPasswordOtpSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
        otp: commonValidation.otp.required(),
    }).required()
}

export const resetPasswordSchema = {
    body: Joi.object({
        email: commonValidation.email.required(),
        password: commonValidation.password.required(),
        otp: commonValidation.otp.required(),
    }).required()
}