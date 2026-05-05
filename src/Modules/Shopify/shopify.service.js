import { getShopifyAdminClient } from "./shopifyAdmin.service.js";

import { findOne } from "../../DB/Repository/get.repo.js";

import supplierModel from "../../DB/Models/supplier.model.js";

import { notFoundException } from "../../utils/response/failResponse.js";

import { getSupplierHandler } from "../Suppliers/handlers/index.js";



export async function getFulfillmentByOrderId(orderId) {
    const client = getShopifyAdminClient();

    const { data } = await client.get(`/orders/${String(orderId)}/fulfillment_orders.json`);
    // const data = {
    //     "fulfillment_orders": [
    //         {
    //             "id": 1046000804,
    //             "order_id": 450789460,
    //             "status": "open",
    //             "request_status": "unsubmitted",
    //             "assigned_location_id": 'clouds-tex-001',
    //             "destination": {
    //                 "first_name": "John",
    //                 "last_name": "Doe",
    //                 "address1": "12 Abbas El Akkad St",
    //                 "address2": null,
    //                 "city": "Cairo",
    //                 "province": "Cairo",
    //                 "country": "Egypt",
    //                 "zip": "11765",
    //                 "phone": "+20123456789",
    //                 "email": "john@example.com"
    //             },
    //             "line_items": [  
    //                 {
    //                     "id": 'rug-001',
    //                     "sku": 'rug-001',
    //                     "line_item_id": 'rug-001',
    //                     "variant_id": 'rug-001',
    //                     "inventory_item_id": 'rug-001',
    //                     "quantity": 2,
    //                     "fulfillable_quantity": 2
    //                 }
    //             ],
    //             "created_at": "2026-04-21T10:00:00Z",
    //             "updated_at": "2026-04-21T10:00:00Z"
    //         }
    //     ]
    // };


    const fulfillment_orders = data?.fulfillment_orders ?? [];


    /*

    Example of fulfillment_orders:

    {

        "fulfillment_orders": [

            {

            "id": 1046000801,

            "order_id": 450789469,

            "status": "open",

            "request_status": "unsubmitted",

            "assigned_location_id": 24826418,

            "destination": {

                "first_name": "John",

                "last_name": "Doe",

                "address1": "12 Abbas El Akkad St",

                "address2": null,

                "city": "Cairo",

                "province": "Cairo",

                "country": "Egypt",

                "zip": "11765",

                "phone": "+20123456789",

                "email": "john@example.com"

            },

            "line_items": [

                {

                "id": 1072503315,

                "line_item_id": 518995019,

                "variant_id": 49148385,

                "inventory_item_id": 49148385,

                "quantity": 2,

                "fulfillable_quantity": 2

                }

            ],

            "created_at": "2026-04-21T10:00:00Z",

            "updated_at": "2026-04-21T10:00:00Z"

            },

        ]

    }

    */



    await Promise.all(fulfillment_orders.map((fo) => handleFulfillmentOrder(fo)));
}



export async function handleFulfillmentOrder(fo) {

    const { assigned_location_id } = fo;

    const supplier = await findOne(supplierModel, { shopify_location_id: String(assigned_location_id) });

    console.log({ supplier });

    if (!supplier) {

        console.error({

            supplier,

            assigned_location_id,

            fo,

        });

        throw notFoundException("supplier not found for this location");

    }



    const handler = getSupplierHandler(supplier);

    return await handler.createSupplierOrderFromFulfillmentOrder({

        fo,

        supplier,

    });

}

