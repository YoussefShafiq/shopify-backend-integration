export function userFailLoginAttempts(email) {
    return `user:fail:login:attempts:${email}`
}

export function userLoginBlocked(email) {
    return `user:login:blocked:${email}`
}

export function userResetPasswordOtp(email) {
    return `user:reset:password:otp:${email}`
}

export function blockedToken(tokenId) {
    return `blocked:token:${tokenId}`
}

export function forgetPasswordOtpAttempts(email) {
    return `forget:password:otp:attempts:${email}`
}

export function forgetPasswordOtpBlocked(email) {
    return `forget:password:otp:blocked:${email}`
}

export function user2faOtp(email) {
    return `user:2fa:otp:${email}`
}