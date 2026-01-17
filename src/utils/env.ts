import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();


const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PORT: z.string().regex(/^[0-9]+$/).optional(),
  // Add other required env vars here
});

const parsed = envSchema.parse(process.env);
// Prefer SUPABASE_KEY, fallback to SUPABASE_SERVICE_ROLE_KEY
if (!parsed.SUPABASE_KEY && parsed.SUPABASE_SERVICE_ROLE_KEY) {
  parsed.SUPABASE_KEY = parsed.SUPABASE_SERVICE_ROLE_KEY;
}

export const env = parsed;
