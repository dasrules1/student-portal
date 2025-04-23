"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { 
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { firebaseAuth, UserSession } from '@/lib/firebase-auth'

interface AuthContextType {
  user: User | null
  role: 'student' | 'teacher' | 'admin' | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, role: 'student' | 'teacher' | 'admin') => Promise<void>
  signOut: () => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  updateProfile: (userId: string, data: { name?: string; role?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'student' | 'teacher' | 'admin' | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const session = await firebaseAuth.getCurrentUser()
        setUser(session.user)
        setRole(session.role)
      } catch (error) {
        console.error('Session check error:', error)
        setUser(null)
        setRole(null)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const session = await firebaseAuth.signIn(email, password)
      if (session.error) {
        throw new Error(session.error)
      }
      
      // First set the user and role
      setUser(session.user)
      setRole(session.role)
      
      // Store authentication data in localStorage to ensure persistence
      if (session.user && session.role) {
        localStorage.setItem('authUser', JSON.stringify({
          uid: session.user.uid,
          email: session.user.email,
          role: session.role
        }))
      }
      
      // Wait for a longer delay to ensure state is properly updated
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Then handle navigation based on role
      if (session.role === 'admin') {
        // Use direct navigation to avoid Next.js router issues
        window.location.href = '/admin/dashboard'
      } else if (session.role === 'student') {
        window.location.href = '/student/dashboard'
      } else {
        window.location.href = '/teacher/dashboard'
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, name: string, role: 'student' | 'teacher' | 'admin') => {
    try {
      const result = await firebaseAuth.signUp(email, password, name, role)
      if (!result.success) {
        throw new Error(result.error)
      }
      // After signup, sign in the user
      await signIn(email, password)
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      const success = await firebaseAuth.signOut()
      if (success) {
        // Clear the user and role from state
        setUser(null)
        setRole(null)
        
        // Clear the localStorage auth data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authUser')
        }
        
        router.push('/')
      }
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const sendPasswordReset = async (email: string) => {
    try {
      const result = await firebaseAuth.sendPasswordReset(email)
      if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Password reset error:', error)
      throw error
    }
  }

  const updateProfile = async (userId: string, data: { name?: string; role?: string }) => {
    try {
      const result = await firebaseAuth.updateUserProfile(userId, data)
      if (!result.success) {
        throw new Error(result.error)
      }
      // Refresh user data
      const session = await firebaseAuth.getCurrentUser()
      setUser(session.user)
      setRole(session.role)
    } catch (error: any) {
      console.error('Update profile error:', error)
      throw error
    }
  }

  const value = {
    user,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Custom hook for protected routes
export function useRequireAuth(role?: "student" | "teacher" | "admin" | null) {
  const { user, role: userRole, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [localAuth, setLocalAuth] = useState<{uid: string, email: string, role: string} | null>(null)
  
  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedAuth = localStorage.getItem('authUser')
        if (storedAuth) {
          setLocalAuth(JSON.parse(storedAuth))
        }
      } catch (e) {
        console.error('Error reading auth from localStorage:', e)
      }
    }
  }, [])

  useEffect(() => {
    // Only run after initial loading is complete and not already redirecting
    if (!loading && !isRedirecting) {
      // Check both Firebase auth and localStorage auth
      const isUserAuthenticated = user || localAuth
      const effectiveRole = userRole || (localAuth?.role as any)
      
      if (!isUserAuthenticated) {
        // Not logged in, redirect to login
        console.log("Not logged in, redirecting to login")
        setIsRedirecting(true)
        const currentRole = pathname.split("/")[1]
        setTimeout(() => {
          router.push(`/login?role=${currentRole}`)
        }, 1000) // Add delay to prevent race condition
      } else if (role && effectiveRole) {
        // Check for role requirements
        console.log(`Checking role requirements: user role=${effectiveRole}, required role=${role}`)
        // Only redirect if the user doesn't have the required role
        if (role === "admin" && effectiveRole !== "admin") {
          console.log("Admin role required but user is not admin, redirecting")
          setIsRedirecting(true)
          setTimeout(() => {
            router.push("/login?role=admin")
          }, 1000) // Add delay to prevent race condition
        } else if (role === "teacher" && effectiveRole !== "teacher" && effectiveRole !== "admin") {
          console.log("Teacher role required but user is not teacher or admin, redirecting")
          setIsRedirecting(true)
          setTimeout(() => {
            router.push("/login?role=teacher")
          }, 1000) // Add delay to prevent race condition
        } else if (role === "student" && effectiveRole !== "student") {
          console.log("Student role required but user is not student, redirecting")
          setIsRedirecting(true)
          setTimeout(() => {
            router.push("/login?role=student")
          }, 1000) // Add delay to prevent race condition
        }
      }
    }
  }, [loading, user, userRole, router, pathname, role, isRedirecting, localAuth])

  // Return whether the user is authorized along with loading state
  const effectiveRole = userRole || (localAuth?.role as any)
  const isAuthorized = Boolean(
    !loading && 
    (user || localAuth) && 
    (!role || (role === "admin" && effectiveRole === "admin") ||
    (role === "teacher" && (effectiveRole === "teacher" || effectiveRole === "admin")) ||
    (role === "student" && effectiveRole === "student"))
  )

  return { user: user || (localAuth as any), loading, isAuthorized }
}
