"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Book,
  Calendar,
  CheckSquare,
  Cog,
  File,
  LayoutDashboard,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { storage } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import { persistentStorage } from '@/lib/persistentStorage'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// Define interfaces for data structures
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin";
  status?: "active" | "inactive";
  avatar?: string;
  classes: string[];
}

interface Class {
  id: string;
  name: string;
  description?: string;
  teacher?: string;
  enrolledStudents?: string[];
}

interface Content {
  id?: string;
  title?: string;
  type?: string;
  description?: string;
  isPublished?: boolean;
  dueDate?: string;
  completed?: boolean;
  completedAt?: string;
}

// Define interfaces for assignment data
interface EnrichedAssignment extends Content {
  classId: string;
  className: string;
  lessonId?: string;
  lessonTitle?: string;
}

interface Curriculum {
  classId: string;
  content?: {
    lessons?: any[];
    assignments?: any[];
  };
  lastUpdated?: string;
  // Add these properties since they're accessed directly in the code
  lessons?: any[];
  assignments?: any[];
}

export default function StudentAssignments() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingAssignments, setPendingAssignments] = useState<EnrichedAssignment[]>([])

  useEffect(() => {
    // Load current user and check authorization
    const checkAuth = async () => {
      try {
        // Try to get user from localStorage directly first
        let user;
        
        // Check localStorage for user data
        if (typeof window !== 'undefined') {
          // Show login debug info in console
          console.log("Looking for user in localStorage and persistentStorage...");
          
          // First check for a user that might be in a different format
          const storedAuth = localStorage.getItem('authUser');
          if (storedAuth) {
            try {
              const authData = JSON.parse(storedAuth);
              console.log("Found authUser in localStorage:", authData);
              user = {
                id: authData.uid || authData.id,
                name: authData.displayName || authData.name || "Student",
                email: authData.email,
                role: authData.role || "student",
                password: "",
                status: "active",
                classes: []
              };
            } catch (e) {
              console.error("Error parsing authUser from localStorage:", e);
            }
          }
          
          // If no authUser, try the standard currentUser format
          if (!user) {
            const storedUser = localStorage.getItem('currentUser');
            if (storedUser) {
              try {
                user = JSON.parse(storedUser);
                console.log("Found currentUser in localStorage:", user);
              } catch (e) {
                console.error("Error parsing currentUser from localStorage:", e);
              }
            } else {
              console.log("No currentUser found in localStorage");
            }
          }
          
          // If we still don't have a user, try persistentStorage
          if (!user) {
            try {
              user = await persistentStorage.getCurrentUser();
              console.log("Found user from persistentStorage:", user);
            } catch (e) {
              console.error("Error getting user from persistentStorage:", e);
            }
          }
          
          // Last attempt - check sessionStorage
          if (!user) {
            const sessionUser = sessionStorage.getItem('currentUser');
            if (sessionUser) {
              try {
                user = JSON.parse(sessionUser);
                console.log("Found user in sessionStorage:", user);
              } catch (e) {
                console.error("Error parsing user from sessionStorage:", e);
              }
            }
          }
        }
        
        if (!user) {
          console.error('No authenticated user found');
          setAuthError('You must be logged in to view this page');
          setLoading(false);
          
          // Auto-redirect to login after a short delay
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/login?redirect=/student/assignments';
            }
          }, 2000);
          return;
        }
        
        // Handle different user data structures
        const role = user.role || (user.user && user.user.role);
        if (role !== 'student') {
          console.error('User is not a student');
          setAuthError('Only students can access this page');
          setLoading(false);
          return;
        }
        
        // Normalize user data format
        const normalizedUser: User = {
          id: user.id || (user.user && user.user.id) || '',
          name: user.name || (user.user && user.user.name) || 'Student',
          email: user.email || (user.user && user.user.email) || '',
          password: user.password || '',
          role: role,
          status: user.status || 'active',
          avatar: user.avatar || '',
          classes: user.classes || [],
        };
        
        console.log("Using normalized user:", normalizedUser);
        setCurrentUser(normalizedUser);
        setLoading(false);
        
        // Load assignments using the normalized user ID
        loadAssignments(normalizedUser.id);
      } catch (error) {
        console.error('Authentication error:', error);
        setAuthError('Authentication error');
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const getClassesForStudent = async (studentId: string) => {
    try {
      // Try specialized method if available
      return persistentStorage.getClassesForStudent(studentId);
    } catch (error) {
      console.error("Error getting classes for student:", error);
      
      // Last resort: try storage directly
      const allClasses = await storage.getClasses();
      return allClasses.filter(cls => 
        cls.enrolledStudents && 
        Array.isArray(cls.enrolledStudents) && 
        cls.enrolledStudents.includes(studentId)
      );
    }
  };

  const loadAssignments = async (studentId: string) => {
    if (!studentId) return;
    
    setLoading(true);
    try {
      // Get all classes the student is enrolled in
      const enrolledClasses = await getClassesForStudent(studentId);
      if (!enrolledClasses || enrolledClasses.length === 0) {
        console.log('Student is not enrolled in any classes');
        setLoading(false);
        return;
      }

      console.log(`Found ${enrolledClasses.length} enrolled classes for student ${studentId}`);
      const allAssignments: EnrichedAssignment[] = [];
      const dueAssignments: EnrichedAssignment[] = [];

      // For each class, load the curriculum and extract assignments
      for (const classItem of enrolledClasses) {
        try {
          console.log(`Loading curriculum for class: ${classItem.id}`);
          
          // STEP 1: Check for individually published assignments first
          if (typeof window !== 'undefined') {
            console.log(`Checking for published assignments for class ${classItem.id} in localStorage`);
            // Try to get the list of published assignments for this class
            const publishedListKey = `published_assignments_${classItem.id}`;
            try {
              const publishedList = localStorage.getItem(publishedListKey);
              if (publishedList) {
                const assignmentIds = JSON.parse(publishedList);
                console.log(`Found published assignment list for class ${classItem.id}:`, assignmentIds);
                
                // Get each published assignment
                for (const assignmentId of assignmentIds) {
                  const assignmentKey = `assignment_${classItem.id}_${assignmentId}`;
                  const assignmentData = localStorage.getItem(assignmentKey);
                  
                  if (assignmentData) {
                    try {
                      const assignment = JSON.parse(assignmentData);
                      console.log(`Loaded published assignment: ${assignment.title || assignmentId}`);
                      
                      // Ensure the assignment has required fields
                      const enrichedAssignment = {
                        ...assignment,
                        id: assignment.id || assignmentId,
                        classId: classItem.id,
                        className: assignment.className || classItem.name,
                        isPublished: true
                      };
                      
                      // Add to lists
                      allAssignments.push(enrichedAssignment);
                      
                      // Check for pending status
                      if (assignment.dueDate) {
                        const now = new Date();
                        const dueDate = new Date(assignment.dueDate);
                        const oneWeekFromNow = new Date();
                        oneWeekFromNow.setDate(now.getDate() + 7);
                        
                        if (dueDate > now && dueDate <= oneWeekFromNow) {
                          dueAssignments.push(enrichedAssignment);
                        }
                      }
                    } catch (err) {
                      console.error(`Error parsing assignment ${assignmentId}:`, err);
                    }
                  } else {
                    console.log(`Assignment data not found for key: ${assignmentKey}`);
                  }
                }
              } else {
                console.log(`No published assignments list found for class ${classItem.id}`);
              }
            } catch (err) {
              console.error(`Error loading published assignments list for class ${classItem.id}:`, err);
            }
          }
          
          // STEP 2: Load class curriculum as a fallback
          console.log(`Loading full curriculum for class ${classItem.id}`);
          const curriculum = await storage.getCurriculum(classItem.id);
          
          if (curriculum) {
            console.log("Loaded curriculum structure:", JSON.stringify(curriculum).substring(0, 200) + "...");
            
            // Handle different curriculum structures
            const assignments = curriculum.content?.assignments || curriculum.assignments;
            const lessons = curriculum.content?.lessons || curriculum.lessons;
            
            // Process assignments from curriculum
            if (assignments && Array.isArray(assignments)) {
              // Make sure to log what we're finding to debug
              console.log(`Found ${assignments.length} assignments in class ${classItem.name}`);
              
              // Filter for published assignments only and add class details
              const classAssignments = assignments
                .filter((item: Content) => {
                  // Explicit check for isPublished being true
                  const isPublished = item.isPublished === true;
                  console.log(`Assignment ${item.title}: isPublished=${isPublished}`);
                  return isPublished;
                })
                .map((assignment: Content) => ({
                  ...assignment,
                  className: classItem.name,
                  classId: classItem.id
                }));
              
              console.log(`Found ${classAssignments.length} published assignments in curriculum.assignments`);
              allAssignments.push(...classAssignments);
              
              // Check for assignments due soon or overdue
              const now = new Date();
              const oneWeekFromNow = new Date();
              oneWeekFromNow.setDate(now.getDate() + 7);
              
              const pendingAssignments = classAssignments.filter((assignment: EnrichedAssignment) => {
                if (!assignment.dueDate) return false;
                
                const dueDate = new Date(assignment.dueDate);
                return dueDate > now && dueDate <= oneWeekFromNow;
              });
              
              dueAssignments.push(...pendingAssignments);
            } else {
              console.log(`No assignments array found in curriculum for class ${classItem.name}`);
            }
            
            // STEP 3: Process assignments embedded in lessons
            if (lessons && Array.isArray(lessons)) {
              let lessonContentCount = 0;
              for (const lesson of lessons) {
                // Extract published content from each lesson
                const lessonContent = lesson.contents || lesson.content;
                if (lessonContent && Array.isArray(lessonContent)) {
                  const publishedContent = lessonContent
                    .filter((content: Content) => {
                      const isPublished = content && content.isPublished === true && 
                        (content.type === 'assignment' || content.type === 'quiz');
                      if (content) {
                        console.log(`Lesson content ${content.title}: isPublished=${isPublished}, type=${content.type}`);
                      }
                      return isPublished;
                    })
                    .map((content: Content) => ({
                      ...content,
                      classId: classItem.id,
                      className: classItem.name,
                      lessonId: lesson.id,
                      lessonTitle: lesson.title
                    }));
                  
                  if (publishedContent.length > 0) {
                    lessonContentCount += publishedContent.length;
                    allAssignments.push(...publishedContent);
                    
                    // Check for lesson content due soon
                    const now = new Date();
                    const oneWeekFromNow = new Date();
                    oneWeekFromNow.setDate(now.getDate() + 7);
                    
                    const pendingContent = publishedContent.filter((content: EnrichedAssignment) => {
                      if (!content.dueDate) return false;
                      
                      const dueDate = new Date(content.dueDate);
                      return dueDate > now && dueDate <= oneWeekFromNow;
                    });
                    
                    dueAssignments.push(...pendingContent);
                  }
                }
              }
              console.log(`Found ${lessonContentCount} published assignments in lessons for class ${classItem.name}`);
            } else {
              console.log(`No lessons array found in curriculum for class ${classItem.name}`);
            }
          } else {
            console.log(`No curriculum found for class ${classItem.id}`);
          }
        } catch (error) {
          console.error(`Error loading curriculum for class ${classItem.id}:`, error);
        }
      }

      // Remove duplicates by ID
      const uniqueAssignments = [];
      const assignmentIds = new Set();
      
      for (const assignment of allAssignments) {
        if (assignment.id && !assignmentIds.has(assignment.id)) {
          assignmentIds.add(assignment.id);
          uniqueAssignments.push(assignment);
        }
      }
      
      console.log(`Total unique published assignments found: ${uniqueAssignments.length}`);
      
      // Sort assignments by due date
      uniqueAssignments.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      setAssignments(uniqueAssignments);
      setPendingAssignments(dueAssignments);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
    
    setLoading(false);
  };

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
      current: true,
    },
    {
      title: "Calendar",
      href: "/student/calendar",
      icon: Calendar,
      current: false,
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
          <p>Loading assignments...</p>
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
            <CardContent>
              <div className="mt-4 text-sm text-muted-foreground">
                <p>Try the following:</p>
                <ul className="list-disc pl-5 mt-2">
                  <li>Make sure you are logged in as a student</li>
                  <li>If you were logged in before, your session may have expired</li>
                  <li>Clear browser cache and try again</li>
                  <li>You will be redirected to the login page shortly...</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => router.push("/login?redirect=/student/assignments")}
                className="w-full"
              >
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

  // Filter assignments by status
  const upcomingAssignments = assignments.filter(
    assignment => !assignment.completed && assignment.dueDate && new Date(assignment.dueDate) > new Date()
  );
  
  const completedAssignments = assignments.filter(
    assignment => assignment.completed
  );
  
  const overdueAssignments = assignments.filter(
    assignment => !assignment.completed && assignment.dueDate && new Date(assignment.dueDate) < new Date()
  );

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
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground">
              View and track your assignments
            </p>
          </div>
        </div>

        {/* Pending Assignments */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Assignments</h2>
          <div className="space-y-4">
            {pendingAssignments.length > 0 ? (
              pendingAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Due: {new Date(assignment.dueDate || "").toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge>{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        Start Assignment
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No pending assignments</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* Overdue Assignments */}
        {overdueAssignments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Overdue Assignments</h2>
            <div className="space-y-4">
              {overdueAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Due: {new Date(assignment.dueDate || "").toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="destructive">{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                      variant="outline"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        Submit Late
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Assignments */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Completed Assignments</h2>
          <div className="space-y-4">
            {completedAssignments.length > 0 ? (
              completedAssignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • Completed on: {new Date(assignment.completedAt || Date.now()).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                      variant="secondary"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}`}>
                        View Submission
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No completed assignments</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  )
} 