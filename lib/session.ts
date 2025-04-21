import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SessionState {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

type SetState = (
  partial: SessionState | Partial<SessionState> | ((state: SessionState) => SessionState | Partial<SessionState>),
  replace?: boolean
) => void

export const useSession = create<SessionState>()(
  persist(
    (set: SetState) => ({
      user: null,
      loading: true,
      setUser: (user: User | null) => set({ user }),
      setLoading: (loading: boolean) => set({ loading }),
    }),
    {
      name: "session-storage",
    }
  )
)

// Initialize auth state listener
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user: User | null) => {
    useSession.getState().setUser(user)
    useSession.getState().setLoading(false)
  })
}

// Session manager for client-side session management
class SessionManager {
  // Get current user from session
  getCurrentUser(): User | null {
    if (typeof window === "undefined") return null
    return useSession.getState().user
  }

  // Set current user in session
  setCurrentUser(user: User | null): void {
    if (typeof window === "undefined") return
    useSession.getState().setUser(user)
  }

  // Login user
  async login(email: string, password: string): Promise<User | null> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      if (user) {
        this.setCurrentUser(user)
      }

      return user
    } catch (error) {
      console.error("Error logging in:", error)
      return null
    }
  }

  // Logout user
  async logout(): Promise<boolean> {
    try {
      await signOut(auth)
      this.setCurrentUser(null)
      return true
    } catch (error) {
      console.error("Error logging out:", error)
      return false
    }
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const user = this.getCurrentUser()
    return !!user && user.displayName === role
  }

  // Check if user is admin
  isAdmin(): boolean {
    const user = this.getCurrentUser()
    return !!user && user.displayName === "admin"
  }

  // Check if user is teacher
  isTeacher(): boolean {
    const user = this.getCurrentUser()
    return !!user && (user.displayName === "teacher" || user.displayName === "admin")
  }

  // Check if user is student
  isStudent(): boolean {
    return this.hasRole("student")
  }
}

export const sessionManager = new SessionManager()
