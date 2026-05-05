import { model, Schema } from "mongoose";
import { decrypt, encrypt, hash } from "../../utils/security/crypto.util.js";
import { providers, UserGenders, UserRoles } from "../../utils/enums/user.enum.js";

const userSchema = new Schema({
    name: {
        type: String,
        requried: true,
        minLength: [3, 'name must be at least 3 characters long'],
        maxLength: [50, 'name must be at most 50 character long']
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: (val) => {
                return val.endsWith('@gmail.com') || val.endsWith('@yahoo.com') || val.endsWith('@outlook.com')
            },
            message: 'invalid email domain (only gmail, yahoo, and outlook domains are allowed)'
        }
    },
    password: {
        type: String,
        required: function () {
            return this.provider == providers.system
        },
        select: false
    },
    role: {
        type: String,
        enum: Object.values(UserRoles),
        default: UserRoles.user
    },
    gender: {
        type: String,
        enum: Object.values(UserGenders),
        default: UserGenders.male
    },
    phone: {
        type: String,
        set: function (value) {
            return encrypt(value)
        },
        get: function (value) {
            try {
                return decrypt(value);
            } catch {
                return value;
            }
        }
    },
    DOB: Date,
    isVerified: {
        type: Boolean,
        default: false,
        select: false
    },
    otp: {
        type: String,
        select: false,
    },
    otpExpires: {
        type: Date,
        select: false,
    },
    provider: {
        type: String,
        enum: Object.values(providers),
        default: providers.system
    },
    profilePicture: String,
    coverPicture: String,
    gallery: Array,
    views: {
        type: Number,
        select: false,
        default: 0
    },
    changeCredentialsAt: {
        type: Date,
        default: Date.now()
    },
    is2faActivated: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    virtuals: true,
    toJSON: {
        virtuals: true,
        getters: true
    },
    toObject: {
        virtuals: true,
        getters: true
    },
})

const userModel = model('user', userSchema)

export default userModel