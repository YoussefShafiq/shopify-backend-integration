import { notFoundException } from "../../../utils/response/failResponse.js";
import { supplierTypes } from "../../../utils/enums/supplier.enum.js";
import { OdooSupplierHandler } from "./odoo.handler.js";
export { SupplierHandler } from "./supplierHandler.base.js";

export function getSupplierHandler(supplier) {
    const { type, configuration } = supplier ?? {};

    if (!type) throw notFoundException('supplier type is missing');

    if (type === supplierTypes.odoo) {
        return new OdooSupplierHandler(configuration);
    }

    throw notFoundException('supplier type not supported');
}