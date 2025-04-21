"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GraduationCap, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"

export default function StudentPortal() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Find user by email
    const user = storage.getUserByEmail(formData.email)

    // Check if user exists, password matches, and role is student
    if (!user) {
      toast({
        title: "Login failed",
        description: "Email not found. Please check your email address.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (user.password !== formData.password) {
      toast({
        title: "Login failed",
        description: "Incorrect password. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (user.role !== "student") {
      toast({
        title: "Access denied",
        description: "This portal is for students only",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Set user in session
    sessionManager.setCurrentUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    })

    toast({
      title: "Login successful",
      description: `Welcome, ${user.name}!`,
    })

    // Redirect to the student dashboard
    router.push("/student/dashboard")
    setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="flex flex-col items-center justify-center w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center mb-8 space-x-2">
          <GraduationCap className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">Education More</h1>
        </div>

        <Card className="w-full max-w-md border-emerald-100 dark:border-emerald-900">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Student Portal</CardTitle>
            <CardDescription>Enter your email and password to access your dashboard</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
