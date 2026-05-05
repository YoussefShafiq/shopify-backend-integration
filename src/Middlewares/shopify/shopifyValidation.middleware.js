import crypto from 'crypto'
import {
    NODE_ENV,
    SHOPIFY_WEBHOOK_SECRET,
    SKIP_SHOPIFY_WEBHOOK_HMAC,
} from '../../../configs/app.config.js';
import { notAuthorizedException, unhandledException } from '../../utils/response/failResponse.js';

function toHmacPayload(body) {
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    if (body == null) return Buffer.from('', 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

export function shopifyValidation() {
    return (req, res, next) => {

        if (NODE_ENV == 'dev' && SKIP_SHOPIFY_WEBHOOK_HMAC) {
            console.warn('[shopifyValidation] Skipping webhook HMAC (dev + SKIP_SHOPIFY_WEBHOOK_HMAC)');
            return next();
        }

        const hmacHeader = (req.get('X-Shopify-Hmac-Sha256') ?? '').trim();
        if (!SHOPIFY_WEBHOOK_SECRET) throw unhandledException('Shopify webhook secret is not configured');
        if (!hmacHeader) throw notAuthorizedException('Missing signature');

        if (/^shpat_/i.test(hmacHeader)) {
            throw notAuthorizedException(
                'Invalid signature: X-Shopify-Hmac-Sha256 must be Base64(HMAC-SHA256(raw JSON body, webhook signing secret)) — not your Admin API token (shpat_…). Compute it with SHOPIFY_WEBHOOK_SECRET, or in dev set SKIP_SHOPIFY_WEBHOOK_HMAC=1'
            );
        }

        const payload = toHmacPayload(req.body); // ideally raw Buffer from express.raw for webhook routes

        const generatedHmac = crypto
            .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
            .update(payload)
            .digest('base64');

        const a = Buffer.from(generatedHmac, 'utf8');
        const b = Buffer.from(hmacHeader, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            throw notAuthorizedException(
                'Invalid signature: body bytes or signing secret do not match (use exact raw JSON and SHOPIFY_WEBHOOK_SECRET; Admin token shpat_… is not used here)'
            );
        }

        return next();
    };
}
