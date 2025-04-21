"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase/client"
import { auth } from "@/lib/supabase/auth"
import { createClass } from "@/lib/supabase/classes"
import { persistentStorage } from "@/lib/persistentStorage"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function InitializeDbPage() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  const resetDatabase = async () => {
    setIsResetting(true)
    setStatus("Starting database reset...")
    setError("")
    setResetSuccess(false)

    try {
      // Step 1: Delete all data from Supabase tables
      setStatus("Deleting all data from database...")

      // Delete in the correct order to avoid foreign key constraints
      // First delete enrollments
      const { error: enrollmentError } = await supabase.from("class_enrollments").delete().neq("id", "0")
      if (enrollmentError) {
        console.warn("Error deleting enrollments:", enrollmentError)
      }

      // Delete curriculum
      const { error: curriculumError } = await supabase.from("curriculum").delete().neq("id", "0")
      if (curriculumError) {
        console.warn("Error deleting curriculum:", curriculumError)
      }

      // Delete classes
      const { error: classesError } = await supabase.from("classes").delete().neq("id", "0")
      if (classesError) {
        console.warn("Error deleting classes:", classesError)
      }

      // Delete users (except the one we're using)
      const { error: usersError } = await supabase.from("users").delete().neq("id", "0")
      if (usersError) {
        console.warn("Error deleting users:", usersError)
      }

      // Step 2: Reset local storage
      setStatus("Resetting local storage...")
      if (typeof window !== "undefined") {
        // Clear all localStorage items that start with educationmore_
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("educationmore_")) {
            localStorage.removeItem(key)
          }
        })

        // Also clear any curriculum items
        Object.keys(localStorage).forEach((key) => {
          if (key.includes("curriculum")) {
            localStorage.removeItem(key)
          }
        })
      }

      // Step 3: Create the admin user
      setStatus("Creating admin user...")
      const {
        success: adminSuccess,
        error: adminError,
        userId,
      } = await auth.createUser({
        email: "dylan.sood@gmail.com",
        password: "Banking!123",
        name: "Dylan Sood",
        role: "admin",
      })

      if (!adminSuccess) {
        throw new Error(`Failed to create admin user: ${adminError}`)
      }

      // Also create in local storage
      try {
        persistentStorage.addUser({
          name: "Dylan Sood",
          email: "dylan.sood@gmail.com",
          password: "Banking!123",
          role: "admin",
          status: "active",
          avatar: "DS",
          classes: [],
        })
      } catch (localError) {
        console.warn("Error creating admin in local storage:", localError)
      }

      setStatus("Database reset successfully!")
      setResetSuccess(true)
    } catch (err: any) {
      console.error("Database reset error:", err)
      setError(err.message || "An unexpected error occurred")
      setStatus("Reset failed")
    } finally {
      setIsResetting(false)
    }
  }

  const initializeDatabase = async () => {
    setIsInitializing(true)
    setProgress(0)
    setStatus("Starting database initialization...")
    setError("")
    setSuccess(false)

    try {
      // First, check if the users table exists
      setStatus("Checking database schema...")

      try {
        // Try to run the schema.sql file
        setStatus("Creating database schema...")

        // Get the schema SQL from the schema.sql file
        const schemaResponse = await fetch("/api/get-schema")
        if (!schemaResponse.ok) {
          throw new Error("Failed to fetch schema SQL")
        }

        const { sql } = await schemaResponse.json()

        // Execute the schema SQL
        const { error: schemaError } = await supabase.rpc("exec_sql", { sql_query: sql })
        if (schemaError) {
          throw new Error(`Error creating schema: ${schemaError.message}`)
        }

        setStatus("Database schema created successfully")
      } catch (schemaError) {
        console.error("Schema creation error:", schemaError)
        setStatus("Using existing schema or continuing with initialization...")
        // Continue with the initialization process even if schema creation fails
      }

      setProgress(10)

      // Step 1: Create admin users
      setStatus("Creating admin users...")
      setProgress(15)

      // Create first admin user
      const admin1 = await createAdminIfNotExists("admin@educationmore.org", "admin123", "Admin User")
      setProgress(20)

      // Create second admin user (Dylan - Gmail)
      const admin2 = await createAdminIfNotExists("dylan.sood@gmail.com", "Banking!123", "Dylan Sood")
      setProgress(25)

      // Create third admin user (Dylan - Education More)
      const admin3 = await createAdminIfNotExists("dylan.sood@educationmore.org", "Banking!123", "Dylan Sood")
      setProgress(30)

      setStatus("Admin users created or already exist")
      setProgress(40)

      // Step 2: Create test teacher
      setStatus("Creating test teacher account...")

      // Check if teacher already exists
      const { data: existingTeachers, error: teacherCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("email", "teacher@educationmore.org")
        .limit(1)

      let teacherId = null

      if (teacherCheckError) {
        console.warn(`Error checking for teacher user: ${teacherCheckError.message}`)
        // Continue with local storage fallback
      }

      if (!existingTeachers || existingTeachers.length === 0) {
        try {
          // Create teacher user through auth API
          const {
            success: teacherSuccess,
            error: teacherError,
            userId,
          } = await auth.createUser({
            email: "teacher@educationmore.org",
            password: "teacher123",
            name: "Test Teacher",
            role: "teacher",
          })

          if (teacherSuccess && userId) {
            teacherId = userId
          } else {
            console.warn(`Error creating teacher user: ${teacherError}`)
            // Continue with local storage fallback
          }
        } catch (err) {
          console.warn("Error creating teacher:", err)
          // Continue with local storage fallback
        }
      } else {
        teacherId = existingTeachers[0].id
      }

      setStatus("Teacher user created or already exists")
      setProgress(60)

      // Step 3: Create test student
      setStatus("Creating test student account...")

      // Check if student already exists
      const { data: existingStudents, error: studentCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("email", "student@educationmore.org")
        .limit(1)

      let studentId = null

      if (studentCheckError) {
        console.warn(`Error checking for student user: ${studentCheckError.message}`)
        // Continue with local storage fallback
      }

      if (!existingStudents || existingStudents.length === 0) {
        try {
          // Create student user through auth API
          const {
            success: studentSuccess,
            error: studentError,
            userId,
          } = await auth.createUser({
            email: "student@educationmore.org",
            password: "student123",
            name: "Test Student",
            role: "student",
          })

          if (studentSuccess && userId) {
            studentId = userId
          } else {
            console.warn(`Error creating student user: ${studentError}`)
            // Continue with local storage fallback
          }
        } catch (err) {
          console.warn("Error creating student:", err)
          // Continue with local storage fallback
        }
      } else {
        studentId = existingStudents[0].id
      }

      setStatus("Student user created or already exists")
      setProgress(80)

      // Step 4: Create test class in Supabase
      setStatus("Creating test class in database...")

      if (teacherId) {
        try {
          // Check if class already exists
          const { data: existingClasses, error: classCheckError } = await supabase
            .from("classes")
            .select("id")
            .eq("name", "Math 101")
            .limit(1)

          let classId = null

          if (classCheckError) {
            console.warn(`Error checking for class: ${classCheckError.message}`)
          }

          if (!existingClasses || existingClasses.length === 0) {
            // Create class in Supabase
            const { data: newClass, error: classError } = await createClass({
              name: "Math 101",
              subject: "Mathematics",
              teacher_id: teacherId,
              location: "Room 101",
              meeting_day: "Monday",
              start_time: "09:00",
              end_time: "10:00",
              virtual_link: "",
              status: "active",
            })

            if (classError) {
              console.warn(`Error creating class: ${classError}`)
            } else if (newClass) {
              classId = newClass.id
              console.log("Created class in Supabase:", newClass)
            }
          } else {
            classId = existingClasses[0].id
          }

          // Create curriculum for the class
          if (classId) {
            setStatus("Creating sample curriculum...")

            // Create curriculum in Supabase
            const sampleCurriculum = {
              lessons: [
                {
                  id: "lesson1",
                  title: "Introduction to Numbers",
                  description: "Learn about different types of numbers and basic operations.",
                  order: 1,
                  content: [
                    {
                      id: "material1",
                      type: "newMaterial",
                      title: "Number Systems",
                      content: "Introduction to natural numbers, integers, rational and irrational numbers.",
                      published: false,
                      problems: [
                        {
                          id: "prob1",
                          question: "Which of the following is an irrational number?",
                          type: "multipleChoice",
                          options: ["0.25", "0.333...", "$\\pi$", "15/7"],
                          correctAnswers: ["$\\pi$"],
                          attempts: 2,
                          points: 5,
                        },
                      ],
                    },
                    {
                      id: "classwork1",
                      type: "classwork",
                      title: "Classwork: Number Classification",
                      content: "Classify the following numbers into their appropriate number systems.",
                      published: false,
                      problems: [
                        {
                          id: "prob2",
                          question: "Classify the number $\\sqrt{2}$",
                          type: "multipleChoice",
                          options: ["Natural", "Integer", "Rational", "Irrational"],
                          correctAnswers: ["Irrational"],
                          attempts: 1,
                          points: 5,
                        },
                      ],
                    },
                    {
                      id: "homework1",
                      type: "homework",
                      title: "Homework: Number Operations",
                      content: "Practice basic operations with different types of numbers.",
                      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                      published: false,
                      problems: [
                        {
                          id: "prob3",
                          question: "Solve: $3 + 4 \\times 2 - 1$",
                          type: "shortAnswer",
                          correctAnswers: ["10", "ten"],
                          attempts: 3,
                          points: 5,
                        },
                      ],
                    },
                  ],
                },
                {
                  id: "lesson2",
                  title: "Addition and Subtraction",
                  description: "Practice addition and subtraction of integers.",
                  order: 2,
                  content: [
                    {
                      id: "guidedPractice1",
                      type: "guidedPractice",
                      title: "Guided Practice: Integer Operations",
                      content: "Step-by-step guide to adding and subtracting integers.",
                      published: false,
                      problems: [],
                    },
                    {
                      id: "quiz1",
                      type: "quiz",
                      title: "Quiz: Addition and Subtraction",
                      content: "Test your knowledge of addition and subtraction.",
                      published: false,
                      problems: [
                        {
                          id: "prob4",
                          question: "Calculate: $-5 + 8$",
                          type: "shortAnswer",
                          correctAnswers: ["3", "three"],
                          attempts: 2,
                          points: 5,
                        },
                      ],
                    },
                    {
                      id: "test1",
                      type: "test",
                      title: "Test: Integer Operations",
                      content: "Comprehensive test on integer operations.",
                      published: false,
                      problems: [
                        {
                          id: "prob5",
                          question: "If $x = -3$ and $y = 7$, what is the value of $x - y$?",
                          type: "shortAnswer",
                          correctAnswers: ["-10", "negative ten", "-10.0"],
                          attempts: 1,
                          points: 10,
                        },
                      ],
                    },
                  ],
                },
              ],
            }

            try {
              // First check if curriculum already exists
              const { data: existingCurriculum, error: curriculumCheckError } = await supabase
                .from("curriculum")
                .select("id")
                .eq("class_id", classId)
                .limit(1)

              if (curriculumCheckError) {
                console.warn(`Error checking for curriculum: ${curriculumCheckError.message}`)
              }

              if (!existingCurriculum || existingCurriculum.length === 0) {
                // Insert curriculum into Supabase
                const { error: curriculumError } = await supabase.from("curriculum").insert({
                  class_id: classId,
                  content: sampleCurriculum,
                })

                if (curriculumError) {
                  console.warn(`Error creating curriculum: ${curriculumError.message}`)
                } else {
                  console.log("Created curriculum in Supabase")
                }
              }

              // Also save to local storage as fallback
              persistentStorage.updateCurriculum(classId, sampleCurriculum)
            } catch (currErr) {
              console.error("Error creating curriculum:", currErr)
            }

            // Enroll student if we have both student and class IDs
            if (studentId) {
              setStatus("Enrolling student in class...")

              try {
                // Check if enrollment already exists
                const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
                  .from("class_enrollments")
                  .select("id")
                  .eq("class_id", classId)
                  .eq("student_id", studentId)
                  .limit(1)

                if (enrollmentCheckError) {
                  console.warn(`Error checking enrollment: ${enrollmentCheckError.message}`)
                }

                if (!existingEnrollment || existingEnrollment.length === 0) {
                  // Create enrollment in Supabase
                  const { error: enrollmentError } = await supabase.from("class_enrollments").insert({
                    class_id: classId,
                    student_id: studentId,
                    status: "active",
                  })

                  if (enrollmentError) {
                    console.warn(`Error creating enrollment: ${enrollmentError.message}`)
                  } else {
                    console.log("Enrolled student in class in Supabase")
                  }
                }

                // Also enroll in local storage as fallback
                persistentStorage.enrollStudentInClass(studentId, classId)
              } catch (enrollErr) {
                console.error("Error enrolling student:", enrollErr)
              }
            }
          }
        } catch (classErr) {
          console.error("Error in class creation:", classErr)
        }
      }

      setStatus("Database initialized successfully!")
      setProgress(100)
      setSuccess(true)
    } catch (err: any) {
      console.error("Database initialization error:", err)
      setError(err.message || "An unexpected error occurred")
      setStatus("Initialization failed")
    } finally {
      setIsInitializing(false)
    }
  }

  // Helper function to create admin user if not exists
  const createAdminIfNotExists = async (email: string, password: string, name: string): Promise<string | null> => {
    try {
      // Check if admin already exists in Supabase
      const { data: existingAdmin, error: adminCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .limit(1)

      let adminId = null

      if (adminCheckError) {
        console.warn(`Error checking for admin user in Supabase: ${adminCheckError.message}`)
        // Continue with local storage fallback
      }

      if (!existingAdmin || existingAdmin.length === 0) {
        try {
          // Create admin user through auth API
          const {
            success: adminSuccess,
            error: adminError,
            userId,
          } = await auth.createUser({
            email,
            password,
            name,
            role: "admin",
          })

          if (adminSuccess && userId) {
            adminId = userId
          } else {
            console.warn(`Error creating admin user in Supabase: ${adminError}`)
            // Continue with local storage fallback
          }
        } catch (err) {
          console.warn("Error creating admin in Supabase:", err)
          // Continue with local storage fallback
        }
      } else {
        adminId = existingAdmin[0].id
      }

      // Always ensure the admin exists in local storage
      const existingLocalAdmin = persistentStorage.getUserByEmail(email)

      if (!existingLocalAdmin) {
        const newAdmin = persistentStorage.addUser({
          name,
          email,
          password,
          role: "admin",
          status: "active",
          avatar: name.charAt(0).toUpperCase(),
          classes: [],
        })

        if (!adminId && newAdmin) {
          adminId = newAdmin.id
        }
      }

      return adminId
    } catch (err) {
      console.error("Error in createAdminIfNotExists:", err)
      // Continue with the initialization process
      return null
    }
  }

  return (
    <div className="container p-6 mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Database Management</h1>

      <Tabs defaultValue="initialize">
        <TabsList className="mb-4">
          <TabsTrigger value="initialize">Initialize Database</TabsTrigger>
          <TabsTrigger value="reset">Reset Database</TabsTrigger>
        </TabsList>

        <TabsContent value="initialize">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Initialize Database</CardTitle>
              <CardDescription>Create sample data to get started with Education More portal</CardDescription>
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
                  <AlertDescription>
                    Database initialized successfully! You can now log in with the following credentials:
                    <ul className="pl-6 mt-2 list-disc">
                      <li>
                        <strong>Admin:</strong> admin@educationmore.org / admin123
                      </li>
                      <li>
                        <strong>Admin:</strong> dylan.sood@gmail.com / Banking!123
                      </li>
                      <li>
                        <strong>Admin:</strong> dylan.sood@educationmore.org / Banking!123
                      </li>
                      <li>
                        <strong>Teacher:</strong> teacher@educationmore.org / teacher123
                      </li>
                      <li>
                        <strong>Student:</strong> student@educationmore.org / student123
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Initialization Progress</span>
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
                  <p className="font-medium">Initialization Steps:</p>
                  <ol className="mt-2 ml-4 text-sm text-muted-foreground list-decimal">
                    <li>Create database schema (if needed)</li>
                    <li>Create admin user accounts</li>
                    <li>Create test teacher account</li>
                    <li>Create test student account</li>
                    <li>Create sample class</li>
                    <li>Create sample curriculum</li>
                  </ol>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={initializeDatabase} disabled={isInitializing} className="w-full">
                {isInitializing ? "Initializing..." : "Initialize Database"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="reset">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Reset Database</CardTitle>
              <CardDescription>Delete all data and create a fresh admin user</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {resetSuccess && (
                <Alert className="mb-4">
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>
                    Database reset successfully! A new admin user has been created:
                    <ul className="pl-6 mt-2 list-disc">
                      <li>
                        <strong>Admin:</strong> dylan.sood@gmail.com / Banking!123
                      </li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {status && (
                  <div className="p-4 border rounded-md">
                    <p className="font-medium">Status:</p>
                    <p className="text-sm text-muted-foreground">{status}</p>
                  </div>
                )}

                <div className="p-4 border rounded-md bg-amber-50">
                  <p className="font-medium text-amber-800">Warning:</p>
                  <p className="text-sm text-amber-700">
                    This will delete ALL data from the database, including all users, classes, and curriculum. This
                    action cannot be undone.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={resetDatabase} disabled={isResetting} variant="destructive" className="w-full">
                {isResetting ? "Resetting..." : "Reset Database"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
