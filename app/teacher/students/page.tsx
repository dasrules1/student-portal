"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Search, Mail, User, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"

export default function TeacherStudentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState(null)
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    // Check if user is a teacher
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "teacher") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a teacher to view this page",
        variant: "destructive",
      })
      router.push("/staff-portal")
      return
    }

    setCurrentUser(user)

    // Get all classes taught by this teacher
    const userId = user?.user?.uid
    const userName = user?.user?.displayName || ""
    const allClasses = storage.getAllClasses()
    const teacherClasses = allClasses.filter((cls) => cls.teacher_id === userId || cls.teacher === userName)
    setClasses(teacherClasses)

    // Get all students
    const allUsers = storage.getAllUsers()
    const allStudents = allUsers.filter((u) => u.role === "student")

    // Filter students to only those enrolled in this teacher's classes
    const enrolledStudentIds = new Set()
    teacherClasses.forEach((cls) => {
      if (cls.enrolledStudents) {
        cls.enrolledStudents.forEach((id) => enrolledStudentIds.add(id))
      }
    })

    const teacherStudents = allStudents.filter((student) => {
      // Check if student is enrolled in any of teacher's classes
      return (
        enrolledStudentIds.has(student.id) ||
        student.classes.some((classId) => teacherClasses.some((cls) => cls.id === classId))
      )
    })

    setStudents(teacherStudents)
  }, [router, toast])

  // Filter students based on search term and active tab
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase())

    if (activeTab === "all") {
      return matchesSearch
    }

    // Filter by class if a specific class tab is selected
    return (
      matchesSearch &&
      (student.classes.includes(activeTab) ||
        classes.find((cls) => cls.id === activeTab)?.enrolledStudents?.includes(student.id))
    )
  })

  // Get class name by ID
  const getClassName = (classId) => {
    const cls = classes.find((c) => c.id === classId)
    return cls ? cls.name : "Unknown Class"
  }

  if (!currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

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
          <h1 className="text-3xl font-bold">Students</h1>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All Students</TabsTrigger>
          {classes.map((cls) => (
            <TabsTrigger key={cls.id} value={cls.id}>
              {cls.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Students</CardTitle>
              <CardDescription>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} enrolled in your classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredStudents.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredStudents.map((student) => (
                    <Card key={student.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-4">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback>{student.avatar}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <h3 className="font-medium">{student.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Mail className="w-3 h-3 mr-1" />
                              {student.email}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {student.classes.map((classId) => (
                                <Badge key={classId} variant="outline">
                                  {getClassName(classId)}
                                </Badge>
                              ))}
                              {classes
                                .filter((cls) => cls.enrolledStudents && cls.enrolledStudents.includes(student.id))
                                .map((cls) => (
                                  <Badge key={cls.id} variant="outline">
                                    {cls.name}
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <User className="w-12 h-12 mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No students found</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {searchTerm
                      ? "No students match your search criteria."
                      : "You don't have any students enrolled in your classes yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {classes.map((cls) => (
          <TabsContent key={cls.id} value={cls.id} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{cls.name} Students</CardTitle>
                <CardDescription>
                  {
                    filteredStudents.filter(
                      (student) =>
                        student.classes.includes(cls.id) ||
                        (cls.enrolledStudents && cls.enrolledStudents.includes(student.id)),
                    ).length
                  }{" "}
                  student
                  {filteredStudents.filter(
                    (student) =>
                      student.classes.includes(cls.id) ||
                      (cls.enrolledStudents && cls.enrolledStudents.includes(student.id)),
                  ).length !== 1
                    ? "s"
                    : ""}{" "}
                  enrolled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredStudents.filter(
                  (student) =>
                    student.classes.includes(cls.id) ||
                    (cls.enrolledStudents && cls.enrolledStudents.includes(student.id)),
                ).length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredStudents
                      .filter(
                        (student) =>
                          student.classes.includes(cls.id) ||
                          (cls.enrolledStudents && cls.enrolledStudents.includes(student.id)),
                      )
                      .map((student) => (
                        <Card key={student.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-4">
                              <Avatar className="w-12 h-12">
                                <AvatarFallback>{student.avatar}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-1">
                                <h3 className="font-medium">{student.name}</h3>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {student.email}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <UserPlus className="w-12 h-12 mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium">No students enrolled</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {searchTerm
                        ? "No students match your search criteria."
                        : "There are no students enrolled in this class yet."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
