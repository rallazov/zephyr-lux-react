import { z } from "zod";
import { orderNumberSchema } from "../domain/commerce/order";

export const ORDER_LOOKUP_NEUTRAL_MESSAGE =
  "If we find a matching order, we will email a secure link.";

export const orderLookupRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Enter the email address used at checkout.")
      .max(254, "Email address is too long.")
      .refine((value) => z.email().safeParse(value).success, {
        message: "Enter a valid email address.",
      }),
    order_number: z
      .string()
      .trim()
      .min(1, "Enter your order number.")
      .max(32, "Order number is too long.")
      .transform((value) => value.toUpperCase())
      .refine((value) => orderNumberSchema.safeParse(value).success, {
        message: "Enter an order number like ZLX-20260428-0001.",
      }),
  })
  .strict();

export type OrderLookupRequest = z.infer<typeof orderLookupRequestSchema>;
export type OrderLookupField = keyof OrderLookupRequest;
export type OrderLookupFieldErrors = Partial<Record<OrderLookupField, string>>;

export function parseOrderLookupRequest(input: unknown) {
  return orderLookupRequestSchema.safeParse(input);
}

export function getOrderLookupFieldErrors(error: z.ZodError): OrderLookupFieldErrors {
  const errors: OrderLookupFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if ((field === "email" || field === "order_number") && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}
