"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  BookOpen,
  PenTool,
  ClipboardList,
  BookMarked,
  FileQuestion,
  Users,
  Check,
  X,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { GraphEditor } from "@/components/graph-editor"
import { 
  collection, 
  query, 
  where,
  getDocs,
  onSnapshot,
} from 'firebase/firestore'
import type { QuerySnapshot, DocumentData } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// Content types for curriculum
const contentTypes = [
  { id: "new-material", name: "New Material", icon: <BookOpen className="w-4 h-4 mr-2" /> },
  { id: "guided-practice", name: "Guided Practice", icon: <PenTool className="w-4 h-4 mr-2" /> },
  { id: "classwork", name: "Classwork", icon: <ClipboardList className="w-4 h-4 mr-2" /> },
  { id: "homework", name: "Homework", icon: <BookMarked className="w-4 h-4 mr-2" /> },
  { id: "quiz", name: "Quiz", icon: <FileQuestion className="w-4 h-4 mr-2" /> },
  { id: "test", name: "Test", icon: <FileText className="w-4 h-4 mr-2" /> },
]

interface Student {
  id: string
  name: string
  email: string
  avatar?: string
}

interface StudentAnswer {
  studentId: string
  contentId: string
  problemIndex: number
  answer: string
  score: number
  correct: boolean
  updatedAt: any
  problemType?: string
  problemPoints?: number
}

export default function AdminClassProgress() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string

  const [currentClass, setCurrentClass] = useState<any>(null)
  const [curriculum, setCurriculum] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [studentAnswers, setStudentAnswers] = useState<Record<string, StudentAnswer[]>>({})
  const [activeLesson, setActiveLesson] = useState(0)
  const [activeContent, setActiveContent] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load class data
  useEffect(() => {
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You must be logged in as an admin to view this page",
        variant: "destructive",
      })
      router.push("/admin/dashboard")
      return
    }

    const loadData = async () => {
      try {
        // Load class
        const foundClass = await storage.getClassById(classId)
        if (!foundClass) {
          toast({
            title: "Class not found",
            description: "The requested class could not be found.",
            variant: "destructive",
          })
          router.push("/admin/dashboard?tab=all-classes")
          return
        }
        setCurrentClass(foundClass)

        // Load curriculum
        const curriculumData = await storage.getCurriculum(classId, 'admin')
        if (curriculumData) {
          setCurriculum(curriculumData.content || curriculumData)
        }

        // Load enrolled students
        const allUsers = await storage.getUsers()
        const enrolledStudents = allUsers.filter(
          (user: any) => user.role === "student" && 
            (user.classes?.includes(classId) ||
              (foundClass.enrolledStudents && foundClass.enrolledStudents.includes(user.id)))
        )
        setStudents(enrolledStudents)

        setIsLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load class data. Please try again.",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    loadData()
  }, [classId, router, toast])

  // Load student answers when content is selected
  useEffect(() => {
    if (!activeContent?.id || !classId) return

    const answersQuery = query(
      collection(db, `student-answers/${classId}/answers`),
      where('contentId', '==', activeContent.id)
    )

    const unsubscribe = onSnapshot(answersQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const answers: Record<string, StudentAnswer[]> = {}
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as StudentAnswer
        const studentId = data.studentId
        
        if (!answers[studentId]) {
          answers[studentId] = []
        }
        answers[studentId].push(data)
      })
      
      setStudentAnswers(answers)
    })

    return () => unsubscribe()
  }, [activeContent?.id, classId])

  // Render content type icon
  const renderContentTypeIcon = (type: string | undefined) => {
    if (!type) return <FileText className="w-4 h-4 mr-2" />
    const contentType = contentTypes.find((ct) => ct.id === type)
    return contentType?.icon || <FileText className="w-4 h-4 mr-2" />
  }

  // Calculate student progress for a content item
  const calculateStudentProgress = (studentId: string, content: any) => {
    const answers = studentAnswers[studentId] || []
    const totalProblems = content.problems?.length || 0
    const answeredProblems = answers.filter(a => a.contentId === content.id).length
    const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0)
    const maxScore = content.problems?.reduce((sum: number, p: any) => sum + (p.points || 1), 0) || 0
    
    return {
      answered: answeredProblems,
      total: totalProblems,
      score: totalScore,
      maxScore: maxScore,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
    }
  }

  // Get status badge
  const getStatusBadge = (progress: { answered: number; total: number; percentage: number }) => {
    if (progress.answered === 0) {
      return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" />Not Started</Badge>
    }
    if (progress.answered < progress.total) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>
    }
    return <Badge variant="default" className="bg-green-500"><Check className="w-3 h-3 mr-1" />{progress.percentage}%</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading class progress...</p>
      </div>
    )
  }

  if (!currentClass || !curriculum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Class or curriculum not found</p>
      </div>
    )
  }

  const lessons = curriculum.lessons || []
  const currentLesson = lessons[activeLesson] || null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container py-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 space-y-4 md:flex-row md:items-center md:space-y-0">
          <div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/dashboard?tab=all-classes">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to All Classes
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{currentClass.name} - Student Progress</h1>
            <p className="text-muted-foreground">Teacher: {currentClass.teacher} | Students: {students.length}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/admin/curriculum/${classId}`)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Edit Curriculum
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Lesson sidebar */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>{lessons.length} lessons</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {lessons.map((lesson: any, index: number) => (
                    <Button
                      key={lesson.id || index}
                      variant={activeLesson === index ? "default" : "ghost"}
                      className="justify-start w-full"
                      onClick={() => {
                        setActiveLesson(index)
                        setActiveContent(null)
                      }}
                    >
                      <span className="mr-2">{index + 1}.</span>
                      {lesson.title || `Lesson ${index + 1}`}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content area */}
          <div className="md:col-span-9">
            {currentLesson ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Lesson {activeLesson + 1}: {currentLesson.title}</CardTitle>
                    <CardDescription>{currentLesson.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {currentLesson.contents?.length > 0 ? (
                        currentLesson.contents.map((content: any) => (
                          <Card
                            key={content.id}
                            className={`cursor-pointer transition-colors ${activeContent?.id === content.id ? "border-primary" : "hover:bg-slate-50"}`}
                            onClick={() => setActiveContent(content)}
                          >
                            <CardHeader className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  {renderContentTypeIcon(content.type)}
                                  <div>
                                    <CardTitle className="text-base">{content.title}</CardTitle>
                                    <CardDescription className="text-xs">
                                      {content.problems?.length || 0} problems
                                    </CardDescription>
                                  </div>
                                </div>
                                <Badge variant={content.isPublished ? "default" : "outline"}>
                                  {content.isPublished ? "Published" : "Draft"}
                                </Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No content in this lesson yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Student Progress Table */}
                {activeContent && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Student Progress: {activeContent.title}</CardTitle>
                      <CardDescription>
                        View how students are performing on this content
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {students.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No students enrolled in this class yet.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-100 dark:bg-slate-800">
                                <th className="p-3 text-left">Student</th>
                                {activeContent.problems?.map((problem: any, index: number) => (
                                  <th key={index} className="p-3 text-center">
                                    P{index + 1}
                                    <div className="text-xs font-normal text-muted-foreground">
                                      ({problem.points || 1} pts)
                                    </div>
                                  </th>
                                ))}
                                <th className="p-3 text-center">Total</th>
                                <th className="p-3 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {students.map((student) => {
                                const answers = studentAnswers[student.id] || []
                                const progress = calculateStudentProgress(student.id, activeContent)
                                
                                return (
                                  <tr key={student.id} className="border-b">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                          {student.avatar || student.name.charAt(0)}
                                        </div>
                                        <div>
                                          <div className="font-medium">{student.name}</div>
                                          <div className="text-xs text-muted-foreground">{student.email}</div>
                                        </div>
                                      </div>
                                    </td>
                                    {activeContent.problems?.map((problem: any, index: number) => {
                                      const answer = answers.find(a => a.problemIndex === index)
                                      const maxPoints = problem.points || 1
                                      
                                      return (
                                        <td key={index} className="p-3 text-center">
                                          {answer ? (
                                            <div className="flex flex-col items-center">
                                              {problem.type === 'geometric' && answer.answer ? (
                                                <div className="w-24 h-24">
                                                  {(() => {
                                                    try {
                                                      const graphData = typeof answer.answer === 'string' 
                                                        ? JSON.parse(answer.answer) 
                                                        : answer.answer
                                                      return (
                                                        <div className="transform scale-[0.3] origin-top-left">
                                                          <GraphEditor
                                                            value={{
                                                              points: graphData.points || [],
                                                              lines: graphData.lines || []
                                                            }}
                                                            readonly={true}
                                                          />
                                                        </div>
                                                      )
                                                    } catch {
                                                      return <span className="text-xs">Graph</span>
                                                    }
                                                  })()}
                                                </div>
                                              ) : (
                                                <span className={`text-sm ${answer.correct ? "text-green-600" : "text-red-600"}`}>
                                                  {answer.answer?.toString().substring(0, 20) || "-"}
                                                  {answer.answer?.toString().length > 20 ? "..." : ""}
                                                </span>
                                              )}
                                              <span className="text-xs text-muted-foreground">
                                                {answer.score}/{maxPoints}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </td>
                                      )
                                    })}
                                    <td className="p-3 text-center font-semibold">
                                      {progress.score}/{progress.maxScore}
                                      <div className="text-xs text-muted-foreground">
                                        {progress.percentage}%
                                      </div>
                                    </td>
                                    <td className="p-3 text-center">
                                      {getStatusBadge(progress)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border rounded-lg">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Select a Lesson</h3>
                  <p className="text-muted-foreground">
                    Choose a lesson from the sidebar to view student progress
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
