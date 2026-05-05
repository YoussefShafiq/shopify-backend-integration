import { Router } from "express";
import successResponse from "../../utils/response/successResponse.js";
import { validation } from "../../Middlewares/validation.middleware.js";
import {
    createProductSchema,
    updateProductSchema,
    deleteProductSchema,
    setInventorySchema,
    createFulfillmentSchema,
} from "./supplierShopifyWebhook.schema.js";
import {
    onSupplierProductCreate,
    onSupplierProductUpdate,
    onSupplierProductDelete,
    onSupplierInventorySet,
    onSupplierFulfillmentCreate,
} from "./supplierShopifyWebhook.service.js";

const supplierShopifyWebhookRouter = Router();

/**
 * Supplier systems call these routes to push changes into Shopify.
 *
 * TODO: Add authentication (shared secret / JWT / IP allowlist) before production.
 */

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/create",
    validation(createProductSchema),
    async (req, res) => successResponse({ res, ...(await onSupplierProductCreate(req.body)) })
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/update",
    validation(updateProductSchema),
    async (req, res) => successResponse({ res, ...(await onSupplierProductUpdate(req.body)) })
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/delete",
    validation(deleteProductSchema),
    async (req, res) => successResponse({ res, ...(await onSupplierProductDelete(req.body)) })
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/inventory/set",
    validation(setInventorySchema),
    async (req, res) => successResponse({ res, ...(await onSupplierInventorySet(req.body)) })
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/fulfillment/create",
    validation(createFulfillmentSchema),
    async (req, res) => successResponse({ res, ...(await onSupplierFulfillmentCreate(req.body)) })
);

export default supplierShopifyWebhookRouter;
