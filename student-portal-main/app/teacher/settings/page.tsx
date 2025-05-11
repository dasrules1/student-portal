"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Moon, Sun, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { sessionManager } from "@/lib/session"
import { useTheme } from "next-themes"

export default function TeacherSettings() {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    autoGrading: true,
    theme: "system",
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

    // Load saved settings from localStorage
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem(`settings-${user.id}`)
      if (savedSettings) {
        try {
          setSettings(JSON.parse(savedSettings))
        } catch (error) {
          console.error("Error loading settings:", error)
        }
      }

      // Set theme based on settings
      if (theme) {
        setSettings((prev) => ({ ...prev, theme }))
      }
    }
  }, [router, toast, theme])

  const handleToggleChange = (field: string) => (checked: boolean) => {
    setSettings((prev) => ({ ...prev, [field]: checked }))
  }

  const handleThemeChange = (value: string) => {
    setSettings((prev) => ({ ...prev, theme: value }))
    setTheme(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Save settings to localStorage
    if (typeof window !== "undefined" && currentUser) {
      localStorage.setItem(`settings-${currentUser.id}`, JSON.stringify(settings))
    }

    toast({
      title: "Settings saved",
      description: "Your settings have been updated successfully.",
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
              <CardTitle className="text-2xl">Settings</CardTitle>
              <CardDescription>Manage your account settings and preferences</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notifications</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive email notifications about student submissions and updates
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={settings.emailNotifications}
                      onCheckedChange={handleToggleChange("emailNotifications")}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="push-notifications">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive push notifications on your device</p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={settings.pushNotifications}
                      onCheckedChange={handleToggleChange("pushNotifications")}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Grading</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-grading">Auto-Grading</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically grade student submissions when possible
                      </p>
                    </div>
                    <Switch
                      id="auto-grading"
                      checked={settings.autoGrading}
                      onCheckedChange={handleToggleChange("autoGrading")}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Appearance</h3>
                  <RadioGroup value={settings.theme} onValueChange={handleThemeChange}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="light" id="theme-light" />
                        <Label htmlFor="theme-light" className="flex items-center">
                          <Sun className="w-4 h-4 mr-2" />
                          Light
                        </Label>
                      </div>
                      <div className="w-12 h-6 rounded bg-white border"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dark" id="theme-dark" />
                        <Label htmlFor="theme-dark" className="flex items-center">
                          <Moon className="w-4 h-4 mr-2" />
                          Dark
                        </Label>
                      </div>
                      <div className="w-12 h-6 rounded bg-slate-900 border border-slate-700"></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="system" id="theme-system" />
                        <Label htmlFor="theme-system" className="flex items-center">
                          <Laptop className="w-4 h-4 mr-2" />
                          System
                        </Label>
                      </div>
                      <div className="w-12 h-6 rounded bg-gradient-to-r from-white to-slate-900 border"></div>
                    </div>
                  </RadioGroup>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Settings"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
