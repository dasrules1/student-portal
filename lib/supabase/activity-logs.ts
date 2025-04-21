import { supabase } from "./client"
import { createServerClient } from "./server"

export interface ActivityLog {
  id: string
  action: string
  details: string
  category: string
  user_id?: string
  created_at: string
}

export const activityLogService = {
  // Admin: Get all activity logs
  async getActivityLogs(): Promise<ActivityLog[]> {
    const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Get activity logs error:", error)
      return []
    }

    return data
  },

  // Create a new activity log
  async createActivityLog(logData: {
    action: string
    details: string
    category: string
    user_id?: string
  }): Promise<{ success: boolean; error?: string; logId?: string }> {
    const { data, error } = await supabase.from("activity_logs").insert([logData]).select().single()

    if (error) {
      console.error("Create activity log error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, logId: data.id }
  },

  // Server-side functions (using service role key)
  server: {
    // Admin: Get all activity logs (server-side only)
    async getActivityLogs(): Promise<ActivityLog[]> {
      const supabaseServer = createServerClient()
      const { data, error } = await supabaseServer
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Get activity logs error:", error)
        return []
      }

      return data
    },

    // Admin: Create a new activity log (server-side only)
    async createActivityLog(logData: {
      action: string
      details: string
      category: string
      user_id?: string
    }): Promise<{ success: boolean; error?: string; logId?: string }> {
      const supabaseServer = createServerClient()
      const { data, error } = await supabaseServer.from("activity_logs").insert([logData]).select().single()

      if (error) {
        console.error("Create activity log error:", error)
        return { success: false, error: error.message }
      }

      return { success: true, logId: data.id }
    },
  },
}
