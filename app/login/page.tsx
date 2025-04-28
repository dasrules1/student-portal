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

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const defaultRole = searchParams.get("role") || "student"
  const [activeTab, setActiveTab] = useState(defaultRole)
  const [showPassword, setShowPassword] = useState(false)
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!email || !password) {
      setError("Email and password are required")
      setLoading(false)
      return
    }

    try {
      console.log(`Attempting to log in as ${activeTab} with email: ${email}`)
      await signIn(email, password)
      setLoginSuccess(true)
    } catch (error: any) {
      console.error("Login error:", error)
      
      // Handle specific Firebase auth errors
      let errorMessage = "Error during login. Please try again."
      
      if (error.message.includes('auth/invalid-credential')) {
        errorMessage = "Invalid email or password. Please check your credentials."
      } else if (error.message.includes('auth/user-not-found')) {
        errorMessage = "No account found with this email."
      } else if (error.message.includes('auth/wrong-password')) {
        errorMessage = "Incorrect password. Please try again."
      } else if (error.message.includes('auth/too-many-requests')) {
        errorMessage = "Too many failed attempts. Please try again later."
      } else if (error.message.includes('auth/network-request-failed')) {
        errorMessage = "Network error. Please check your connection."
      } else if (error.message.includes('auth/invalid-email')) {
        errorMessage = "Invalid email format."
      } else if (error.message.includes('auth/operation-not-allowed')) {
        errorMessage = "Email/password accounts are not enabled. Please contact support."
      }
      
      setError(errorMessage)
    }
    
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img src="/logo.png" alt="Education More" className="h-12" />
          </div>
          <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs 
            defaultValue={defaultRole} 
            className="w-full" 
            value={activeTab} 
            onValueChange={setActiveTab}
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="teacher">Teacher</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            
            {["student", "teacher", "admin"].map(role => (
              <TabsContent key={role} value={role}>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  {loginSuccess && (
                    <Alert className="mb-4 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                      <AlertDescription>Login successful! Redirecting...</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor={`${role}-email`}>Email</Label>
                    <Input
                      id={`${role}-email`}
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`${role}-password`}>Password</Label>
                    <div className="relative">
                      <Input
                        id={`${role}-password`}
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
