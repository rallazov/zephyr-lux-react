import { z } from "zod";
import { addressSchema } from "../../src/domain/commerce/address";

/** Customer subscription Checkout Session request — never accepts Stripe price IDs or amounts from the client (Story 8-2 AC2). */
export const createSubscriptionCheckoutBodySchema = z.object({
  plan_id: z.string().uuid(),
  email: z.string().trim().email().max(254),
  customer_name: z.string().trim().max(200).optional(),
  shipping_address: addressSchema.optional(),
});

export type CreateSubscriptionCheckoutBody = z.infer<
  typeof createSubscriptionCheckoutBodySchema
>;
