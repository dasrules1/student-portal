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
  async login(email: string, password: string): Promise<{ user: User | null, role: string | null, error?: string }> {
    try {
      // Validate input
      if (!email || !password) {
        return { user: null, role: null, error: "Email and password are required" };
      }

      // Check if Firebase auth is initialized
      if (!auth) {
        console.error("Firebase auth is not initialized");
        return { user: null, role: null, error: "Authentication service is not available" };
      }

      // Attempt to sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      let role = null;

      if (user) {
        try {
          // Get user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          const userData = userDoc.data();
          
          if (!userData) {
            console.error("User document not found in Firestore");
            return { user: null, role: null, error: "User data not found" };
          }

          role = userData.role || null;
          
          if (!role) {
            console.error("User role not found in Firestore");
            return { user: null, role: null, error: "User role not found" };
          }

          this.setCurrentUser(user, role);
          return { user, role };
        } catch (error) {
          console.error('Error getting user role:', error);
          return { user: null, role: null, error: "Error retrieving user data" };
        }
      }

      return { user: null, role: null, error: "Authentication failed" };
    } catch (error: any) {
      console.error("Error logging in:", error);
      
      // Handle specific Firebase auth errors
      let errorMessage = "Authentication failed";
      
      if (error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "User not found";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your connection";
      }
      
      return { user: null, role: null, error: errorMessage };
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
