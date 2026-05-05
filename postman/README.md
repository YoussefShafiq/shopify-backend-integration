## Postman collection for this backend

This folder contains:

- `Shopify Integration Backend.postman_collection.json`: requests you can import into Postman
- `Shopify Integration Backend.postman_environment.json`: local dev environment template

## Import

In Postman:

- **Import** → select the collection JSON
- **Import** → select the environment JSON
- Select environment **“Shopify Integration Backend (Local Dev)”**

## Variables you must set

Open the environment and set:

- **`baseUrl`**: `http://localhost:3300` (or your server URL)
- **`shopifyWebhookSecret`**: set to the same value as `SHOPIFY_WEBHOOK_SECRET` in `configs/.env.dev`
- **`skipHmac`**: `false` (default). Set to `true` if you want to bypass signing in Postman (see dev bypass below).

## Shopify `orders/create` webhook requests

Endpoint:

- `POST {{baseUrl}}/shopify/webhook/orders/create`

### Signed request (recommended)

Use **“Orders Create Webhook (signed HMAC)”**.

It automatically computes header `X-Shopify-Hmac-Sha256` as:

- Base64(HMAC-SHA256(raw JSON body, `shopifyWebhookSecret`))

Important: the signature is calculated on the **exact raw body string**. If you change whitespace/formatting in the raw JSON, the signature changes too.

### Dev bypass request (no HMAC)

If you want to test quickly without computing the signature:

1. In `configs/.env.dev` set:

```env
SKIP_SHOPIFY_WEBHOOK_HMAC=1
```

2. Restart backend (`npm run start:dev`).
3. Use **“Orders Create Webhook (dev bypass - no HMAC)”** or set environment variable `skipHmac=true` for the signed request.

This bypass only works when `NODE_ENV=dev`.

## What happens when you call `orders/create`

From `src/Modules/Shopify/shopify.controller.js`:

- The backend validates the webhook signature (unless dev bypass).
- It **upserts** the order into MongoDB collection **`orders`**:
  - `shopifyOrderId` = `String(body.id)`
  - `shopifyPayload` = full JSON body
- Then it triggers fulfillment-order processing (`getFulfillmentByOrderId(id)`), which calls Shopify Admin API.

## Supplier → Backend → Shopify Admin requests

Folder **“Supplier → Backend → Shopify Admin”** contains endpoints under:

- `POST {{baseUrl}}/supplier/webhook/shopify/...`

These require Shopify Admin configuration in your backend `.env`:

- `SHOPIFY_API_URL`
- `SHOPIFY_ACCESS_TOKEN`

