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
import { listShopifyLocations } from "../Shopify/shopifyAdmin.service.js";
import supplierModel from "../../DB/Models/supplier.model.js";
import { find } from "../../DB/Repository/get.repo.js";

const supplierShopifyWebhookRouter = Router();

/**
 * Supplier systems call these routes to push changes into Shopify.
 *
 * TODO: Add authentication (shared secret / JWT / IP allowlist) before production.
 */

/** Proxies Shopify `GET /locations.json` — use `id` as `locationId` for inventory/set or for `configuration.shopifyAdminLocationId`. */
supplierShopifyWebhookRouter.get("/shopify/locations", async (req, res, next) => {
    try {
        const locations = await listShopifyLocations();
        successResponse({
            res,
            data: { locations },
            message: "Shopify locations",
            statusCode: 200,
        });
    } catch (err) {
        next(err);
    }
});

supplierShopifyWebhookRouter.get("/shopify/suppliers", async (req, res, next) => {
    try {
        const suppliers = await find(supplierModel);
        successResponse({ res, data: { suppliers }, message: "Suppliers", statusCode: 200 });
    } catch (err) {
        next(err);
    }
});

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/create",
    validation(createProductSchema),
    async (req, res, next) => {
        try {
            console.log("product create webhook received", req.body);
            successResponse({ res, ...(await onSupplierProductCreate(req.body)) });
        } catch (err) {
            next(err);
        }
    }
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/update",
    validation(updateProductSchema),
    async (req, res, next) => {
        try {
            console.log("product update webhook received", req.body);
            successResponse({ res, ...(await onSupplierProductUpdate(req.body)) });
        } catch (err) {
            next(err);
        }
    }
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/product/delete",
    validation(deleteProductSchema),
    async (req, res, next) => {
        try {
            console.log("product delete webhook received", req.body);
            successResponse({ res, ...(await onSupplierProductDelete(req.body)) });
        } catch (err) {
            next(err);
        }
    }
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/inventory/set",
    // validation(setInventorySchema),
    async (req, res, next) => {
        // {
        //     locationId: '777777',
        //     inventoryItemId: '52',
        //     available: 5,
        //     quantityBasis: 'free_qty',
        //     sku: null,
        //     odoo_product_id: 52,
        //     supplier_code: 'clouds-tex-001'
        //   }
        try {
            console.log("inventory set webhook received", req.body);
            successResponse({ res, ...(await onSupplierInventorySet(req.body)) });
        } catch (err) {
            next(err);
        }
    }
);

supplierShopifyWebhookRouter.post(
    "/webhook/shopify/fulfillment/create",
    validation(createFulfillmentSchema),
    async (req, res, next) => {
        try {
            successResponse({ res, ...(await onSupplierFulfillmentCreate(req.body)) });
        } catch (err) {
            next(err);
        }
    }
);

export default supplierShopifyWebhookRouter;
