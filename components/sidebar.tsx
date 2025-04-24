import Link from "next/link"
import { User } from "@/lib/storage"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { sessionManager } from "@/lib/session"

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  current: boolean
}

interface SidebarProps {
  navigation: NavItem[]
  user?: User
}

export function Sidebar({ navigation, user }: SidebarProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

  useEffect(() => {
    // Try to get the name from different sources
    if (user && user.name) {
      setUserName(user.name);
    } else {
      // Fallback to session or localStorage
      try {
        const sessionUser = sessionManager.getCurrentUser();
        if (sessionUser && sessionUser.user && sessionUser.user.displayName) {
          setUserName(sessionUser.user.displayName);
        } else {
          // Try localStorage
          const storedAuth = localStorage.getItem('authUser');
          if (storedAuth) {
            const authData = JSON.parse(storedAuth);
            if (authData && authData.displayName) {
              setUserName(authData.displayName);
            }
          }
        }
      } catch (e) {
        console.error("Error retrieving user name:", e);
      }
    }
  }, [user]);

  return (
    <div className="flex flex-col w-64 h-screen border-r bg-background">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <img src="/logo.png" alt="Logo" className="h-6 w-6" />
          <h2 className="text-lg font-bold">Education More</h2>
        </div>
        <p className="text-xs text-muted-foreground pl-8">Student Portal</p>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="px-4 py-3 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                item.current
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-4 border-t">
        <div className="flex items-center">
          <Avatar className="w-8 h-8 mr-3">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback>
              {userName ? userName.substring(0, 2).toUpperCase() : "ST"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{userName || "Student"}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 