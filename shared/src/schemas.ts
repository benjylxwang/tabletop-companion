import { z } from 'zod';

export const HealthResponse = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const Campaign = z.object({
  id: z.string(),
  name: z.string(),
});
export type Campaign = z.infer<typeof Campaign>;

export const CampaignsResponse = z.object({
  campaigns: z.array(Campaign),
});
export type CampaignsResponse = z.infer<typeof CampaignsResponse>;
