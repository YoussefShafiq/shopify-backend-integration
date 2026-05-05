import userModel from "../../DB/Models/user.model.js"
import { encrypt, hash } from "../../utils/security/crypto.util.js";
import { badRequestException, conflictException, notFoundException } from "../../utils/response/failResponse.js"
import bcrypt, { compare } from 'bcryptjs'
import jwt from "jsonwebtoken";
import { getSignature } from "../../utils/security/secret.util.js";
import { generateOTP } from "../../utils/security/genOtp.util.js";
import { sendEmail } from "../../utils/email/sendEmail.util.js";
import { find, findById, findOne } from "../../DB/Repository/get.repo.js";
import { createTokens } from "../../utils/security/token.util.js";
import { OAuth2Client } from "google-auth-library";
import { WEB_CLIENT_ID } from "../../../configs/app.config.js";
import { providers } from "../../utils/enums/user.enum.js";
import { signupSchema } from "../../utils/validationSchemas/auth.schema.js";
import { del, get, incr, set, ttl } from "../../DB/Repository/redis.repo.js";
import { forgetPasswordOtpAttempts, forgetPasswordOtpBlocked, user2faOtp, userFailLoginAttempts, userLoginBlocked, userResetPasswordOtp } from "../../DB/redis.keys.js";
import { findByIdAndUpdate } from "../../DB/Repository/update.repo.js";

export async function signup(body) {
    const { name, email, password, phone, DOB, role, gender } = body

    const exsistingUser = await findOne(userModel, { email }, '+password')

    if (exsistingUser) {
        conflictException('email already exists')
    }

    const hashedPassword = await hash(password)

    const otp = generateOTP()

    await sendEmail(email, otp)
    const newUser = await userModel.create({
        name, email, password: hashedPassword, phone, DOB, role, gender, otp, otpExpires: Date.now() + 5 * 60 * 1000
    })

    return newUser
}

export async function verifyOtp(body) {
    const { email, otp } = body

    const exsistingUser = await findOne(userModel, { email }, '+otp +otpExpires +isVerified')

    if (!exsistingUser) {
        notFoundException('email not found')
    }

    if (exsistingUser.otp != otp) {
        badRequestException('invalid OTP')
    }

    if (exsistingUser.otpExpires < Date.now()) {
        badRequestException('OTP expired')
    }

    exsistingUser.isVerified = true
    exsistingUser.otp = null
    exsistingUser.otpExpires = null

    await exsistingUser.save()
    return exsistingUser
}

export async function resendOTP(body) {
    const { email } = body

    const exsistingUser = await findOne(userModel, { email }, '+otp +otpExpires +isVerified')

    if (!exsistingUser) {
        notFoundException('email not found, please sign up first')
    }

    const otp = generateOTP()

    await sendEmail(email, otp)
    exsistingUser.otp = otp
    exsistingUser.otpExpires = Date.now() + 5 * 60 * 1000
    await exsistingUser.save()

    return exsistingUser
}

export async function login(body) {
    const { email, password } = body

    const isLoginBlocked = await ttl(userLoginBlocked(email))
    if (isLoginBlocked !== -2 && isLoginBlocked !== -1) {
        badRequestException(`login blocked, please try again in ${Math.ceil(isLoginBlocked / 60)} minutes`)
    }

    const user = await findOne(userModel, { email }, '+password +isVerified')
    if (!user) {
        notFoundException('invalid credentials')
    }

    if (!user.isVerified) {
        badRequestException('Please verify your email first')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        const incrementedFailLoginAttempts = await incr(userFailLoginAttempts(email))
        if (incrementedFailLoginAttempts > 4) {
            await set(userLoginBlocked(email), 1, 60 * 5)
            await del(userFailLoginAttempts(email))
        }
        notFoundException('invalid credentials')
    }

    if (user.is2faActivated) {
        const otp = generateOTP()
        await sendEmail(email, otp, '2FA OTP')
        await set(user2faOtp(email), await hash(otp), 2 * 60)
        return {
            message: '2fa OTP sent to your email'
        }
    } else {
        const tokens = createTokens(user)
        return { data: tokens, message: 'logged in successfully' }
    }

}

export async function loginWith2fa({ email, otp }) {
    const existingUser = await findOne(userModel, { email }, '+is2faActivated')
    if (!existingUser) {
        notFoundException('user not found')
    }

    if (!existingUser.is2faActivated) {
        badRequestException('2fa is not activated')
    }

    const hashedOtp = await get(user2faOtp(email))
    if (!hashedOtp) {
        badRequestException('invalid OTP')
    }

    const isOtpValid = await bcrypt.compare(otp, hashedOtp)
    if (!isOtpValid) {
        badRequestException('invalid OTP')
    }

    await del(user2faOtp(email))
    const tokens = createTokens(existingUser)
    return tokens

}

export async function verifyGoogleToken(idToken) {
    const client = new OAuth2Client();

    const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: WEB_CLIENT_ID,
    });

    return ticket.getPayload()
}

export async function signupWithGoogle(body) {
    const { idToken } = body
    const payload = await verifyGoogleToken(idToken)

    if (!payload.email_verified) {
        badRequestException('email not verified by google')
    }

    let user = await findOne(userModel, { email: payload.email })

    if (user) {
        if (user.provider != providers.google) {
            badRequestException('account already exist, login with your credentials')
        }
        const tokens = createTokens(user)
        return {
            tokens,
            message: 'logged in with google successfully',
            status: 200
        }
    }

    const newUser = await userModel.create({
        name: payload.name, email: payload.email, provider: providers.google, profilePicture: payload.picture
    })

    const tokens = createTokens(newUser)

    return {
        tokens,
        message: 'signed up with google successfully',
        status: 201
    }

}

export async function forgetPassword({ email }) {
    const existingUser = await findOne(userModel, { email }, '+isVerified')
    if (!existingUser || !existingUser.isVerified) {
        notFoundException('user not found or not verified')
    }

    await sendOtpCheck({ email })

    return
}

export async function resendResetPasswordOtp({ email }) {
    const existingUser = await findOne(userModel, { email }, '+isVerified')
    if (!existingUser || !existingUser.isVerified) {
        notFoundException('user not found or not verified')
    }

    await sendOtpCheck({ email })

    return
}

async function sendOtpCheck({ email }) {
    // check if reset password OTP is already sent
    const existingResetPasswordOtp = await get(userResetPasswordOtp(email))
    if (existingResetPasswordOtp) {
        badRequestException('reset password OTP already sent, please check your email')
    }

    // check if forget password OTP is blocked
    const isForgetPasswordOtpBlocked = await ttl(forgetPasswordOtpBlocked(email))
    if (isForgetPasswordOtpBlocked !== -2 && isForgetPasswordOtpBlocked !== -1) {
        badRequestException(`forget password OTP blocked, please try again in ${Math.ceil(isForgetPasswordOtpBlocked / 60)} minutes`)
    }

    const otp = generateOTP()

    // check if forget password OTP attempts are exceeded
    const otpAttemptCount = Number(await get(forgetPasswordOtpAttempts(email))) || 0
    if (otpAttemptCount > 4) {
        await set(forgetPasswordOtpBlocked(email), 1, 60 * 10)
    } else {
        await set(forgetPasswordOtpAttempts(email), otpAttemptCount + 1, 5 * 60)
    }

    await sendEmail(email, otp, 'Reset Your Password')

    await set(userResetPasswordOtp(email), await hash(otp), 2 * 60)
}

async function verifyResetPasswordOtpService({ email, otp }) {
    const hashedOtp = await get(userResetPasswordOtp(email))
    if (!hashedOtp) {
        badRequestException('invalid OTP')
    }

    const isOtpValid = await bcrypt.compare(otp, hashedOtp)

    if (!isOtpValid) {
        badRequestException('invalid OTP')
    }
}

export async function verifyResetPasswordOtp({ email, otp }) {
    await verifyResetPasswordOtpService({ email, otp })

    return
}

export async function resetPassword({ email, password, otp }) {
    const existingUser = await findOne(userModel, { email }, '+isVerified')

    if (!existingUser || !existingUser.isVerified) {
        notFoundException('user not found or not verified')
    }

    await verifyResetPasswordOtpService({ email, otp })

    const hashedPassword = await hash(password)
    existingUser.password = hashedPassword
    await existingUser.save()

    return
}
