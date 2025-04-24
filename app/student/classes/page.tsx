"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Book,
  Calendar,
  CheckSquare,
  Cog,
  File,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { storage } from "@/lib/storage"
import { User, Class } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"

export default function StudentClasses() {
  const router = useRouter()
  const { user: authUser, role: authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Try to get user from multiple sources
        const sessionUser = sessionManager.getCurrentUser()
        
        // Try local storage as a fallback
        let authData = null
        try {
          const storedAuth = localStorage.getItem('authUser')
          if (storedAuth) {
            authData = JSON.parse(storedAuth)
          }
        } catch (e) {
          console.error('Error reading auth from localStorage:', e)
        }
        
        // Get user ID from available sources
        const userId = authUser?.uid || sessionUser?.user?.uid || authData?.uid
        
        if (!userId) {
          console.error("No user ID found")
          setAuthError("You need to log in to access this page")
          return
        }
        
        // Get user data
        let userData = null
        
        // Try storage first
        try {
          userData = storage.getUserById(userId)
        } catch (storageErr) {
          console.error("Error getting user from storage:", storageErr)
        }
        
        // If no user data, try using auth data directly
        if (!userData && authUser) {
          userData = {
            id: authUser.uid,
            name: authUser.displayName || "Student",
            email: authUser.email,
            role: authRole || "student"
          }
        }
        
        // Last attempt using local storage data
        if (!userData && authData) {
          userData = {
            id: authData.uid,
            email: authData.email,
            role: authData.role,
            name: "Student"
          }
        }
        
        if (!userData) {
          console.error("No user data found")
          setAuthError("Unable to retrieve your user information")
          setLoading(false)
          return
        }
        
        setCurrentUser(userData)
        
        // Check if the current user is a student
        if (userData.role !== "student") {
          console.error("User is not a student")
          setAuthError("This page is only available to student accounts")
          setLoading(false)
          return
        }
        
        // Load all classes
        const allClasses = await storage.getClasses()
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls.enrolledStudents && cls.enrolledStudents.includes(userData.id)
        )
        
        setStudentClasses(enrolledClasses)
      } catch (error) {
        console.error("Error loading student classes:", error)
        setAuthError("There was a problem loading your classes")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [authUser, authRole])

  const navigation = [
    {
      title: "Dashboard",
      href: "/student/dashboard",
      icon: LayoutDashboard,
      current: false,
    },
    {
      title: "Classes",
      href: "/student/classes",
      icon: Book,
      current: true,
    },
    {
      title: "Assignments",
      href: "/student/assignments",
      icon: CheckSquare,
      current: false,
    },
    {
      title: "Calendar",
      href: "/student/calendar",
      icon: Calendar,
      current: false,
    },
    {
      title: "Grades",
      href: "/student/grades",
      icon: File,
      current: false,
    },
    {
      title: "Students",
      href: "/student/students",
      icon: Users,
      current: false,
    },
    {
      title: "Settings",
      href: "/student/settings",
      icon: Cog,
      current: false,
    },
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <p>Loading classes...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Authentication Error</CardTitle>
              <CardDescription>
                {authError}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/login?role=student")}>
                Go to Login
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentUser || currentUser.role !== "student") {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                This page is only available to student accounts.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => router.push("/")}>
                Return to Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} user={currentUser} />
      <div className="flex-1 p-8 pt-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-muted-foreground">
              View and access your enrolled classes
            </p>
          </div>
        </div>

        {/* Class List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studentClasses.length > 0 ? (
            studentClasses.map((cls) => (
              <Card key={cls.id}>
                <CardHeader>
                  <CardTitle>{cls.name}</CardTitle>
                  <CardDescription>Teacher: {cls.teacher}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="text-muted-foreground">70%</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={`/student/curriculum/${cls.id}`}>
                      View Class
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Book className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">You are not enrolled in any classes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 