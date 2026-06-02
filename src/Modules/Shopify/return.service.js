import returnModel from "../../DB/Models/return.model.js";

/**
 * Insert or replace return document from Shopify `returns/request` webhook body.
 */
export async function upsertShopifyReturnFromWebhook(webhookBody) {
    if (!webhookBody || webhookBody.id == null) {
        throw new Error("upsertShopifyReturnFromWebhook: missing return id");
    }
    if (!webhookBody.order?.id) {
        throw new Error("upsertShopifyReturnFromWebhook: missing order id");
    }

    const shopifyReturnId = String(webhookBody.id);
    const shopifyOrderId = String(webhookBody.order.id);

    await returnModel.findOneAndUpdate(
        { shopifyReturnId },
        {
            $set: {
                shopifyReturnId,
                shopifyOrderId,
                shopifyPayload: webhookBody,
            },
        },
        { upsert: true, new: true, runValidators: true },
    );
}
