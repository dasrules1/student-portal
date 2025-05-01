"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { Eye, EyeOff } from "lucide-react"
import { User } from "firebase/auth"
import { firebaseAuth, UserSession } from "@/lib/firebase-auth"
import { getDoc, doc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase-auth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const defaultRole = searchParams.get("role") || "student"
  const [activeTab, setActiveTab] = useState(defaultRole)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const { signIn } = useAuth()

  // Check if the user is already logged in
  useEffect(() => {
    const storedAuth = localStorage.getItem('authUser')
    if (storedAuth) {
      try {
        const userData = JSON.parse(storedAuth)
        console.log("User already logged in:", userData)
        setLoginSuccess(true)
        
        // Redirect after a short delay
        setTimeout(() => {
          const destination = userData.role === "student" 
            ? "/student/dashboard" 
            : userData.role === "teacher" 
              ? "/teacher/dashboard" 
              : "/admin/dashboard"
              
          router.push(redirectUrl || destination)
        }, 1000)
      } catch (error) {
        console.error("Error parsing stored auth:", error)
      }
    }
  }, [router, redirectUrl])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Attempting login with email:', email, 'and role:', activeTab)
      const session = await signIn(email, password, activeTab === 'staff' ? 'teacher' : 'student')
      
      if (session.error) {
        throw new Error(session.error)
      }
      
      if (!session.user) {
        throw new Error('Login failed - no user returned')
      }
      
      console.log('Login successful for user:', session.user.uid)
      console.log('User role:', session.role)
      
      // Redirect based on role
      if (session.role === 'admin' || session.role === 'teacher') {
        router.push('/staff/dashboard')
      } else {
        router.push('/student/dashboard')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      let errorMessage = 'An error occurred during login.'
      
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. Please try again.'
          break
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.'
          break
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.'
          break
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.'
          break
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.'
          break
        default:
          errorMessage = error.message || 'An unexpected error occurred.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!email) {
      setResetError('Please enter your email address first.')
      return
    }

    try {
      setResetError(null)
      await firebaseAuth.sendPasswordReset(email)
      setResetSent(true)
    } catch (error: any) {
      console.error('Password reset error:', error)
      setResetError(error.message || 'Failed to send password reset email.')
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to sign in to your account
          </p>
        </div>

        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student">Student</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
          </TabsList>
          <TabsContent value="student">
            <Card>
              <CardHeader>
                <CardTitle>Student Login</CardTitle>
                <CardDescription>
                  Enter your credentials to access the student portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin}>
                  <div className="grid gap-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    
                    {resetSent && (
                      <Alert>
                        <AlertDescription>
                          Password reset email sent. Please check your inbox.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {resetError && (
                      <Alert variant="destructive">
                        <AlertDescription>{resetError}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetPassword}
                      disabled={loading || !email}
                    >
                      Reset Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle>Staff Login</CardTitle>
                <CardDescription>
                  Enter your credentials to access the staff portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin}>
                  <div className="grid gap-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    
                    {resetSent && (
                      <Alert>
                        <AlertDescription>
                          Password reset email sent. Please check your inbox.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {resetError && (
                      <Alert variant="destructive">
                        <AlertDescription>{resetError}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="grid gap-2">
                      <Label htmlFor="staff-email">Email</Label>
                      <Input
                        id="staff-email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="staff-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="staff-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetPassword}
                      disabled={loading || !email}
                    >
                      Reset Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
