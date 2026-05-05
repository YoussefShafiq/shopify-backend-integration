import Joi from "joi"
import { badRequestException } from "../utils/response/failResponse.js"
import { UserGenders, UserRoles } from "../utils/enums/user.enum.js"

export function validation(schema) {
    return (req, res, next) => {

        const validationErrors = []

        for (const schemaKey of Object.keys(schema)) {
            const validateResult = schema[schemaKey].validate(req[schemaKey], { abortEarly: false })
            if (validateResult.error?.details.length > 0) {
                validationErrors.push(validateResult.error)
            }
            if (schemaKey != 'query') {
                req[schemaKey] = validateResult.value
            } else {
                req['v' + schemaKey] = validateResult.value
            }
        }

        let message = validationErrors.map(v => v.message)

        if (validationErrors.length > 0) {
            badRequestException(message)
        }

        next()
    }
}

export const commonValidation = {
    email: Joi.string().email().messages({
        "any.required": "email is required",
        "string.email": "invalid email"
    }),
    password: Joi.string().min(5),
    otp: Joi.string()
        .pattern(/^[0-9]{6}$/)
        .required()
        .messages({
            "any.required": "OTP is required",
            "string.pattern.base": "OTP must be 6 digits"
        }),
    name: Joi.string().alphanum().min(3).messages({
        "string.alphanum": "name cannot contain special characters"
    }),
    phone: Joi.string().alphanum().max(11),
    DOB: Joi.date(),
    role: Joi.string().valid(...Object.values(UserRoles)).default(UserRoles.user),
    gender: Joi.string().valid(...Object.values(UserGenders)).default(UserGenders.male),
    id: Joi.string(),
}