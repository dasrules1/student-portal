import Link from "next/link"
import { User } from "@/lib/storage"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import { useState } from "react"

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

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 border-r bg-background lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b p-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <img src="/logo.png" alt="Logo" className="h-6 w-6" />
              <span>Education More</span>
            </Link>
          </div>
          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-2 text-sm font-medium">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent",
                    item.current ? "bg-accent" : "transparent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t p-4">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.name || ""} />
                <AvatarFallback>
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
      {/* Rest of the component */}
    </>
  )
} 