import Link from "next/link"
import { User } from "@/lib/storage"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
  return (
    <div className="flex flex-col w-64 h-screen border-r bg-background">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold">Student Portal</h2>
      </div>
      <div className="flex-1 overflow-auto">
        <nav className="px-4 py-6 space-y-1">
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
      {user && (
        <div className="p-4 border-t">
          <div className="flex items-center">
            <Avatar className="w-8 h-8 mr-3">
              <AvatarImage src={user.profileImageUrl || ""} />
              <AvatarFallback>
                {user.name ? user.name.substring(0, 2).toUpperCase() : "ST"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user.name || "Student"}</p>
              <p className="text-xs text-muted-foreground">{user.email || ""}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 