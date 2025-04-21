"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, GraduationCap, Calendar, ChevronDown, FileText, Home, LogOut, User, Book } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sessionManager } from "@/lib/session"
import { storage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"

export default function StudentDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("overview")
  const [currentUser, setCurrentUser] = useState(null)
  const [studentClasses, setStudentClasses] = useState([])
  const [pendingAssignments, setPendingAssignments] = useState(0)

  // Load user data on component mount
  useEffect(() => {
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "student") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a student to view this page",
        variant: "destructive",
      })
      router.push("/student-portal")
      return
    }

    setCurrentUser(user)

    // Get student's classes
    const allClasses = storage.getClasses()
    const userDetails = storage.getUserById(user.id)

    if (userDetails && userDetails.classes) {
      const classes = allClasses.filter((cls) => userDetails.classes.includes(cls.id))
      setStudentClasses(classes)
    }

    // For demo purposes, set a random number of pending assignments
    setPendingAssignments(Math.floor(Math.random() * 5) + 1)
  }, [router, toast])

  const handleLogout = () => {
    sessionManager.clearCurrentUser()
    router.push("/")
  }

  if (!currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <div className="hidden w-64 p-4 bg-white border-r md:block dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center mb-8 space-x-2">
          <GraduationCap className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">Education More</span>
        </div>
        <nav className="space-y-1">
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/student/dashboard">
              <Home className="w-5 h-5 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/student/assignments">
              <FileText className="w-5 h-5 mr-2" />
              Assignments
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/student/calendar">
              <Calendar className="w-5 h-5 mr-2" />
              Calendar
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start w-full" asChild>
            <Link href="/student/profile">
              <User className="w-5 h-5 mr-2" />
              Profile
            </Link>
          </Button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-white border-b dark:bg-slate-900 dark:border-slate-800">
          <h1 className="text-xl font-bold md:text-2xl">Student Dashboard</h1>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="/placeholder.svg" alt="Student" />
                    <AvatarFallback>{currentUser.avatar}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block">{currentUser.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/student/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/student/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="grades">Grades</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Pending Assignments</CardTitle>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pendingAssignments}</div>
                    <p className="text-xs text-muted-foreground">{Math.ceil(pendingAssignments / 2)} due this week</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Current GPA</CardTitle>
                    <Book className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">3.8</div>
                    <p className="text-xs text-muted-foreground">+0.2 from last semester</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Course Progress</CardTitle>
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">68%</div>
                    <Progress value={68} className="mt-2" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Upcoming Tests</CardTitle>
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2</div>
                    <p className="text-xs text-muted-foreground">Next: Math (Friday)</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Recent Assignments</CardTitle>
                    <CardDescription>Your most recent assignments and their status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Math Problem Set 12</p>
                          <p className="text-sm text-muted-foreground">Due in 2 days</p>
                        </div>
                        <Badge>Pending</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">History Essay</p>
                          <p className="text-sm text-muted-foreground">Due tomorrow</p>
                        </div>
                        <Badge variant="secondary">In Progress</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Science Lab Report</p>
                          <p className="text-sm text-muted-foreground">Submitted 3 days ago</p>
                        </div>
                        <Badge variant="outline">Graded: A</Badge>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/student/assignments">View All Assignments</Link>
                    </Button>
                    {studentClasses.length > 0 && (
                      <Button variant="outline" className="w-full" asChild>
                        <Link href={`/student/curriculum/${studentClasses[0].id}`}>View Class Curriculum</Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>

                <Card className="col-span-1">
                  <CardHeader>
                    <CardTitle>Your Classes</CardTitle>
                    <CardDescription>Classes you are enrolled in</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {studentClasses.length > 0 ? (
                        studentClasses.map((cls) => (
                          <div key={cls.id} className="p-3 border rounded-lg">
                            <div className="flex justify-between">
                              <div>
                                <p className="font-medium">{cls.name}</p>
                                <p className="text-sm text-muted-foreground">Teacher: {cls.teacher}</p>
                                <p className="text-sm text-muted-foreground">{cls.location}</p>
                              </div>
                              <Badge variant={cls.status === "active" ? "default" : "secondary"}>
                                {cls.status === "active" ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                              <p className="text-sm text-muted-foreground">{cls.meetingDates}</p>
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/student/curriculum/${cls.id}`}>
                                  <Book className="w-4 h-4 mr-2" />
                                  Curriculum
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-muted-foreground">You are not enrolled in any classes yet</p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/student/calendar">View Full Calendar</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Assignments</CardTitle>
                  <CardDescription>All your pending and upcoming assignments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold">Due This Week</h3>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">Math Problem Set 12</h4>
                              <p className="text-sm text-muted-foreground">Due: Friday, 5:00 PM</p>
                              <p className="mt-2 text-sm">Complete problems 1-20 in Chapter 8</p>
                            </div>
                            <Badge>Pending</Badge>
                          </div>
                          <div className="flex justify-end mt-4 space-x-2">
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                            <Button size="sm">Submit Work</Button>
                          </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">History Essay</h4>
                              <p className="text-sm text-muted-foreground">Due: Tomorrow, 11:59 PM</p>
                              <p className="mt-2 text-sm">1500-word essay on the Industrial Revolution</p>
                            </div>
                            <Badge variant="secondary">In Progress</Badge>
                          </div>
                          <div className="flex justify-end mt-4 space-x-2">
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                            <Button size="sm">Continue Working</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold">Upcoming</h3>
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">Physics Lab Report</h4>
                              <p className="text-sm text-muted-foreground">Due: Next Monday, 9:00 AM</p>
                              <p className="mt-2 text-sm">Report on the pendulum experiment</p>
                            </div>
                            <Badge variant="outline">Not Started</Badge>
                          </div>
                          <div className="flex justify-end mt-4 space-x-2">
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                            <Button size="sm">Start Assignment</Button>
                          </div>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">English Literature Analysis</h4>
                              <p className="text-sm text-muted-foreground">Due: Next Wednesday, 11:59 PM</p>
                              <p className="mt-2 text-sm">Character analysis of Hamlet</p>
                            </div>
                            <Badge variant="outline">Not Started</Badge>
                          </div>
                          <div className="flex justify-end mt-4 space-x-2">
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                            <Button size="sm">Start Assignment</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="grades" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Current Grades</CardTitle>
                  <CardDescription>Your academic performance across all subjects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Mathematics</h3>
                        <Badge className="ml-2">A</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Homework</span>
                          <span>95%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Quizzes</span>
                          <span>92%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Midterm Exam</span>
                          <span>88%</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Science</h3>
                        <Badge className="ml-2">A-</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Lab Reports</span>
                          <span>90%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Quizzes</span>
                          <span>87%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Midterm Exam</span>
                          <span>89%</span>
                        </div>
                        <Progress value={89} className="h-2" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">History</h3>
                        <Badge className="ml-2">B+</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Essays</span>
                          <span>85%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Participation</span>
                          <span>90%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Midterm Exam</span>
                          <span>82%</span>
                        </div>
                        <Progress value={85} className="h-2" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">English Literature</h3>
                        <Badge className="ml-2">A</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Essays</span>
                          <span>94%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Participation</span>
                          <span>95%</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Midterm Exam</span>
                          <span>91%</span>
                        </div>
                        <Progress value={93} className="h-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    Download Grade Report
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
