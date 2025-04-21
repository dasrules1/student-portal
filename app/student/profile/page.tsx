"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Settings, LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"

export default function StudentProfile() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    // Get current user from session
    const currentUser = sessionManager.getCurrentUser()
    if (!currentUser) {
      router.push("/login")
      return
    }

    // Get full user data from storage
    const userData = storage.getUserById(currentUser.id)
    if (!userData) {
      sessionManager.clearCurrentUser()
      router.push("/login")
      return
    }

    setUser(userData)
    setFormData({
      name: userData.name,
      email: userData.email,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })
  }, [router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleProfileUpdate = (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Update user profile
    if (user) {
      storage.updateUser(user.id, {
        name: formData.name,
        email: formData.email,
      })

      // Update session
      sessionManager.setCurrentUser({
        id: user.id,
        name: formData.name,
        email: formData.email,
        role: user.role,
        avatar: user.avatar,
      })

      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      })
    }

    setIsLoading(false)
  }

  const handlePasswordChange = (e) => {
    e.preventDefault()
    setIsLoading(true)

    // Validate current password
    if (user && formData.currentPassword !== user.password) {
      toast({
        title: "Incorrect password",
        description: "Your current password is incorrect.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Validate new password
    if (formData.newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Your new password must be at least 6 characters long.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Validate password confirmation
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Your new password and confirmation don't match.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    // Update password
    if (user) {
      storage.updateUser(user.id, {
        password: formData.newPassword,
      })

      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      })

      // Reset password fields
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }))
    }

    setIsLoading(false)
  }

  const handleLogout = () => {
    sessionManager.clearCurrentUser()
    router.push("/login")
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Avatar className="w-12 h-12">
            <AvatarFallback>{user.avatar}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <a href="/student/settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </a>
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <form onSubmit={handleProfileUpdate}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password</CardDescription>
          </CardHeader>
          <form onSubmit={handlePasswordChange}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
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
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
