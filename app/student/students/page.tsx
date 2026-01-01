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
  Search,
  Bell,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { storage } from "@/lib/storage"
import { User, Class } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function StudentStudents() {
  const router = useRouter()
  const { user: authUser, role: authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [classmates, setClassmates] = useState<User[]>([])
  const [allStudents, setAllStudents] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
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
        
        if (!allClasses || !Array.isArray(allClasses)) {
          console.error("No classes found or invalid classes data")
          setStudentClasses([])
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && 
          cls.enrolledStudents.includes(userData.id)
        )
        console.log("Enrolled classes:", enrolledClasses.length)
        
        setStudentClasses(enrolledClasses)
        
        // Load all students
        try {
          const students = await storage.getUsers()
          
          if (students && Array.isArray(students)) {
            // Filter to only include students
            const onlyStudents = students.filter(user => 
              user && user.role === 'student' && user.id !== userData.id
            )
            
            setAllStudents(onlyStudents)
            
            // Find classmates (students in the same classes)
            const classmateIds = new Set<string>()
            
            for (const cls of enrolledClasses) {
              if (cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents)) {
                cls.enrolledStudents.forEach(studentId => {
                  if (studentId !== userData.id) {
                    classmateIds.add(studentId)
                  }
                })
              }
            }
            
            const classmatesList = onlyStudents.filter(student => 
              student && student.id && classmateIds.has(student.id)
            )
            
            setClassmates(classmatesList)
          }
        } catch (error) {
          console.error("Error loading students:", error)
        }
        
      } catch (error) {
        console.error("Error loading student data:", error)
        setAuthError("There was a problem loading the students list")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [authUser, authRole])

  const filteredStudents = searchQuery 
    ? allStudents.filter(student => 
        student && student.name && student.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allStudents

  const filteredClassmates = searchQuery 
    ? classmates.filter(student => 
        student && student.name && student.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : classmates

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
      current: false,
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
      title: "Students",
      href: "/student/students",
      icon: Users,
      current: true,
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
          <p>Loading students...</p>
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
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground">
              Browse classmates and other students
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              className="pl-10"
              placeholder="Search students by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Students Tabs */}
        <Tabs defaultValue="classmates">
          <TabsList className="mb-4">
            <TabsTrigger value="classmates">My Classmates</TabsTrigger>
            <TabsTrigger value="all">All Students</TabsTrigger>
          </TabsList>
          
          <TabsContent value="classmates">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredClassmates.length > 0 ? (
                filteredClassmates.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={student.avatar || undefined} alt={student.name} />
                          <AvatarFallback>{student.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{student.name}</h3>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Shared Classes:</h4>
                        <div className="flex flex-wrap gap-2">
                          {studentClasses
                            .filter(cls => 
                              cls && cls.enrolledStudents && 
                              Array.isArray(cls.enrolledStudents) && 
                              cls.enrolledStudents.includes(student.id)
                            )
                            .map(cls => (
                              <span 
                                key={cls.id} 
                                className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded"
                              >
                                {cls.name}
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No classmates match your search" : "You don't have any classmates yet"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="all">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={student.avatar || undefined} alt={student.name} />
                          <AvatarFallback>{student.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium">{student.name}</h3>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-full">
                  <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "No students match your search" : "No other students found"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 