import { z } from "zod";

import { PRODUCT_WAITLIST_ACK_MESSAGE } from "../../src/lib/productWaitlistAck";

export { PRODUCT_WAITLIST_ACK_MESSAGE };

export const productWaitlistBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Enter an email address.")
      .max(254, "Email address is too long.")
      .refine((value) => z.email().safeParse(value).success, {
        message: "Enter a valid email address.",
      }),
    product_id: z.string().uuid(),
  })
  .strict();

export type ProductWaitlistBody = z.infer<typeof productWaitlistBodySchema>;

export function normalizedWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}
