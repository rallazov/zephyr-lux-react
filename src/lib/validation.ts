import { z } from "zod";

// Checkout still validates a single `address` string; structured `Address` lives in `domain/commerce`.
// Follow-up: migrate checkout UI + API to `addressSchema` when cart/checkout hardens (Epic 3 / E1-S3).

export const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  address: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State / region is required"),
  postal_code: z.string().min(3, "Postal code is required"),
  country: z.string().min(2, "Country is required"),
});

export type CheckoutForm = z.infer<typeof checkoutSchema>;


