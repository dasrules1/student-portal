"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Search, Download, FileText, Users } from "lucide-react"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface GradeData {
  studentId: string
  studentName: string
  classId: string
  className: string
  contentId: string
  contentTitle: string
  totalScore: number
  maxScore: number
  percentage: number
  submittedAt?: string
}

export default function GradesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("all")
  const [grades, setGrades] = useState<GradeData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
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

    loadData()
  }, [router, toast])

  useEffect(() => {
    if (selectedClassId) {
      loadGrades()
    }
  }, [selectedClassId])

  const loadData = async () => {
    try {
      // Load teacher's classes
      const allClasses = await storage.getClasses()
      const teacherEmail = sessionManager.getCurrentUser()?.user?.email
      const teacherName = sessionManager.getCurrentUser()?.user?.displayName
      const teacherId = sessionManager.getCurrentUser()?.user?.uid

      const teacherClasses = allClasses.filter((cls: any) => {
        return (
          (cls.teacher && cls.teacher.toLowerCase() === teacherName?.toLowerCase()) ||
          (cls.teacher_id && cls.teacher_id === teacherId) ||
          (cls.teacherId && cls.teacherId === teacherId) ||
          (cls.teacher_email && cls.teacher_email === teacherEmail)
        )
      })

      setClasses(teacherClasses)
      if (teacherClasses.length > 0) {
        setSelectedClassId(teacherClasses[0].id)
      }
      setLoading(false)
    } catch (error) {
      console.error("Error loading data:", error)
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const loadGrades = async () => {
    if (!selectedClassId || selectedClassId === "all") {
      // Load grades from all classes
      const allClasses = await storage.getClasses()
      const teacherEmail = sessionManager.getCurrentUser()?.user?.email
      const teacherName = sessionManager.getCurrentUser()?.user?.displayName
      const teacherId = sessionManager.getCurrentUser()?.user?.uid

      const teacherClasses = allClasses.filter((cls: any) => {
        return (
          (cls.teacher && cls.teacher.toLowerCase() === teacherName?.toLowerCase()) ||
          (cls.teacher_id && cls.teacher_id === teacherId) ||
          (cls.teacherId && cls.teacherId === teacherId) ||
          (cls.teacher_email && cls.teacher_email === teacherEmail)
        )
      })

      const allGrades: GradeData[] = []
      for (const cls of teacherClasses) {
        const classGrades = await loadGradesForClass(cls.id)
        allGrades.push(...classGrades)
      }
      setGrades(allGrades)
    } else {
      const classGrades = await loadGradesForClass(selectedClassId)
      setGrades(classGrades)
    }
  }

  const loadGradesForClass = async (classId: string): Promise<GradeData[]> => {
    try {
      const classData = await storage.getClassById(classId)
      if (!classData) return []

      // Get all student answers for this class
      const answersRef = collection(db, "student-answers", classId, "answers")
      const snapshot = await getDocs(answersRef)

      // Group by student and content
      const studentContentMap: Record<string, {
        studentId: string
        studentName: string
        contentId: string
        contentTitle: string
        scores: number[]
        maxScores: number[]
      }> = {}

      snapshot.forEach((doc) => {
        const data = doc.data()
        const key = `${data.studentId}_${data.contentId}`
        
        if (!studentContentMap[key]) {
          studentContentMap[key] = {
            studentId: data.studentId,
            studentName: data.studentName || "Unknown Student",
            contentId: data.contentId,
            contentTitle: data.contentTitle || "Unknown Assignment",
            scores: [],
            maxScores: [],
          }
        }

        if (data.score !== undefined && data.problemPoints !== undefined) {
          studentContentMap[key].scores.push(data.score)
          studentContentMap[key].maxScores.push(data.problemPoints)
        }
      })

      // Get student names
      const allUsers = await storage.getUsers()
      const studentsMap = new Map(allUsers.map((u: any) => [u.id, u.name]))

      // Convert to GradeData array
      const grades: GradeData[] = Object.values(studentContentMap).map((item) => {
        const totalScore = item.scores.reduce((sum, score) => sum + score, 0)
        const maxScore = item.maxScores.reduce((sum, score) => sum + score, 0)
        const studentName = studentsMap.get(item.studentId) || item.studentName

        return {
          studentId: item.studentId,
          studentName,
          classId,
          className: classData.name,
          contentId: item.contentId,
          contentTitle: item.contentTitle,
          totalScore,
          maxScore,
          percentage: maxScore > 0 ? (totalScore / maxScore) * 100 : 0,
        }
      })

      return grades
    } catch (error) {
      console.error("Error loading grades for class:", error)
      return []
    }
  }

  const filteredGrades = grades.filter((grade) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      grade.studentName.toLowerCase().includes(term) ||
      grade.contentTitle.toLowerCase().includes(term) ||
      grade.className.toLowerCase().includes(term)
    )
  })

  const handleExportGrades = () => {
    const headers = ["Student Name", "Class", "Assignment", "Score", "Max Score", "Percentage"]
    const rows = filteredGrades.map((grade) => [
      grade.studentName,
      grade.className,
      grade.contentTitle,
      grade.totalScore.toString(),
      grade.maxScore.toString(),
      `${grade.percentage.toFixed(1)}%`,
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `grades_${selectedClassId === "all" ? "all_classes" : selectedClassId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Grades exported",
      description: "Grades have been exported as CSV",
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  // Calculate statistics
  const totalAssignments = new Set(filteredGrades.map((g) => g.contentId)).size
  const totalStudents = new Set(filteredGrades.map((g) => g.studentId)).size
  const averagePercentage = filteredGrades.length > 0
    ? filteredGrades.reduce((sum, g) => sum + g.percentage, 0) / filteredGrades.length
    : 0

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/teacher/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Grades</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExportGrades}>
            <Download className="w-4 h-4 mr-2" />
            Export Grades
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Grade Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAssignments}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStudents}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{averagePercentage.toFixed(1)}%</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Grade Details</CardTitle>
                  <CardDescription>View and manage student grades across all assignments</CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search students or assignments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Max Score</TableHead>
                    <TableHead>Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No grades found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGrades.map((grade, index) => (
                      <TableRow key={`${grade.studentId}_${grade.contentId}_${index}`}>
                        <TableCell className="font-medium">{grade.studentName}</TableCell>
                        <TableCell>{grade.className}</TableCell>
                        <TableCell>{grade.contentTitle}</TableCell>
                        <TableCell>{grade.totalScore}</TableCell>
                        <TableCell>{grade.maxScore}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              grade.percentage >= 90
                                ? "default"
                                : grade.percentage >= 70
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {grade.percentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

