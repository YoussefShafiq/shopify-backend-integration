import { model, Schema } from "mongoose";
import { supplierTypes } from "../../utils/enums/supplier.enum.js";

const supplierSchema = new Schema({
    shopify_location_id: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: Object.values(supplierTypes),
        required: true
    },
    configuration: {
        type: Object,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    name: {
        type: String
    },
    email: {
        type: String
    },
    phone: {
        type: String
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

const supplierModel = model('supplier', supplierSchema)

export default supplierModel