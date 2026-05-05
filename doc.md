Here is documentation of what the project implements **as of now**, based on the current codebase.

---

## 1. Purpose at a glance

The backend sits between **Shopify**, **your suppliers** (e.g. Odoo), and **your app**:

| Direction | What happens |
|-----------|----------------|
| **Shopify → this API** | Order-created webhook: load fulfillment orders, resolve supplier by location, forward to supplier handler. |
| **Supplier → this API → Shopify** | HTTP endpoints suppliers call to create/update/delete products, set inventory, create fulfillments in Shopify via Admin API. |
| **This API → Shopify Admin** | Authenticated REST calls (`shopifyAdmin.service.js`) using access token + shop URL. |

Supplier **handlers** (`SupplierHandler`, Odoo) are used only for **Shopify → supplier** (fulfillment orders). Supplier **→ Shopify** product/inventory/fulfillment routes do **not** use those handlers; they are generic and call Shopify Admin directly.

---

## 2. Configuration (`configs/app.config.js`)

Environment is loaded from `configs/.env.dev` or `configs/.env.prod` depending on `NODE_ENV`.

Relevant variables:

| Variable | Role |
|----------|------|
| `PORT` | Server port (default `3300`). |
| `SHOPIFY_WEBHOOK_SECRET` | HMAC verification for **incoming Shopify** webhooks. |
| `SHOPIFY_API_URL` | Shop Admin API base (e.g. `https://your-shop.myshopify.com`). |
| `SHOPIFY_ACCESS_TOKEN` | Private app / custom app Admin API token. |

Also present for the rest of the app: `DB_URL`, `REDIS_URL`, JWT/email/Google keys, etc.

---

## 3. Application bootstrap (`src/app.bootstrap.js`)

- Connects to MongoDB and Redis.
- Registers middleware: `express.json()`, `cors`, `helmet`.
- **Important:** For `/shopify`, `express.raw({ type: 'application/json' })` is registered **before** `express.json()` so Shopify’s signed raw body can be verified (see webhooks).
- Mounts:
  - `/shopify` → Shopify router (incoming Shopify webhooks).
  - `/supplier` → supplier → Shopify router.
  - `/auth`, `/user`, `/uploads` as existing.

---

## 4. Incoming Shopify webhook (Shopify → backend)

**Route:** `POST /shopify/webhook/orders/create`

**Files:** `shopify.controller.js`, `shopify.service.js`, `validation.schema.js`, middlewares under `Middlewares/shopify/`.

**Flow:**

1. **`shopifyValidation()`** — Compares `X-Shopify-Hmac-Sha256` to HMAC-SHA256 of the **raw** body using `SHOPIFY_WEBHOOK_SECRET`. Uses `crypto.timingSafeEqual`.
2. **`parseBody`** — Parses raw buffer to JSON and sets `req.body`.
3. **`validation(orderWebhookSchema)`** — Body must include `id` (string), treated as Shopify **order id**.
4. Handler calls **`getFulfillmentByOrderId(id)`** **without awaiting** in the response path; errors are logged. Response is always **`200`** with `{ message: 'Webhook received' }` so Shopify does not retry unnecessarily while work continues async.

**`getFulfillmentByOrderId` (`shopify.service.js`):**

- Uses **`getShopifyAdminClient()`** → `GET /admin/api/2024-01/orders/{orderId}/fulfillment_orders.json`.
- For each fulfillment order, runs **`handleFulfillmentOrder(fo)`**:
  - Reads `assigned_location_id`.
  - **`findOne(supplierModel, { shopify_location_id: String(assigned_location_id) })`**.
  - If no supplier → throws `notFoundException('supplier not found for this location')` (logged in webhook `.catch()`).
  - **`getSupplierHandler(supplier)`** → **`handler.createSupplierOrderFromFulfillmentOrder({ fo, supplier })`**.

**API version:** Admin client uses **`2024-01`** (`shopifyAdmin.service.js`).

---

## 5. Shopify Admin client (`shopifyAdmin.service.js`)

Shared Axios client:

- Base URL: `{SHOPIFY_API_URL}/admin/api/2024-01`
- Header: `X-Shopify-Access-Token: SHOPIFY_ACCESS_TOKEN`

**Exported helpers:**

| Function | Shopify REST usage |
|----------|-------------------|
| `createShopifyProduct(product)` | `POST /products.json` |
| `updateShopifyProduct(productId, product)` | `PUT /products/{id}.json` |
| `deleteShopifyProduct(productId)` | `DELETE /products/{id}.json`; treats **404** as success with `{ deleted: true, notFound: true }` for idempotent deletes |
| `setShopifyInventoryLevel({ locationId, inventoryItemId, available })` | `POST /inventory_levels/set.json` |
| `createShopifyFulfillmentForFulfillmentOrder({ ... })` | `POST /fulfillments.json` with `line_items_by_fulfillment_order`, tracking, etc. |

Also exported: `getShopifyAdminBaseUrl()`, `getShopifyAdminClient()` (used by `shopify.service.js` for fulfillment orders).

---

## 6. Supplier → Shopify HTTP API (`/supplier/...`)

**Router:** `supplierShopifyWebhook.controller.js`  
**Orchestration:** `supplierShopifyWebhook.service.js`  
**Validation:** `supplierShopifyWebhook.schema.js` (Joi; shared `shopifyResourceId` for string or number ids)

**Security:** Documented **TODO** — routes are **not** authenticated yet (no shared secret/JWT/IP allowlist).

All successful responses use **`successResponse`**: `{ success: true, message, data }` with appropriate HTTP status.

| Method & path | Body (validated) | Service handler | Typical status |
|---------------|------------------|-----------------|----------------|
| `POST /supplier/webhook/shopify/product/create` | `{ product }` — arbitrary object (Shopify product REST shape) | `onSupplierProductCreate` | 201 |
| `POST /supplier/webhook/shopify/product/update` | `{ productId, product }` | `onSupplierProductUpdate` | 200 |
| `POST /supplier/webhook/shopify/product/delete` | `{ productId }` | `onSupplierProductDelete` | 200 |
| `POST /supplier/webhook/shopify/inventory/set` | `{ locationId, inventoryItemId, available }` | `onSupplierInventorySet` | 200 |
| `POST /supplier/webhook/shopify/fulfillment/create` | `fulfillmentOrderId`, `fulfillmentOrderLineItems[]` (`id`, `quantity`), `tracking` (`number`, optional `company`, `url`), optional `notifyCustomer`, `message` | `onSupplierFulfillmentCreate` | 201 |

**Fulfillment note:** Line item `id` values must be **fulfillment order line item** ids, not order line item ids (as documented in `shopifyAdmin.service.js`).

---

## 7. Supplier model & handlers (Mongo → Shopify FO → supplier)

**Model:** `src/DB/Models/supplier.model.js`

- `shopify_location_id` (string, required, unique) — matches FO `assigned_location_id`.
- `type` — enum from `supplierTypes` (`odoo` only today).
- `configuration` — opaque object (e.g. Odoo `baseUrl`, `apiKey`).
- `isActive`, `isDeleted`, optional `name`, `email`, `phone`.

**Enum:** `src/utils/enums/supplier.enum.js` — `supplierTypes.odoo`.

**Factory:** `getSupplierHandler(supplier)` in `handlers/index.js`:

- `odoo` → `OdooSupplierHandler(configuration)`.
- Anything else → `notFoundException('supplier type not supported')`.

**Base:** `supplierHandler.base.js` — abstract `createSupplierOrderFromFulfillmentOrder({ fo, supplier })`.

**Odoo:** `odoo.handler.js`:

- Requires `configuration.baseUrl`; if `apiKey` missing, logs warning and returns `{ skipped: true }`.
- Otherwise `POST {baseUrl}/orders` with Bearer token, payload including Shopify FO id, order id, destination, line items.

---

## 8. Data flow diagram (conceptual)

```mermaid
flowchart LR
  subgraph shopify_in [Shopify]
    SW[orders/create webhook]
    SA[Admin API]
  end
  subgraph api [This backend]
    SC[shopify.controller]
    SS[shopify.service]
    SH[getSupplierHandler]
    SUP_R[/supplier routes]
    SVC[supplierShopifyWebhook.service]
    ADMIN[shopifyAdmin.service]
  end
  subgraph external [Suppliers]
    Odoo[Odoo API]
  end
  SW --> SC --> SS --> SA
  SS --> SH --> Odoo
  SUP_R --> SVC --> ADMIN --> SA
```

---

## 9. Explicit gaps / not implemented (from code comments & structure)

- **Supplier webhook routes:** no auth, rate limiting, or per-supplier routing yet.
- **Product sync:** not split per supplier type via handlers; one generic Shopify Admin path for all callers.
- **Odoo handler:** placeholder behavior without `apiKey`; endpoint/path may need to match your real Odoo integration.
- **Bootstrap:** catch-all route uses `app.all('*d', ...)` which looks like a typo (`'*'` vs `'*d'`); worth verifying intended behavior.

---

## 10. Related npm dependency

- `@shopify/shopify-api` is in `package.json`; the paths described above primarily use **Axios + REST** for Admin API and webhooks, not necessarily the full Shopify API library surface.

---

If you want this saved as a repo doc (e.g. `docs/INTEGRATION.md`), say where you want it and we can add it as a file.