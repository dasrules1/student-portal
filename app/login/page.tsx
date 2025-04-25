"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { storage } from "@/lib/storage"
import { persistentStorage } from "@/lib/persistentStorage"

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

  // Check if the user is already logged in
  useEffect(() => {
    const checkExistingLogin = async () => {
      // Try localStorage first
      try {
        const storedUser = localStorage.getItem("currentUser")
        if (storedUser) {
          const user = JSON.parse(storedUser)
          console.log("User already logged in:", user)
          setLoginSuccess(true)
          
          // Redirect after a short delay
          setTimeout(() => {
            const destination = user.role === "student" 
              ? "/student/dashboard" 
              : user.role === "teacher" 
                ? "/teacher/dashboard" 
                : "/admin/dashboard"
                
            router.push(redirectUrl || destination)
          }, 1000)
          return
        }
      } catch (e) {
        console.error("Error checking existing login:", e)
      }
    }
    
    checkExistingLogin()
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
      
      // Try to get the user from storage
      let user = null
      
      try {
        // Try to find user in persistent storage
        const users = await persistentStorage.getAllUsers()
        user = users.find(u => 
          u.email.toLowerCase() === email.toLowerCase() && 
          u.password === password &&
          u.role === activeTab
        )
      } catch (storageError) {
        console.error("Error getting users from persistent storage:", storageError)
      }
      
      if (!user) {
        // Fallback to direct storage method
        try {
          user = await storage.getUserByEmail(email)
          if (!user || user.password !== password || user.role !== activeTab) {
            user = null
          }
        } catch (err) {
          console.error("Error getting user by email:", err)
        }
      }
      
      // Demo logins for testing
      if (!user && email === `${activeTab}@example.com` && password === "password") {
        user = {
          id: `${activeTab}_demo_1`,
          name: activeTab === "student" ? "John Student" : 
                activeTab === "teacher" ? "Jane Teacher" : "Admin User",
          email: email,
          role: activeTab,
          status: "active",
          password: "password", // Not secure, but this is just for demo
          classes: []
        }
      }
      
      if (user) {
        console.log("Login successful:", user)
        
        // Store in both localStorage and sessionStorage for redundancy
        localStorage.setItem("currentUser", JSON.stringify(user))
        sessionStorage.setItem("currentUser", JSON.stringify(user))
        
        // Also store in authUser format that some components may expect
        const authData = {
          uid: user.id,
          displayName: user.name,
          email: user.email,
          role: user.role
        }
        localStorage.setItem("authUser", JSON.stringify(authData))
        
        setLoginSuccess(true)
        
        // Redirect after a short delay 
        setTimeout(() => {
          const destination = activeTab === "student" 
            ? "/student/dashboard" 
            : activeTab === "teacher" 
              ? "/teacher/dashboard" 
              : "/admin/dashboard"
              
          router.push(redirectUrl || destination)
        }, 1000)
      } else {
        setError(`Invalid ${activeTab} credentials. Please try again.`)
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("Error during login. Please try again.")
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
                      placeholder={`${role}@example.com`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${role}-password`}>Password</Label>
                      <Button 
                        variant="link" 
                        className="px-0 text-xs" 
                        onClick={() => setPassword("password")}
                      >
                        Use Demo Password
                      </Button>
                    </div>
                    <Input
                      id={`${role}-password`}
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || loginSuccess}
                  >
                    {loading ? "Logging in..." : "Sign In"}
                  </Button>
                </form>
                
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <p>Demo credentials for testing: </p>
                  <code className="text-xs font-mono">
                    {role}@example.com / password
                  </code>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground mt-2">
            <p>Education More Portal</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
