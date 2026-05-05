import jwt from "jsonwebtoken";
import { getSignature } from "../utils/security/secret.util.js";
import userModel from "../DB/Models/user.model.js";
import { badRequestException, notAuthorizedException } from "../utils/response/failResponse.js";
import { TokenTypes } from "../utils/enums/security.enum.js";
import { findById, findOne } from "../DB/Repository/get.repo.js";
import { blockedToken } from "../DB/redis.keys.js";
import { get } from "../DB/Repository/redis.repo.js";


export function authentication({ refresh, select } = { refresh: false, select: '' }) {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                notAuthorizedException('Unauthorized access, token missing')
            }

            const [authType, token] = authHeader.split(" ");

            if (authType != 'Bearer') {
                notAuthorizedException('Unauthorized access, Invalid token type')
            }

            const decodedToken = jwt.decode(token);
            if (!decodedToken) {
                notAuthorizedException('Unauthorized access, Invalid token')
            }

            const role = decodedToken?.aud;
            const tokenType = decodedToken.type; //access or refresh

            if (refresh && tokenType != TokenTypes.refresh || !refresh && tokenType != TokenTypes.access) {
                notAuthorizedException('Unauthorized access, Invalid token type')
            }

            const { accessSignature, refreshSignature } = getSignature(role)
            const signature = tokenType == TokenTypes.access ? accessSignature : refreshSignature

            const verified = jwt.verify(token, signature);

            const user = await findOne(userModel, { _id: verified.sub }, select)
            if (!user) {
                notAuthorizedException('Unauthorized access, user not found')
            }

            if (user.changeCredentialsAt > new Date(verified.iat * 1000)) {
                notAuthorizedException('You are logged out, login again')
            }

            const isLoggedOut = await get(blockedToken(decodedToken.id))
            if (isLoggedOut) {
                notAuthorizedException('You are logged out, login again')
            }

            req.user = user;
            req.decodedToken = decodedToken;
            return next();
        } catch (err) {
            return next(err);
        }
    }
}