"use client"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { LayoutDashboard, Users, BookOpen, Settings, LogOut, School, Database } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signOut, user } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")

  // Update active tab based on URL parameter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) {
      setActiveTab(tab)
    } else if (pathname === "/admin/dashboard") {
      setActiveTab("overview")
    }
  }, [searchParams, pathname])

  const handleSignOut = async () => {
    const success = await signOut()
    if (success) {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      })
      router.push("/login?role=admin")
    } else {
      toast({
        title: "Error signing out",
        description: "There was a problem signing you out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      href: "/admin/dashboard",
      tab: "overview",
    },
    {
      title: "Users",
      icon: Users,
      href: "/admin/dashboard",
      tab: "users",
    },
    {
      title: "Classes",
      icon: School,
      href: "/admin/dashboard",
      tab: "classes",
    },
    {
      title: "Reports",
      icon: BookOpen,
      href: "/admin/dashboard",
      tab: "reports",
    },
    {
      title: "Settings",
      icon: Settings,
      href: "/admin/settings",
      tab: null,
    },
    {
      title: "Initialize Database",
      icon: Database,
      href: "/admin/initialize-db",
      tab: null,
    },
  ]

  const handleNavigation = (item) => {
    console.log(`Navigating to: ${item.href}${item.tab ? `?tab=${item.tab}` : ""}`)

    // Use window.location for a full page navigation
    if (item.tab) {
      window.location.href = `${item.href}?tab=${item.tab}`
    } else {
      window.location.href = item.href
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-r w-64 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col items-start gap-2 px-4 py-4">
        <div className="flex items-center">
          <School className="w-8 h-8 mr-2 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Education More</h3>
            <p className="text-xs text-gray-500">Admin Portal</p>
          </div>
        </div>
      </div>

      <hr className="my-2" />

      {/* Navigation */}
      <div className="flex-1 px-2 py-2">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = item.tab ? activeTab === item.tab : pathname === item.href

            return (
              <Button
                key={item.title}
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start mb-1 font-normal"
                onClick={() => handleNavigation(item)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.title}
              </Button>
            )
          })}
        </nav>
      </div>

      <hr className="my-2" />

      {/* Footer */}
      <div className="p-4">
        <div className="flex items-center mb-4 gap-x-2">
          <div className="flex items-center justify-center w-8 h-8 text-white rounded-full bg-primary">
            {user?.name?.charAt(0) || "D"}
          </div>
          <div className="text-sm">
            <p className="font-medium">{user?.name || "Dylan Sood"}</p>
            <p className="text-xs text-gray-500">{user?.email || "dylan.sood@educationmore.org"}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="w-5 h-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
