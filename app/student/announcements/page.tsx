"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { storage } from "@/lib/storage"
import { Class } from "@/lib/types"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { format } from "date-fns"
import {
  Book,
  CheckSquare,
  Cog,
  File,
  LayoutDashboard,
} from "lucide-react"

export default function StudentAnnouncements() {
  const router = useRouter()
  const { authUser, authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [studentClasses, setStudentClasses] = useState<Class[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        
        const sessionUser = sessionManager.getCurrentUser()
        
        let authData = null
        try {
          const storedAuth = localStorage.getItem('authUser')
          if (storedAuth) {
            authData = JSON.parse(storedAuth)
          }
        } catch (e) {
          console.error('Error reading auth from localStorage:', e)
        }
        
        const userId = authUser?.uid || sessionUser?.user?.uid || authData?.uid || storage.getCurrentUserId()
        
        if (!userId) {
          setAuthError("You need to log in to access this page")
          return
        }
        
        let userData = null
        
        try {
          userData = storage.getUserById(userId)
        } catch (storageErr) {
          console.error("Error getting user from storage:", storageErr)
        }
        
        if (!userData && authUser) {
          userData = {
            id: authUser.uid,
            name: authUser.displayName || "Student",
            email: authUser.email,
            role: authRole || "student"
          }
        }
        
        if (!userData && authData) {
          userData = {
            id: authData.uid,
            email: authData.email,
            role: authData.role,
            name: "Student"
          }
        }
        
        if (!userData) {
          setAuthError("Unable to retrieve your user information")
          setLoading(false)
          return
        }
        
        setCurrentUser(userData)
        
        if (userData.role !== "student") {
          setAuthError("This page is only available to student accounts")
          setLoading(false)
          return
        }
        
        // Load all classes
        const allClasses = await storage.getClasses()
        
        if (!allClasses || !Array.isArray(allClasses)) {
          setStudentClasses([])
          setLoading(false)
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.includes(userData.id)
        )
        
        setStudentClasses(enrolledClasses)
        
        // Load announcements for enrolled classes
        try {
          const classIds = enrolledClasses.map((cls: Class) => cls.id)
          if (classIds.length > 0) {
            const announcementsRef = collection(db, "announcements")
            const announcementsQuery = query(
              announcementsRef,
              where("classId", "in", classIds),
              orderBy("createdAt", "desc")
            )
            const announcementsSnapshot = await getDocs(announcementsQuery)
            const announcementsData = announcementsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            setAnnouncements(announcementsData)
          }
        } catch (announcementsError) {
          console.error("Error loading announcements:", announcementsError)
        }
      } catch (error) {
        console.error("Error loading student data:", error)
        setAuthError("There was a problem loading announcements")
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
      current: true,
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
          <p>Loading announcements...</p>
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
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} user={currentUser || undefined} />
      <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <img src="/logo.png" alt="Education More" className="h-8" />
              <h2 className="text-lg font-semibold">Education More</h2>
            </div>
            <h1 className="text-3xl font-bold">Announcements</h1>
            <p className="text-muted-foreground">
              View announcements from your teachers and administrators
            </p>
          </div>
        </div>

        {announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bell className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No announcements at this time</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <Card key={announcement.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle>{announcement.title}</CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{announcement.className || "Unknown Class"}</Badge>
                          {announcement.authorRole && (
                            <Badge variant="secondary">{announcement.authorRole}</Badge>
                          )}
                          <span className="text-sm">
                            By {announcement.authorName} •{" "}
                            {announcement.createdAt
                              ? format(announcement.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
                              : "Recently"}
                          </span>
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{announcement.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

