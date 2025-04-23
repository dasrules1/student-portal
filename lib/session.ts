import { auth } from "@/lib/firebase"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from "firebase/auth"
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SessionState {
  user: User | null
  role: string | null
  loading: boolean
  setUser: (user: User | null) => void
  setRole: (role: string | null) => void
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
      role: null,
      loading: true,
      setUser: (user: User | null) => set({ user }),
      setRole: (role: string | null) => set({ role }),
      setLoading: (loading: boolean) => set({ loading }),
    }),
    {
      name: "session-storage",
    }
  )
)

// Initialize auth state listener
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, async (user: User | null) => {
    useSession.getState().setUser(user)
    
    if (user) {
      try {
        // Get user role from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const userData = userDoc.data()
        useSession.getState().setRole(userData?.role || null)
      } catch (error) {
        console.error('Error getting user role:', error)
        useSession.getState().setRole(null)
      }
    } else {
      useSession.getState().setRole(null)
    }
    
    useSession.getState().setLoading(false)
  })
}

// Session manager for client-side session management
class SessionManager {
  // Get current user from session
  getCurrentUser() {
    if (typeof window === "undefined") return { user: null, role: null }
    const state = useSession.getState()
    return { 
      user: state.user,
      role: state.role
    }
  }

  // Set current user in session
  setCurrentUser(user: User | null, role: string | null): void {
    if (typeof window === "undefined") return
    useSession.getState().setUser(user)
    useSession.getState().setRole(role)
  }

  // Login user
  async login(email: string, password: string): Promise<{ user: User | null, role: string | null }> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      let role = null

      if (user) {
        // Get user role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          const userData = userDoc.data()
          role = userData?.role || null
        } catch (error) {
          console.error('Error getting user role:', error)
        }

        this.setCurrentUser(user, role)
      }

      return { user, role }
    } catch (error) {
      console.error("Error logging in:", error)
      return { user: null, role: null }
    }
  }

  // Logout user
  async logout(): Promise<boolean> {
    try {
      await signOut(auth)
      this.setCurrentUser(null, null)
      return true
    } catch (error) {
      console.error("Error logging out:", error)
      return false
    }
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const { role: userRole } = this.getCurrentUser()
    return userRole === role
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.hasRole("admin")
  }

  // Check if user is teacher
  isTeacher(): boolean {
    const { role } = this.getCurrentUser()
    return role === "teacher" || role === "admin"
  }

  // Check if user is student
  isStudent(): boolean {
    return this.hasRole("student")
  }
}

export const sessionManager = new SessionManager()
