import multer from "multer";
import { randomUUID } from "crypto"
import path from "node:path";
import { mkdir, mkdirSync, readdirSync, readFileSync, renameSync, existsSync } from "node:fs";
import { badRequestException, unhandledException } from "../response/failResponse.js";

export function checkFilesLimit(folderName, limit = 4) {
    return (req, res, next) => {
        try {
            const folderPath = path.resolve('./uploads/' + folderName)
            mkdirSync(folderPath, { recursive: true });
            const items = readdirSync(folderPath)
            if (items.length >= limit) {
                badRequestException('maximum images limit reached')
            }
            else {
                next()
            }

        } catch (error) {
            unhandledException()
        }
    }
}

export default function uploadLocal(folderName) {

    const destination = multer.diskStorage({
        destination: function (req, file, cb) {
            const finalDist = "./uploads/" + folderName
            mkdirSync(finalDist, { recursive: true })
            cb(null, path.resolve(finalDist))
        },
        filename: function (req, file, cb) {
            const fileName = randomUUID() + '_' + file.originalname
            file.finalDist = `/uploads/${folderName}/${fileName}`
            cb(null, fileName)
        }
    })
    return multer({ storage: destination })
}

export function changeDir(oldPath, newDir) {
    const oldPathResolved = path.resolve('.' + oldPath);
    const fileName = path.basename(oldPathResolved);
    const targetDirResolved = path.resolve(newDir);

    mkdirSync(targetDirResolved, { recursive: true });

    if (!existsSync(oldPathResolved)) {
        return false;
    }

    const newPathResolved = path.join(targetDirResolved, fileName);

    renameSync(oldPathResolved, newPathResolved);
    return true;
}