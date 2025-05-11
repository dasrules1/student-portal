"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GraduationCap, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

export default function StaffPortalPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("admin")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
      // Navigation is handled in the auth context after successful sign in
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-teal-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="flex flex-col items-center justify-center w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center mb-8 space-x-2">
          <GraduationCap className="w-10 h-10 text-teal-600 dark:text-teal-400" />
          <h1 className="text-3xl font-bold text-teal-600 dark:text-teal-400">Education More</h1>
        </div>

        <Card className="w-full max-w-md border-teal-100 dark:border-teal-900">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Staff Portal</CardTitle>
            <CardDescription>Enter your credentials to access the teacher or admin dashboard</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Role</Label>
                <RadioGroup
                  defaultValue="admin"
                  value={role}
                  onValueChange={setRole}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="teacher" id="teacher" />
                    <Label htmlFor="teacher" className="cursor-pointer">
                      Teacher
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" />
                    <Label htmlFor="admin" className="cursor-pointer">
                      Administrator
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="Enter your email"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-800"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
                {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
