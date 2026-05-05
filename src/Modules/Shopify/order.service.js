import orderModel from "../../DB/Models/order.model.js";

/**
 * Insert or replace order document from Shopify `orders/create` webhook body.
 */
export async function upsertShopifyOrderFromWebhook(webhookBody) {
    if (!webhookBody || webhookBody.id == null) {
        throw new Error("upsertShopifyOrderFromWebhook: missing order id");
    }

    const shopifyOrderId = String(webhookBody.id);

    await orderModel.findOneAndUpdate(
        { shopifyOrderId },
        {
            $set: {
                shopifyOrderId,
                shopifyPayload: webhookBody,
            },
        },
        { upsert: true, new: true, runValidators: true }
    );
}
