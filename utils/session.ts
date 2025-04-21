// Simple client-side session management
// In a real app, this would use server-side sessions or JWT tokens

export interface SessionUser {
  id: string
  name: string
  email: string
  role: "student" | "teacher" | "admin"
  avatar: string
}

class SessionManager {
  private static instance: SessionManager

  private constructor() {}

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  // Set current user in session
  public setCurrentUser(user: SessionUser): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("currentUser", JSON.stringify(user))
    }
  }

  // Get current user from session
  public getCurrentUser(): SessionUser | null {
    if (typeof window !== "undefined") {
      const userJson = localStorage.getItem("currentUser")
      if (userJson) {
        try {
          return JSON.parse(userJson)
        } catch (error) {
          console.error("Error parsing user from session:", error)
          return null
        }
      }
    }
    return null
  }

  // Clear current user session
  public clearCurrentUser(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("currentUser")
    }
  }

  // Check if user is logged in
  public isLoggedIn(): boolean {
    return this.getCurrentUser() !== null
  }
}

export const sessionManager = SessionManager.getInstance()
