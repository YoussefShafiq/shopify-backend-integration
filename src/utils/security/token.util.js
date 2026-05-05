import jwt from "jsonwebtoken";
import { TokenTypes } from "../enums/security.enum.js";
import { getSignature } from "./secret.util.js";
import { randomUUID } from "node:crypto";

export function createTokens(user, decodedToken, { withoutRefreshToken } = { withoutRefreshToken: false }) {
    const { accessSignature, refreshSignature } = getSignature(user.role)

    let accessToken
    let refreshToken
    const tokenId = withoutRefreshToken ? decodedToken.id : randomUUID()

    accessToken = jwt.sign(
        {
            type: TokenTypes.access,
            id: tokenId
        },
        accessSignature,
        {
            expiresIn: '15m',
            audience: user.role,
            subject: user._id.toString()
        }
    )

    !withoutRefreshToken && (
        refreshToken = jwt.sign(
            {
                type: TokenTypes.refresh,
                id: tokenId
            },
            refreshSignature,
            {
                expiresIn: '30d',
                audience: user.role,
                subject: user._id.toString()
            }
        )
    )

    return {
        accessToken,
        refreshToken
    }
}