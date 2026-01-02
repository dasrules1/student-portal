"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Book,
  CheckSquare,
  Cog,
  File,
  LayoutDashboard,
  Users,
  Bell,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { storage } from "@/lib/storage"
import { User, Class } from "@/lib/types"
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
        console.log("Loaded classes:", allClasses?.length || 0)
        
        // Additional null check and validation for classes
        if (!allClasses || !Array.isArray(allClasses)) {
          console.error("No classes found or invalid classes data")
          setStudentClasses([])
          setLoading(false)
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.includes(userData.id)
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
      title: "Announcements",
      href: "/student/announcements",
      icon: Bell,
      current: false,
    },
    {
      title: "Grades",
      href: "/student/grades",
      icon: File,
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
      <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-primary">Education More</h2>
            </div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-muted-foreground">
              View and access your enrolled classes
            </p>
          </div>
        </div>

        {/* Class List */}
        <div className="grid gap-6">
          {studentClasses.length > 0 ? (
            studentClasses.map((cls) => (
              <Card key={cls.id} className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{cls.name}</CardTitle>
                  <CardDescription>Teacher: {cls.teacher}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Class Details</h3>
                      <dl className="space-y-2">
                        {cls.meetingDates && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Meeting Days:</dt>
                            <dd>{cls.meetingDates}</dd>
                          </div>
                        )}
                        {cls.startTime && cls.endTime && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Meeting Time:</dt>
                            <dd>{cls.startTime} - {cls.endTime}</dd>
                          </div>
                        )}
                        {cls.startDate && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Start Date:</dt>
                            <dd>{cls.startDate}</dd>
                          </div>
                        )}
                        {cls.endDate && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">End Date:</dt>
                            <dd>{cls.endDate}</dd>
                          </div>
                        )}
                        {cls.location && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Location:</dt>
                            <dd>{cls.location}</dd>
                          </div>
                        )}
                        {cls.room && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Room:</dt>
                            <dd>{cls.room}</dd>
                          </div>
                        )}
                        {cls.term && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Term:</dt>
                            <dd>{cls.term}</dd>
                          </div>
                        )}
                        {cls.credits && (
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Credits:</dt>
                            <dd>{cls.credits}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground">
                        {cls.description || "No description available for this class."}
                      </p>
                      {cls.requirements && (
                        <>
                          <h3 className="text-lg font-medium mt-4 mb-2">Requirements</h3>
                          <p className="text-sm text-muted-foreground">{cls.requirements}</p>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/student/assignments?classId=${cls.id}`}>
                      View Assignments
                    </Link>
                  </Button>
                  {cls.studentJoinLink && (
                    <Button variant="default" asChild>
                      <a href={cls.studentJoinLink?.startsWith('http') ? cls.studentJoinLink : `https://${cls.studentJoinLink}`} target="_blank" rel="noopener noreferrer">
                        Join Virtual Class
                      </a>
                    </Button>
                  )}
                  {cls.syllabus && (
                    <Button variant="outline" asChild>
                      <a href={cls.syllabus} target="_blank" rel="noopener noreferrer">
                        View Syllabus
                      </a>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Book className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  You are not enrolled in any classes
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
} 