"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const success = await resetPassword(email)
      
      if (success) {
        setIsSuccess(true)
        toast({
          title: "Password reset email sent",
          description: "Please check your email for instructions to reset your password.",
        })
      } else {
        toast({
          title: "Failed to send reset email",
          description: "Please check your email address and try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Password reset error:", error)
      toast({
        title: "An error occurred",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {isSuccess ? (
          <CardContent>
            <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-green-900/20 dark:text-green-400">
              <p>
                We've sent a password reset link to <strong>{email}</strong>. Please check your email.
              </p>
            </div>
            <div className="mt-4 text-center">
              <Link href="/login">
                <Button variant="outline">Return to Login</Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <div className="text-sm text-center text-gray-500">
                <Link href="/login" className="text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
