"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { Loader2 } from "lucide-react"

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const joinLink = params.joinLink as string
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [classData, setClassData] = useState<any>(null)
  const [linkType, setLinkType] = useState<"student" | "teacher" | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const user = sessionManager.getCurrentUser()
        if (!user || !user.user) {
          // User not logged in, redirect to login
          toast({
            title: "Login required",
            description: "Please log in to join a class",
            variant: "destructive",
          })
          router.push(`/login?redirect=/join/${joinLink}`)
          return
        }
        setCurrentUser(user)

        // Find class by join link
        const allClasses = await storage.getClasses()
        const classByStudentLink = allClasses.find((cls: any) => cls.studentJoinLink && cls.studentJoinLink.includes(joinLink))
        const classByTeacherLink = allClasses.find((cls: any) => cls.teacherJoinLink && cls.teacherJoinLink.includes(joinLink))

        if (classByStudentLink) {
          setClassData(classByStudentLink)
          setLinkType("student")
        } else if (classByTeacherLink) {
          setClassData(classByTeacherLink)
          setLinkType("teacher")
        } else {
          toast({
            title: "Invalid join link",
            description: "The join link you provided is not valid",
            variant: "destructive",
          })
          router.push("/")
          return
        }
      } catch (error: any) {
        console.error("Error loading join data:", error)
        toast({
          title: "Error",
          description: "Failed to load join information",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [joinLink, router, toast])

  const handleJoin = async () => {
    if (!classData || !currentUser) return

    setIsJoining(true)
    try {
      const userId = currentUser.user?.uid || currentUser.id
      const userRole = currentUser.role

      // Check if user has correct role for the link type
      if (linkType === "teacher" && userRole !== "teacher" && userRole !== "admin") {
        toast({
          title: "Access denied",
          description: "This is a teacher join link. Only teachers can use it.",
          variant: "destructive",
        })
        setIsJoining(false)
        return
      }

      if (linkType === "student" && userRole !== "student") {
        toast({
          title: "Access denied",
          description: "This is a student join link. Only students can use it.",
          variant: "destructive",
        })
        setIsJoining(false)
        return
      }

      // Enroll student or assign teacher
      if (linkType === "student") {
        await storage.enrollStudent(classData.id, userId)
        toast({
          title: "Successfully joined class",
          description: `You have been enrolled in ${classData.name}`,
        })
        router.push(`/student/classes`)
      } else if (linkType === "teacher") {
        // For teachers, we might want to assign them to the class
        // This depends on your business logic
        toast({
          title: "Successfully joined class",
          description: `You now have access to ${classData.name}`,
        })
        router.push(`/teacher/dashboard`)
      }
    } catch (error: any) {
      console.error("Error joining class:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to join class",
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Class not found</CardTitle>
            <CardDescription>The join link is invalid or the class no longer exists.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Class</CardTitle>
          <CardDescription>
            {linkType === "teacher" 
              ? "You are joining as a teacher" 
              : "You are joining as a student"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Class Name</Label>
            <p className="text-lg font-semibold">{classData.name}</p>
          </div>
          {classData.teacher && (
            <div>
              <Label>Teacher</Label>
              <p className="text-muted-foreground">{classData.teacher}</p>
            </div>
          )}
          {classData.location && (
            <div>
              <Label>Location</Label>
              <p className="text-muted-foreground">{classData.location}</p>
            </div>
          )}
          <Button 
            onClick={handleJoin} 
            className="w-full" 
            disabled={isJoining}
          >
            {isJoining ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              `Join ${classData.name}`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

