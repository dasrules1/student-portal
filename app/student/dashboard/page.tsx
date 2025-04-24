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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { storage } from "@/lib/storage"
import { Activity } from "@/components/activity"
import { User, Class } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"

export default function StudentDashboard() {
  const router = useRouter()
  const { user: authUser, role: authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [assignmentsByClass, setAssignmentsByClass] = useState<Record<string, any[]>>({})
  const [pendingAssignments, setPendingAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        // Try to get user from multiple sources
        const sessionUser = sessionManager.getCurrentUser()
        console.log("Session user:", sessionUser)
        
        // Try local storage as a fallback
        let authData = null
        try {
          const storedAuth = localStorage.getItem('authUser')
          if (storedAuth) {
            authData = JSON.parse(storedAuth)
            console.log("Auth data from localStorage:", authData)
          }
        } catch (e) {
          console.error('Error reading auth from localStorage:', e)
        }
        
        // Get user ID from available sources
        const userId = authUser?.uid || sessionUser?.user?.uid || authData?.uid || storage.getCurrentUserId()
        console.log("Using user ID:", userId)
        
        if (!userId) {
          console.error("No user ID found, redirecting to login")
          setAuthError("You need to log in to access this page")
          return
        }
        
        // Get user data
        let userData = null
        
        // Try storage first
        try {
          userData = storage.getUserById(userId)
          console.log("User data from storage:", userData)
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
          console.log("Using auth user directly:", userData)
        }
        
        // Last attempt using local storage data
        if (!userData && authData) {
          userData = {
            id: authData.uid,
            email: authData.email,
            role: authData.role,
            name: "Student"
          }
          console.log("Using localStorage auth data:", userData)
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
          setAuthError("This dashboard is only available to student accounts")
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
          setAssignmentsByClass({})
          setPendingAssignments([])
          setLoading(false)
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.includes(userData.id)
        )
        console.log("Enrolled classes:", enrolledClasses.length)
        
        setStudentClasses(enrolledClasses)
        
        // Load assignments for each class
        const assignmentsTemp: Record<string, any[]> = {}
        const pendingTemp: any[] = []
        
        for (const cls of enrolledClasses) {
          if (cls && cls.curriculum) {
            try {
              // Try to load full curriculum data
              const curriculum = await storage.getCurriculum(cls.id)
              const curriculumData = curriculum || cls.curriculum
              
              if (curriculumData && curriculumData.lessons && Array.isArray(curriculumData.lessons)) {
                // Find all published assignments across lessons
                const classAssignments = curriculumData.lessons.flatMap(lesson => {
                  if (!lesson || !lesson.contents || !Array.isArray(lesson.contents)) return []
                  
                  return lesson.contents
                    .filter(content => 
                      content && content.isPublished && 
                      (content.type === 'assignment' || content.type === 'quiz')
                    )
                    .map(content => ({
                      ...content,
                      lessonTitle: lesson.title || 'Unnamed Lesson',
                      lessonId: lesson.id,
                      classId: cls.id,
                      className: cls.name || 'Unnamed Class',
                      teacher: cls.teacher || 'Unnamed Teacher'
                    }))
                })
                
                assignmentsTemp[cls.id] = classAssignments
                
                // Add assignments without completed status to pending list
                const pending = classAssignments.filter(
                  assignment => !assignment.completed && assignment.dueDate && new Date(assignment.dueDate) > new Date()
                )
                pendingTemp.push(...pending)
              }
            } catch (error) {
              console.error(`Error loading curriculum for class ${cls.id}:`, error)
            }
          }
        }
        
        setAssignmentsByClass(assignmentsTemp)
        setPendingAssignments(pendingTemp.sort((a, b) => 
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        ))
      } catch (error) {
        console.error("Error loading student data:", error)
        setAuthError("There was a problem loading your dashboard")
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
      current: true,
    },
    {
      title: "Classes",
      href: "/student/classes",
      icon: Book,
      current: false,
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
          <p>Loading dashboard...</p>
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
                This dashboard is only available to student accounts.
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
            <h1 className="text-3xl font-bold">Student Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {currentUser.name}!
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" asChild>
              <Link href="/student/settings">View Profile</Link>
            </Button>
          </div>
        </div>

        {/* Pending Assignments */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Pending Assignments</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/assignments">View All</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingAssignments.length > 0 ? (
              pendingAssignments.slice(0, 3).map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    <CardDescription>
                      {assignment.className} • Due: {new Date(assignment.dueDate).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        Start Assignment
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No pending assignments</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Enrolled Classes */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Classes</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {studentClasses.length > 0 ? (
              studentClasses.map((cls) => (
                <Card key={cls.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{cls.name}</CardTitle>
                    <CardDescription>
                      Teacher: {cls.teacher}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Schedule:</span>
                        <span>{cls.meeting_day || cls.meetingDates || "Not specified"}</span>
                      </div>
                      {cls.startTime && cls.endTime && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Time:</span>
                          <span>{cls.startTime} - {cls.endTime}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Assignments:</span>
                        <span>{assignmentsByClass[cls.id]?.length || 0} total</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" asChild>
                      <Link href={`/student/curriculum/${cls.id}`}>
                        View Curriculum
                      </Link>
                    </Button>
                    {cls.virtualLink && (
                      <Button variant="default" asChild>
                        <a href={cls.virtualLink} target="_blank" rel="noopener noreferrer">
                          Join Class
                        </a>
                      </Button>
                    )}
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
        </section>

        {/* Recent Activity */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          <Card>
            <CardContent className="p-6">
              <Activity studentId={currentUser.id} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
