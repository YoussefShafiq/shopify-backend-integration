import { UserRoles } from "../utils/enums/user.enum.js";
import { notAuthorizedException } from "../utils/response/failResponse.js";

export function authorization(allowedRoles = [UserRoles.user]) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            notAuthorizedException('Unauthorized access, insufficient permissions')
        }
        next();
    }
}