import { auth, type UserSession } from "./supabase/auth"
import { syncLocalDataWithSupabase } from "./supabase/sync"

// Session manager for client-side session management
class SessionManager {
  // Get current user from session
  getCurrentUser(): UserSession | null {
    if (typeof window === "undefined") return null

    try {
      const userJson = localStorage.getItem("userSession")
      return userJson ? JSON.parse(userJson) : null
    } catch (error) {
      console.error("Error getting current user:", error)
      return null
    }
  }

  // Set current user in session
  setCurrentUser(user: UserSession): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem("userSession", JSON.stringify(user))
    } catch (error) {
      console.error("Error setting current user:", error)
    }
  }

  // Login user
  async login(email: string, password: string): Promise<UserSession | null> {
    try {
      const user = await auth.signIn(email, password)

      if (user) {
        this.setCurrentUser(user)

        // Sync data with Supabase after login
        await syncLocalDataWithSupabase()
      }

      return user
    } catch (error) {
      console.error("Login error:", error)
      return null
    }
  }

  // Logout user
  async logout(): Promise<boolean> {
    try {
      const success = await auth.signOut()

      if (success && typeof window !== "undefined") {
        localStorage.removeItem("userSession")
      }

      return success
    } catch (error) {
      console.error("Logout error:", error)
      return false
    }
  }

  // Check if user is logged in
  isLoggedIn(): boolean {
    return !!this.getCurrentUser()
  }

  // Check if user has role
  hasRole(role: string): boolean {
    const user = this.getCurrentUser()
    return !!user && user.role === role
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.hasRole("admin")
  }

  // Check if user is teacher
  isTeacher(): boolean {
    const user = this.getCurrentUser()
    return !!user && (user.role === "teacher" || user.role === "admin")
  }

  // Check if user is student
  isStudent(): boolean {
    return this.hasRole("student")
  }
}

export const sessionManager = new SessionManager()
