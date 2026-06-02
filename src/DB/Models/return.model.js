import { model, Schema } from "mongoose";

/**
 * Shopify return as received on `returns/request` webhook.
 * `shopifyPayload` holds the full JSON body Shopify sends.
 */
const returnSchema = new Schema(
    {
        shopifyReturnId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        shopifyOrderId: {
            type: String,
            required: true,
            index: true,
        },
        shopifyPayload: {
            type: Schema.Types.Mixed,
            required: true,
        },
    },
    {
        timestamps: true,
        virtuals: true,
        toJSON: { virtuals: true, getters: true },
        toObject: { virtuals: true, getters: true },
    },
);

const returnModel = model("return", returnSchema);

export default returnModel;
