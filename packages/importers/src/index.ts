import { z } from "zod";

export const facilityUploadSchema = z.object({
  facility_id: z.string().min(1),
  name: z.string().min(1),
  facility_type: z.enum(["plant", "dc", "mixing_center", "warehouse", "cross_dock", "customer_dc", "store_cluster"]),
  market: z.string().min(1),
  state: z.enum(["TX", "OK"]),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  business_unit: z.string().min(1)
});

export const skuUploadSchema = z.object({
  sku_id: z.string().min(1),
  name: z.string().min(1),
  business_unit: z.enum(["beverage", "frito_lay"]),
  category: z.string().min(1),
  unit_weight: z.coerce.number().nonnegative(),
  unit_cube: z.coerce.number().nonnegative(),
  shelf_life_days: z.coerce.number().int().positive(),
  case_pack: z.coerce.number().int().positive()
});

export const inventoryUploadSchema = z.object({
  facility_id: z.string().min(1),
  sku_id: z.string().min(1),
  on_hand_units: z.coerce.number().int().nonnegative(),
  safety_stock_units: z.coerce.number().int().nonnegative(),
  reserved_units: z.coerce.number().int().nonnegative(),
  as_of: z.string().datetime()
});

export const shipmentUploadSchema = z.object({
  shipment_id: z.string().min(1),
  business_unit: z.enum(["beverage", "frito_lay"]),
  origin_facility_id: z.string().min(1),
  destination_facility_id: z.string().min(1),
  carrier_id: z.string().min(1),
  mode: z.enum(["truckload", "ltl", "intermodal", "dsd"]),
  status: z.enum(["planned", "tendered", "accepted", "in_transit", "delayed", "delivered", "missed"]),
  planned_departure_at: z.string().datetime(),
  planned_arrival_at: z.string().datetime(),
  current_eta: z.string().datetime()
});

export const orderUploadSchema = z.object({
  order_id: z.string().min(1),
  customer_id: z.string().min(1),
  destination_facility_id: z.string().min(1),
  sku_id: z.string().min(1),
  quantity_units: z.coerce.number().int().positive(),
  requested_delivery_at: z.string().datetime(),
  priority: z.enum(["standard", "key_account", "promotional"]),
  business_unit: z.enum(["beverage", "frito_lay"])
});

export const csvTemplates = {
  facilities:
    "facility_id,name,facility_type,market,state,latitude,longitude,business_unit",
  skus:
    "sku_id,name,business_unit,category,unit_weight,unit_cube,shelf_life_days,case_pack",
  inventory:
    "facility_id,sku_id,on_hand_units,safety_stock_units,reserved_units,as_of",
  shipments:
    "shipment_id,business_unit,origin_facility_id,destination_facility_id,carrier_id,mode,status,planned_departure_at,planned_arrival_at,current_eta",
  orders:
    "order_id,customer_id,destination_facility_id,sku_id,quantity_units,requested_delivery_at,priority,business_unit"
} as const;

export type UploadTableName = keyof typeof csvTemplates;

export function validateRows<T>(rows: unknown[], schema: z.ZodSchema<T>): {
  validRows: T[];
  errors: Array<{ row: number; message: string }>;
} {
  const validRows: T[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  rows.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push(result.data);
    } else {
      errors.push({
        row: index + 1,
        message: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      });
    }
  });

  return { validRows, errors };
}
