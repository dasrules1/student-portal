import { supabase } from "./client"
import { createServerClient } from "./server"
import { syncLocalDataWithSupabase } from "./sync"

export type UserRole = "student" | "teacher" | "admin"

export interface UserSession {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
}

// List of hardcoded admin accounts for development/testing
const ADMIN_ACCOUNTS = [
  { email: "admin@educationmore.org", password: "admin123", name: "Admin User" },
  { email: "dylan.sood@gmail.com", password: "Banking!123", name: "Dylan Sood" },
  { email: "dylan.sood@educationmore.org", password: "Banking!123", name: "Dylan Sood" },
]

const STORAGE_KEYS = {
  USERS: "userSession",
}

export const auth = {
  // Sign in with email and password
  async signIn(email: string, password: string): Promise<UserSession | null> {
    try {
      console.log(`Attempting to sign in with email: ${email}`)

      // For demo/testing, handle hardcoded admin accounts
      const adminAccount = ADMIN_ACCOUNTS.find(
        (account) => account.email.toLowerCase() === email.toLowerCase() && account.password === password,
      )

      if (adminAccount) {
        console.log(`Using hardcoded admin account for development: ${email}`)

        // Create a temporary admin session for development
        const tempSession = {
          id: `admin-dev-${Date.now()}`,
          email: adminAccount.email,
          name: adminAccount.name,
          role: "admin" as UserRole,
          avatar: adminAccount.name.charAt(0).toUpperCase(),
        }

        // Store session in localStorage for persistence
        localStorage.setItem("userSession", JSON.stringify(tempSession))
        console.log("Admin session stored in localStorage:", tempSession)

        // Sync data with Supabase after login
        await syncLocalDataWithSupabase()

        return tempSession
      }

      // Regular sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        console.error("Authentication error:", authError)
        return null
      }

      if (!authData.user) {
        return null
      }

      // Get the user profile from our users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authData.user.id)
        .single()

      if (userError) {
        console.error("User data error:", userError)
        return null
      }

      const userSession = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role as UserRole,
        avatar: userData.avatar || userData.name.charAt(0).toUpperCase(),
      }

      // Store session in localStorage for persistence
      localStorage.setItem("userSession", JSON.stringify(userSession))
      console.log("User session stored in localStorage:", userSession)

      // Sync data with Supabase after login
      await syncLocalDataWithSupabase()

      // Return the user session
      return userSession
    } catch (error) {
      console.error("Sign in error:", error)
      return null
    }
  },

  // Sign out
  async signOut() {
    try {
      // Clear local session
      localStorage.removeItem("userSession")
      console.log("User session removed from localStorage")

      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Sign out error:", error)
        return false
      }
      return true
    } catch (error) {
      console.error("Sign out error:", error)
      return false
    }
  },

  // Get current session
  async getSession(): Promise<UserSession | null> {
    try {
      // First check localStorage for a session
      const storedSession = localStorage.getItem("userSession")
      if (storedSession) {
        console.log("Found stored session in localStorage")
        const parsedSession = JSON.parse(storedSession)

        // For admin accounts, just return the stored session
        if (ADMIN_ACCOUNTS.some((admin) => admin.email.toLowerCase() === parsedSession.email.toLowerCase())) {
          console.log("Using stored admin session")

          // Sync data with Supabase
          await syncLocalDataWithSupabase()

          return parsedSession
        }

        // For regular users, verify with Supabase
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            console.log("Supabase session verified")

            // Sync data with Supabase
            await syncLocalDataWithSupabase()

            return parsedSession
          }
        } catch (e) {
          console.error("Error verifying session with Supabase:", e)
        }
      }

      // If no localStorage session, check with Supabase
      console.log("No valid stored session, checking with Supabase")
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        console.log("No Supabase session found")
        return null
      }

      // Get the user profile from our users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.session.user.id)
        .single()

      if (userError) {
        console.error("User data error:", userError)
        return null
      }

      const userSession = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role as UserRole,
        avatar: userData.avatar || userData.name.charAt(0).toUpperCase(),
      }

      // Store session in localStorage for persistence
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(userSession))
      console.log("User session stored in localStorage:", userSession)

      // Sync data with Supabase
      await syncLocalDataWithSupabase()

      // Return the user session
      return userSession
    } catch (error) {
      console.error("Get session error:", error)
      return null
    }
  },

  // Admin-only: Create a new user
  async createUser(userData: {
    email: string
    password: string
    name: string
    role: UserRole
    avatar?: string
  }): Promise<{ success: boolean; error?: string; userId?: string }> {
    try {
      // Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: userData.role,
          },
        },
      })

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || "Failed to create user" }
      }

      // Create the user profile in our users table
      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .insert([
          {
            id: authData.user.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            avatar: userData.avatar || userData.name.charAt(0).toUpperCase(),
            status: "active",
          },
        ])
        .select()

      if (profileError) {
        // If profile creation fails, try to delete the auth user to avoid orphaned accounts
        try {
          await supabase.auth.admin.deleteUser(authData.user.id)
        } catch (deleteError) {
          console.error("Failed to delete orphaned auth user:", deleteError)
        }
        return { success: false, error: profileError.message }
      }

      return { success: true, userId: authData.user.id }
    } catch (error: any) {
      console.error("Create user error:", error)
      return { success: false, error: error.message || "An unexpected error occurred" }
    }
  },

  // Server-side functions (using service role key)
  server: {
    // Get user by ID (server-side only)
    async getUserById(userId: string) {
      const supabaseServer = createServerClient()
      const { data, error } = await supabaseServer.from("users").select("*").eq("id", userId).single()

      if (error) {
        console.error("Get user error:", error)
        return null
      }

      return data
    },

    // Admin-only: Update user (server-side only)
    async updateUser(
      userId: string,
      userData: Partial<{
        name: string
        role: UserRole
        avatar: string
        status: "active" | "inactive"
      }>,
    ) {
      const supabaseServer = createServerClient()
      const { data, error } = await supabaseServer.from("users").update(userData).eq("id", userId).select().single()

      if (error) {
        console.error("Update user error:", error)
        return { success: false, error: error.message }
      }

      return { success: true, user: data }
    },

    // Admin-only: Delete user (server-side only)
    async deleteUser(userId: string) {
      const supabaseServer = createServerClient()

      // Delete the user from our users table
      const { error: profileError } = await supabaseServer.from("users").delete().eq("id", userId)

      if (profileError) {
        console.error("Delete user profile error:", profileError)
        return { success: false, error: profileError.message }
      }

      // Delete the auth user
      const { error: authError } = await supabaseServer.auth.admin.deleteUser(userId)

      if (authError) {
        console.error("Delete auth user error:", authError)
        return { success: false, error: authError.message }
      }

      return { success: true }
    },
  },
}
