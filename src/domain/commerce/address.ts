import { z } from "zod";

/** Structured shipping / contact address (FR-CHK-002, `shipping_address_json`). */
export const addressSchema = z.object({
  name: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().optional(),
});

export type Address = z.infer<typeof addressSchema>;
