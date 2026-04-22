import { z } from "zod";

export const StartResponseSchema = z.object({
  code: z.string(),
  verification_url: z.string(),
  verification_url_complete: z.string(),
  poll_url: z.string(),
  interval_seconds: z.number(),
  expires_in: z.number(),
});
export type StartResponse = z.infer<typeof StartResponseSchema>;

export const PollRequestSchema = z.object({
  code: z.string(),
});
export type PollRequest = z.infer<typeof PollRequestSchema>;

export const PollResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("ok"),
    token: z.string(),
    user_id: z.string(),
    username: z.string(),
    api_url: z.string(),
  }),
]);
export type PollResponse = z.infer<typeof PollResponseSchema>;

export const ConfirmRequestSchema = z.object({
  code: z.string(),
});
export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
