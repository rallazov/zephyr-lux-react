import { z } from "zod";

export const checkoutSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  address: z.string().min(5, "Address is required"),
});

export type CheckoutForm = z.infer<typeof checkoutSchema>;


