import { ENCRYPTION_SECRET } from "../../../configs/app.config.js";
import CryptoJS from "crypto-js";
import bcrypt from 'bcryptjs'

export const encrypt = (text, key = ENCRYPTION_SECRET) => {
    const ciphertext = CryptoJS.AES.encrypt(text, key).toString();

    return ciphertext;
};

export const decrypt = (encryptedText, key = ENCRYPTION_SECRET) => {
    const bytes = CryptoJS.AES.decrypt(encryptedText, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);

    return originalText;
};

export const hash = async (text, saltRounds = 10) => {
    return await bcrypt.hash(text, saltRounds)
}
