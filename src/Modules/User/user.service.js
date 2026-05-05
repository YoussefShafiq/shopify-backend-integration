import { rmSync } from "node:fs"
import userModel from "../../DB/Models/user.model.js"
import { deleteOne } from "../../DB/Repository/delete.repo.js"
import { find, findById, findOne } from "../../DB/Repository/get.repo.js"
import { findByIdAndUpdate } from "../../DB/Repository/update.repo.js"
import { changeDir } from "../../utils/Multer/multer.config.js"
import { badRequestException, conflictException, notFoundException } from "../../utils/response/failResponse.js"
import { createTokens } from "../../utils/security/token.util.js"
import path from "node:path";
import { UserRoles } from "../../utils/enums/user.enum.js"
import bcrypt from 'bcryptjs'
import { hash } from "../../utils/security/crypto.util.js"
import { set } from "../../DB/Repository/redis.repo.js"
import { blockedToken } from "../../DB/redis.keys.js"

export function refreshToken(user, decodedToken) {
    const { accessToken } = createTokens(user, decodedToken, { withoutRefreshToken: true })

    return { accessToken }
}

export async function updateUser(id, body) {
    const { name, email, phone, DOB } = body
    if (email) {
        const exsistingUser = await findOne(userModel, { email })
        if (exsistingUser && exsistingUser._id.toString() !== id) {
            conflictException('email already exists')
        }
    }

    const updatedUser = await findByIdAndUpdate(userModel, id, {
        name, email, phone, DOB
    }, { new: true })

    return updatedUser
}

export async function deleteUser(_id) {
    const deletedUser = await deleteOne(userModel, { _id })

    if (deletedUser.deletedCount === 0) {
        notFoundException('user not found')
    }

    return deletedUser
}

export async function getProfile(id) {
    const user = await findById(userModel, id)

    return user
}

export async function getUserById(id, role) {
    await findByIdAndUpdate(userModel, id, { $inc: { views: 1 } })

    const newUser = await findById(userModel, id, `${role == UserRoles.admin ? '+views' : ''}`)

    return newUser
}

export async function getAllUsers() {
    const users = await find(userModel, {}, '')
    return users
}

export async function uploadProfilePicture(profilePicture, id) {
    const user = await findById(userModel, id)

    let movedOldGalleryPath
    if (user?.profilePicture) {
        movedOldGalleryPath = `/uploads/gallery/${path.basename(user.profilePicture)}`
        changeDir(user.profilePicture, 'uploads/gallery')
    }

    const update = { profilePicture }
    if (movedOldGalleryPath) {
        update.$push = { gallery: movedOldGalleryPath }
    }

    const updatedUser = await findByIdAndUpdate(userModel, id, update, { new: true })
    return updatedUser
}

export async function uploadCoverPicture(coverPicture, id) {
    const user = await findById(userModel, id)

    let movedOldGalleryPath
    if (user?.coverPicture) {
        movedOldGalleryPath = `/uploads/gallery/${path.basename(user.coverPicture)}`
        changeDir(user.coverPicture, 'uploads/gallery')
    }

    const update = { coverPicture }
    if (movedOldGalleryPath) {
        update.$push = { gallery: movedOldGalleryPath }
    }

    const updatedUser = await findByIdAndUpdate(userModel, id, update, { new: true })
    return updatedUser
}

export async function deleteProfilePicture(id) {
    const user = await findById(userModel, id)

    const imageResolvedPath = path.resolve('.' + user.profilePicture)
    rmSync(imageResolvedPath)
    const updatedUser = await findByIdAndUpdate(userModel, id, { profilePicture: null }, { new: true })
    return updatedUser
}

export async function deleteCoverPicture(id) {
    const user = await findById(userModel, id)

    const imageResolvedPath = path.resolve('.' + user.coverPicture)
    rmSync(imageResolvedPath)
    const updatedUser = await findByIdAndUpdate(userModel, id, { coverPicture: null }, { new: true })
    return updatedUser
}

export async function changePassword(user, { password, newPassword }) {
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        badRequestException('invalid old password')
    }

    const hashedNewPassword = await hash(newPassword)
    await findByIdAndUpdate(userModel, user._id, { password: hashedNewPassword }, { new: true })
    return
}

export async function logout(user, allDevices = false, decodedToken) {

    if (allDevices) {
        user.changeCredentialsAt = new Date()
        await user.save()
    } else {
        const ttl = decodedToken.iat + 60 * 60 * 24 * 30 * 1000 - Date.now()
        await set(blockedToken(decodedToken.id), 1, ttl)
    }

    return
}

export async function toggle2fa( _id, activate ) {
    await findByIdAndUpdate(userModel, _id, { is2faActivated: activate })
    return
}