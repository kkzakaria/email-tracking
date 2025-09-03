import { createClient } from "@/utils/supabase/server";

export async function getDb() {
  return await createClient();
}