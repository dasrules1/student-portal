"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { School, FileText, Users, Calendar, User, Settings, LogOut, GraduationCap } from "lucide-react"
import { sessionManager } from "@/lib/session"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    // Check if user is logged in as a teacher
    const currentUser = sessionManager.getCurrentUser()
    if (!currentUser || currentUser.role !== "teacher") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a teacher to view this page",
        variant: "destructive",
      })
      router.push("/staff-portal")
      return
    }
    
    // Set teacher data
    setUserData(currentUser.user || currentUser)
  }, [router, toast])

  const handleLogout = async () => {
    await sessionManager.logout()
    router.push("/staff-portal")
  }

  if (!userData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="hidden w-64 p-4 bg-white border-r md:block dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center mb-8 space-x-2">
          <School className="w-6 h-6 text-primary" />
          <div className="flex flex-col">
            <span className="text-xl font-bold">Education More</span>
            <span className="text-sm text-muted-foreground">Teacher Portal</span>
          </div>
        </div>
        
        <nav className="space-y-1 mb-6">
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/dashboard">
              <FileText className="w-5 h-5 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/classes">
              <School className="w-5 h-5 mr-2" />
              Classes
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/students">
              <Users className="w-5 h-5 mr-2" />
              Students
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/dashboard?tab=content">
              <Calendar className="w-5 h-5 mr-2" />
              Content
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/grades">
              <GraduationCap className="w-5 h-5 mr-2" />
              Grades
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/profile">
              <User className="w-5 h-5 mr-2" />
              Profile
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/teacher/settings">
              <Settings className="w-5 h-5 mr-2" />
              Settings
            </Link>
          </Button>
        </nav>

        {/* Teacher info in sidebar - at the bottom */}
        <div className="pt-4 mt-auto">
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src="/placeholder.svg" alt="Teacher" />
                <AvatarFallback>{userData?.avatar || (userData?.name?.charAt(0) || "T")}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{userData?.name || userData?.displayName || "Teacher"}</p>
                <p className="text-xs text-muted-foreground">{userData?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 