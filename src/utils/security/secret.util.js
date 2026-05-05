import { ADMIN_ACCESS_SECRET_KEY, ADMIN_REFRESH_SECRET_KEY, USER_ACCESS_SECRET_KEY, USER_REFRESH_SECRET_KEY } from "../../../configs/app.config.js"
import { UserRoles } from "../enums/user.enum.js"

export function getSignature(role) {

    let accessSignature
    let refreshSignature

    switch (role) {
        case UserRoles.user:
            accessSignature = USER_ACCESS_SECRET_KEY
            refreshSignature = USER_REFRESH_SECRET_KEY
            break;
        case UserRoles.admin:
            accessSignature = ADMIN_ACCESS_SECRET_KEY
            refreshSignature = ADMIN_REFRESH_SECRET_KEY
            break;
    }

    return { accessSignature, refreshSignature }
}