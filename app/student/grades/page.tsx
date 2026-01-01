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
import { storage } from "@/lib/storage"
import { User, Class } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function StudentGrades() {
  const router = useRouter()
  const { user: authUser, role: authRole } = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [studentClasses, setStudentClasses] = useState<Class[]>([])
  const [gradeData, setGradeData] = useState<any[]>([])
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
          setGradeData([])
          setLoading(false)
          return
        }
        
        // Filter classes to only include those the student is enrolled in
        const enrolledClasses = allClasses.filter((cls: Class) => 
          cls && cls.enrolledStudents && Array.isArray(cls.enrolledStudents) && cls.enrolledStudents.includes(userData.id)
        )
        console.log("Enrolled classes:", enrolledClasses.length)
        
        setStudentClasses(enrolledClasses)

        // Load grades from Firestore student-answers collection
        const gradesTemp: any[] = []
        
        if (db && userData.id) {
          for (const cls of enrolledClasses) {
            if (cls && cls.id) {
              try {
                // Query all student answers for this class
                const answersRef = collection(db, 'student-answers', cls.id, 'answers');
                const q = query(answersRef, where('studentId', '==', userData.id));
                const querySnapshot = await getDocs(q);
                
                // Group answers by contentId
                const answersByContent: Record<string, any[]> = {};
                querySnapshot.forEach((doc) => {
                  const data = doc.data();
                  const contentId = data.contentId;
                  if (contentId) {
                    if (!answersByContent[contentId]) {
                      answersByContent[contentId] = [];
                    }
                    answersByContent[contentId].push(data);
                  }
                });
                
                // Load curriculum to get content titles
                const curriculum = await storage.getCurriculum(cls.id, 'student');
                
                // Process each content's answers
                for (const [contentId, answers] of Object.entries(answersByContent)) {
                  // Only include submitted/completed answers
                  const submittedAnswers = answers.filter(a => 
                    a.submitted === true || 
                    a.status === 'submitted' || 
                    a.status === 'completed'
                  );
                  
                  if (submittedAnswers.length > 0) {
                    // Calculate total score
                    const totalScore = submittedAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
                    const maxScore = submittedAnswers.reduce((sum, a) => sum + (a.problemPoints || 1), 0);
                    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
                    
                    // Find content title from curriculum
                    let contentTitle = "Unknown Assignment";
                    let contentType = "assignment";
                    if (curriculum && curriculum.content && curriculum.content.lessons) {
                      for (const lesson of curriculum.content.lessons) {
                        if (lesson.contents) {
                          const content = lesson.contents.find((c: any) => c.id === contentId);
                          if (content) {
                            contentTitle = content.title || contentTitle;
                            contentType = content.type || contentType;
                            break;
                          }
                        }
                      }
                    }
                    
                    // Get the most recent submission date
                    const latestAnswer = submittedAnswers.sort((a, b) => {
                      const aTime = a.updatedAt?.toDate?.() || a.timestamp?.toDate?.() || new Date(0);
                      const bTime = b.updatedAt?.toDate?.() || b.timestamp?.toDate?.() || new Date(0);
                      return bTime.getTime() - aTime.getTime();
                    })[0];
                    
                    const submittedAt = latestAnswer?.updatedAt?.toDate?.() || 
                                      latestAnswer?.timestamp?.toDate?.() || 
                                      latestAnswer?.submittedAt?.toDate?.() ||
                                      new Date();
                    
                    gradesTemp.push({
                      classId: cls.id,
                      className: cls.name,
                      contentId,
                      title: contentTitle,
                      score: percentage,
                      submittedAt: submittedAt,
                      type: contentType
                    });
                  }
                }
              } catch (error) {
                console.error(`Error loading grades for class ${cls.id}:`, error);
              }
            }
          }
        }
        
        // Sort grades by submission date (newest first)
        gradesTemp.sort((a, b) => {
          const aTime = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt);
          const bTime = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt);
          return bTime.getTime() - aTime.getTime();
        });
        
        setGradeData(gradesTemp)
        
      } catch (error) {
        console.error("Error loading student grades:", error)
        setAuthError("There was a problem loading your grades")
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
      current: false,
    },
    {
      title: "Grades",
      href: "/student/grades",
      icon: File,
      current: true,
    },
    {
      title: "Settings",
      href: "/student/settings",
      icon: Cog,
      current: false,
    },
  ]

  // Calculate average score
  const averageScore = gradeData.length > 0
    ? Math.round(gradeData.reduce((sum, grade) => sum + grade.score, 0) / gradeData.length)
    : 0

  // Group grades by class
  const gradesByClass = gradeData.reduce((acc, grade) => {
    if (!acc[grade.classId]) {
      acc[grade.classId] = {
        className: grade.className,
        grades: []
      }
    }
    acc[grade.classId].grades.push(grade)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser || undefined} />
        <div className="flex items-center justify-center flex-1">
          <p>Loading grades...</p>
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
              <img src="/logo.png" alt="Education More" className="h-8" />
              <h2 className="text-lg font-semibold">Education More</h2>
            </div>
            <h1 className="text-3xl font-bold">Grades</h1>
            <p className="text-muted-foreground">
              View your grades and academic progress
            </p>
          </div>
        </div>

        {/* Summary Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Grade Summary</CardTitle>
            <CardDescription>Your overall academic performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold">{averageScore}%</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-muted-foreground">Completed Assignments</p>
                <p className="text-2xl font-bold">{gradeData.length}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-muted-foreground">Enrolled Classes</p>
                <p className="text-2xl font-bold">{studentClasses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grades By Class */}
        {Object.keys(gradesByClass).length > 0 ? (
          Object.keys(gradesByClass).map(classId => (
            <Card key={classId} className="mb-6">
              <CardHeader>
                <CardTitle>{gradesByClass[classId].className}</CardTitle>
                <CardDescription>All grades for this class</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date Submitted</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradesByClass[classId].grades.map((grade, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{grade.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {grade.type === 'quiz' ? 'Quiz' : 'Assignment'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(grade.submittedAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`${
                            grade.score >= 90 ? 'bg-green-500' : 
                            grade.score >= 70 ? 'bg-yellow-500' : 
                            'bg-red-500'
                          }`}>
                            {grade.score}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <File className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No grades available yet</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/student/assignments">View Available Assignments</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 