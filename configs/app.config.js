import path from "path"
import env from "dotenv"

const paths = {
    dev: path.resolve('./configs/.env.dev'),
    prod: path.resolve('./configs/.env.prod')
}

export const NODE_ENV = process.env.NODE_ENV || 'prod';

env.config({ path: paths[NODE_ENV] });

export const PORT = process.env.PORT || 3300


export const DB_URL = process.env.DB_URL || ''
export const REDIS_URL = process.env.REDIS_URL || ''


export const USER_ACCESS_SECRET_KEY = process.env.USER_ACCESS_SECRET_KEY || ''
export const USER_REFRESH_SECRET_KEY = process.env.USER_REFRESH_SECRET_KEY || ''
export const ADMIN_ACCESS_SECRET_KEY = process.env.ADMIN_ACCESS_SECRET_KEY || ''
export const ADMIN_REFRESH_SECRET_KEY = process.env.ADMIN_REFRESH_SECRET_KEY || ''
export const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || ''


export const EMAIL_USER = process.env.EMAIL_USER || ''
export const EMAIL_PASS = process.env.EMAIL_PASS || ''


export const WEB_CLIENT_ID = process.env.WEB_CLIENT_ID || ''

/**
 * Secret used to verify `X-Shopify-Hmac-Sha256` on webhook bodies (same bytes Shopify signed).
 * This is NOT your Admin API access token (`shpat_...`). In Shopify Admin → Settings → Notifications → Webhooks,
 * or your custom app’s **API secret key** (client secret), depending how the webhook was registered.
 */
export const SHOPIFY_WEBHOOK_SECRET =
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.SHOPIFY_WEBHOOK_SIGNING_SECRET ||
    ''

/** Dev-only: when `NODE_ENV=dev`, skip webhook HMAC if `1` / `true` (Postman without signing). Never enable in prod. */
export const SKIP_SHOPIFY_WEBHOOK_HMAC =
    process.env.SKIP_SHOPIFY_WEBHOOK_HMAC === '1' ||
    process.env.SKIP_SHOPIFY_WEBHOOK_HMAC === 'true'

export const SHOPIFY_API_URL = process.env.SHOPIFY_API_URL || ''
export const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || ''
