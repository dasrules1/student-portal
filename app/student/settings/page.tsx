"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Moon, Sun, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { sessionManager } from "@/lib/session"

export default function StudentSettings() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    darkMode: false,
    soundEffects: true,
  })

  useEffect(() => {
    // Get current user from session
    const currentUser = sessionManager.getCurrentUser()
    if (!currentUser) {
      router.push("/login")
      return
    }

    // In a real app, we would fetch user settings from the server
    // For this demo, we'll use default settings
    const savedSettings = localStorage.getItem(`settings_${currentUser.id}`)
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [router])

  const handleToggle = (setting) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [setting]: !prev[setting] }

      // Save settings to localStorage
      const currentUser = sessionManager.getCurrentUser()
      if (currentUser) {
        localStorage.setItem(`settings_${currentUser.id}`, JSON.stringify(newSettings))
      }

      return newSettings
    })
  }

  const handleSave = () => {
    setIsLoading(true)

    // In a real app, we would save settings to the server
    setTimeout(() => {
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      })
      setIsLoading(false)
    }, 500)
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" size="sm" className="mr-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notification Settings
            </CardTitle>
            <CardDescription>Manage how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email notifications about assignments, grades, and announcements
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={settings.emailNotifications}
                onCheckedChange={() => handleToggle("emailNotifications")}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive push notifications on your device for important updates
                </p>
              </div>
              <Switch
                id="push-notifications"
                checked={settings.pushNotifications}
                onCheckedChange={() => handleToggle("pushNotifications")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {settings.darkMode ? <Moon className="w-5 h-5 mr-2" /> : <Sun className="w-5 h-5 mr-2" />}
              Appearance
            </CardTitle>
            <CardDescription>Customize how the application looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
              </div>
              <Switch id="dark-mode" checked={settings.darkMode} onCheckedChange={() => handleToggle("darkMode")} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sound-effects">Sound Effects</Label>
                <p className="text-sm text-muted-foreground">Play sound effects for notifications and interactions</p>
              </div>
              <Switch
                id="sound-effects"
                checked={settings.soundEffects}
                onCheckedChange={() => handleToggle("soundEffects")}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
