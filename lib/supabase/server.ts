import { createClient } from "@supabase/supabase-js"

// Create a server-side Supabase client (for use in Server Components and Server Actions)
export function createServerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
