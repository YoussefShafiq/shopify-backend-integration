import { model, Schema } from "mongoose";

/**
 * Shopify order as received on `orders/create` webhook.
 * `shopifyPayload` holds the full JSON body Shopify sends (line items, customer, addresses, etc.).
 */
const orderSchema = new Schema(
    {
        shopifyOrderId: {
            type: String,
            required: true,
            unique: true,
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
    }
);

const orderModel = model("order", orderSchema);

export default orderModel;
