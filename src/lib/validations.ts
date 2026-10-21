import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const tapeSpecificationSchema = z.object({
  code: z
    .string()
    .min(2, "Specification code must be at least 2 characters")
    .max(50, "Specification code too long")
    .regex(/^[A-Za-z0-9-_]+$/, "Code can only contain letters, numbers, hyphens, and underscores"),
  widthMm: z.coerce.number().positive("Width must be greater than 0 mm"),
  filmGsm: z.coerce.number().positive("Film GSM must be greater than 0"),
  dryCoatingGsm: z.coerce.number().positive("Dry coating GSM must be greater than 0"),
  adhesiveSolidsPercent: z.coerce
    .number()
    .gt(0, "Adhesive solids must be greater than 0%")
    .lte(100, "Adhesive solids cannot exceed 100%"),
  rollLengthM: z.coerce.number().positive("Roll length must be greater than 0 metres"),
});

export const materialReceiptSchema = z.object({
  materialType: z.enum(["FILM", "LIQUID_ADHESIVE", "CORE"]),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  notes: z.string().optional().default(""),
});

export const productionBatchSchema = z.object({
  batchNumber: z
    .string()
    .min(3, "Batch number must be at least 3 characters")
    .max(50, "Batch number is too long")
    .regex(/^[A-Za-z0-9-_]+$/, "Batch number can only contain letters, numbers, hyphens, and underscores"),
  specificationId: z.string().min(1, "Tape specification is required"),
  rollCount: z.coerce
    .number()
    .int("Roll count must be a whole integer")
    .positive("Roll count must be at least 1"),
  filmIssuedKg: z.coerce.number().positive("Film issued must be greater than 0 kg"),
  liquidAdhesiveIssuedKg: z.coerce.number().positive("Liquid adhesive issued must be greater than 0 kg"),
  dryWastageKg: z.coerce.number().min(0, "Dry wastage cannot be negative").default(0),
});

export const salesOrderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  specificationId: z.string().min(1, "Tape specification is required"),
  unit: z.enum(["ROLLS", "METRES", "NET_KG"]),
  quantity: z.coerce.number().positive("Quantity must be strictly greater than 0"),
  notes: z.string().optional().default(""),
});

export const dispatchSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  rollCount: z.coerce
    .number()
    .int("Roll count must be a whole integer")
    .positive("Must dispatch at least 1 roll"),
  notes: z.string().optional().default(""),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.string().min(5, "Cancellation reason must be at least 5 characters"),
});

export const adminCorrectionSchema = z.object({
  targetType: z.enum(["MATERIAL_LEDGER", "FINISHED_GOODS_LEDGER", "PRODUCTION_BATCH", "SALES_ORDER"]),
  targetId: z.string().min(1, "Target ID is required"),
  reason: z.string().min(10, "A detailed reason of at least 10 characters is mandatory for audit compliance"),
  correctionAction: z.enum(["ADJUST_STOCK", "VOID_TRANSACTION", "REVISE_NOTES"]),
  adjustmentQuantity: z.coerce.number().optional(),
  materialType: z.enum(["FILM", "LIQUID_ADHESIVE", "CORE"]).optional(),
  specificationId: z.string().optional(),
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  code: z
    .string()
    .min(2, "Customer code must be at least 2 characters")
    .max(30, "Customer code too long"),
  name: z.string().min(2, "Customer name must be at least 2 characters"),
  contactPerson: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
});
