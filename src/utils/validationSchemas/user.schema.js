import Joi from "joi";
import { commonValidation } from "../../Middlewares/validation.middleware.js";

export const updateUserSchema = {
    // name, email, phone, DOB
    body: Joi.object({
        name: commonValidation.name,
        email: commonValidation.email,
        phone: commonValidation.phone,
        DOB: commonValidation.DOB,
    }).required()
}

export const deleteUserSchema = {
    params: Joi.object({
        id: commonValidation.id.required(),
    }).required()
}

export const toggle2faSchema = {
    body: Joi.object({
        activate: Joi.boolean().required(),
    }).required()
}

export const logoutSchema = {
    body: Joi.object({
        allDevices: Joi.boolean().required(),
    }).required()
}

export const changePasswordSchema = {
    body: Joi.object({
        oldPassword: commonValidation.password.required(),
        newPassword: commonValidation.password.required(),
    }).required()
}