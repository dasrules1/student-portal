"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { storage } from "@/lib/storage"
import { supabase } from "@/lib/supabase/client"

export function DataMigration() {
  const [isMigrating, setIsMigrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleMigration = async () => {
    setIsMigrating(true)
    setProgress(0)
    setStatus("Starting migration...")
    setError("")
    setSuccess(false)

    try {
      // Step 1: Migrate users
      setStatus("Migrating users...")
      setProgress(10)

      const users = storage.getUsers()
      let userCount = 0

      for (const user of users) {
        try {
          // Check if user already exists in Supabase
          const { data: existingUsers } = await supabase.from("users").select("id").eq("email", user.email).limit(1)

          if (existingUsers && existingUsers.length > 0) {
            // User already exists, skip
            continue
          }

          // Create user in Supabase Auth
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password || "password123", // Default password if none exists
            email_confirm: true,
          })

          if (authError) {
            console.error(`Error creating auth user ${user.email}:`, authError)
            continue
          }

          // Create user profile
          const { error: profileError } = await supabase.from("users").insert([
            {
              id: authUser.user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              avatar: user.avatar,
              status: user.status,
            },
          ])

          if (profileError) {
            console.error(`Error creating user profile ${user.email}:`, profileError)
            continue
          }

          userCount++
        } catch (err) {
          console.error(`Error migrating user ${user.email}:`, err)
        }
      }

      setStatus(`Migrated ${userCount} users`)
      setProgress(30)

      // Step 2: Migrate classes
      setStatus("Migrating classes...")
      const classes = storage.getClasses()
      let classCount = 0

      for (const cls of classes) {
        try {
          // Find the teacher's Supabase ID
          const { data: teacherData } = await supabase.from("users").select("id").eq("name", cls.teacher).limit(1)

          const teacherId = teacherData && teacherData.length > 0 ? teacherData[0].id : null

          if (!teacherId) {
            console.error(`Teacher not found for class ${cls.name}`)
            continue
          }

          // Check if class already exists
          const { data: existingClasses } = await supabase
            .from("classes")
            .select("id")
            .eq("name", cls.name)
            .eq("teacher_id", teacherId)
            .limit(1)

          if (existingClasses && existingClasses.length > 0) {
            // Class already exists, skip
            continue
          }

          // Create class
          const { data: classData, error: classError } = await supabase
            .from("classes")
            .insert([
              {
                name: cls.name,
                subject: cls.subject || "",
                teacher_id: teacherId,
                location: cls.location || "",
                meeting_day: cls.meetingDay || "",
                start_time: cls.startTime || "",
                end_time: cls.endTime || "",
                virtual_link: cls.virtualLink || "",
                status: cls.status || "active",
              },
            ])
            .select()

          if (classError) {
            console.error(`Error creating class ${cls.name}:`, classError)
            continue
          }

          const newClassId = classData[0].id

          // Migrate enrollments
          if (cls.enrolledStudents && cls.enrolledStudents.length > 0) {
            for (const studentId of cls.enrolledStudents) {
              // Find the student's Supabase ID
              const { data: studentData } = await supabase.from("users").select("id").eq("role", "student").limit(1)

              const supabaseStudentId = studentData && studentData.length > 0 ? studentData[0].id : null

              if (!supabaseStudentId) {
                console.error(`Student not found for enrollment in class ${cls.name}`)
                continue
              }

              // Create enrollment
              await supabase.from("class_enrollments").insert([
                {
                  class_id: newClassId,
                  student_id: supabaseStudentId,
                },
              ])
            }
          }

          // Migrate curriculum
          const curriculum = storage.getCurriculum(cls.id)
          if (curriculum) {
            await supabase.from("curriculum").insert([
              {
                class_id: newClassId,
                content: curriculum,
              },
            ])
          }

          classCount++
        } catch (err) {
          console.error(`Error migrating class ${cls.name}:`, err)
        }
      }

      setStatus(`Migrated ${classCount} classes`)
      setProgress(60)

      // Step 3: Migrate activity logs
      setStatus("Migrating activity logs...")
      const activityLogs = storage.getActivityLogs()
      let logCount = 0

      for (const log of activityLogs) {
        try {
          // Create activity log
          const { error: logError } = await supabase.from("activity_logs").insert([
            {
              action: log.action,
              details: log.details,
              category: log.category,
              created_at: new Date(log.timestamp).toISOString(),
            },
          ])

          if (logError) {
            console.error(`Error creating activity log:`, logError)
            continue
          }

          logCount++
        } catch (err) {
          console.error(`Error migrating activity log:`, err)
        }
      }

      setStatus(`Migrated ${logCount} activity logs`)
      setProgress(90)

      // Migration complete
      setStatus("Migration complete!")
      setProgress(100)
      setSuccess(true)
    } catch (err) {
      console.error("Migration error:", err)
      setError(`Migration failed: ${err.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Data Migration</CardTitle>
        <CardDescription>Migrate your existing data from localStorage to Supabase database</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>Data migration completed successfully!</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Migration Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>

          {status && (
            <div className="p-4 border rounded-md">
              <p className="font-medium">Status:</p>
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          )}

          <div className="p-4 border rounded-md">
            <p className="font-medium">Migration Steps:</p>
            <ol className="mt-2 ml-4 text-sm text-muted-foreground list-decimal">
              <li>Migrate user accounts</li>
              <li>Migrate classes and enrollments</li>
              <li>Migrate curriculum data</li>
              <li>Migrate activity logs</li>
            </ol>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleMigration} disabled={isMigrating} className="w-full">
          {isMigrating ? "Migrating..." : "Start Migration"}
        </Button>
      </CardFooter>
    </Card>
  )
}
