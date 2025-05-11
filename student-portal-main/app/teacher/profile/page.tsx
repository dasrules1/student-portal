"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { sessionManager } from "@/lib/session"
import { storage } from "@/lib/storage"

export default function TeacherProfile() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "teacher") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a teacher to view this page",
        variant: "destructive",
      })
      router.push("/staff-portal")
      return
    }

    setCurrentUser(user)

    // Get full user data
    const userData = storage.getUserById(user.id)
    if (userData) {
      setFormData({
        ...formData,
        name: userData.name,
        email: userData.email,
      })
    }
  }, [router, toast])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate form
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirm password must match.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Get full user data
    const userData = storage.getUserById(currentUser.id)

    // Verify current password if changing password
    if (formData.newPassword && userData.password !== formData.currentPassword) {
      toast({
        title: "Incorrect password",
        description: "Your current password is incorrect.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Update user data
    const updatedUser = {
      ...userData,
      name: formData.name,
      email: formData.email,
    }

    // Update password if provided
    if (formData.newPassword) {
      updatedUser.password = formData.newPassword
    }

    // Save changes
    storage.updateUser(currentUser.id, updatedUser)

    // Update session
    sessionManager.setCurrentUser({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
    })

    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    })

    // Reset password fields
    setFormData({
      ...formData,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })

    setIsLoading(false)
  }

  if (!currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container py-6">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/teacher/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src="/placeholder.svg" alt={currentUser.name} />
                  <AvatarFallback className="text-lg">{currentUser.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{currentUser.name}</CardTitle>
                  <CardDescription>{currentUser.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                </div>

                <div className="pt-4 border-t">
                  <h3 className="mb-4 text-lg font-medium">Change Password</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        value={formData.currentPassword}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={formData.newPassword}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
