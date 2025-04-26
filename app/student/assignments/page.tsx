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
import { toast } from "@/components/ui/use-toast"

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
      if (typeof persistentStorage.getClassesByStudentId === 'function') {
        return persistentStorage.getClassesByStudentId(studentId);
      }
      
      // Fallback to getting all classes and filtering
      const allClasses = await persistentStorage.getAllClasses();
      return allClasses.filter(cls => 
        cls.enrolledStudents && 
        Array.isArray(cls.enrolledStudents) && 
        cls.enrolledStudents.includes(studentId)
      );
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
        
        // Try one more approach to get ALL classes
        try {
          console.log("Last attempt: Getting ALL classes and checking manually");
          const syncClasses = storage.getAllClasses(); 
          
          if (syncClasses && syncClasses.length > 0) {
            console.log(`Found ${syncClasses.length} total classes, checking if student ${studentId} is in any`);
            
            // Manually check each class's enrolledStudents, with very loose filtering
            const manuallyEnrolledClasses = syncClasses.filter(cls => {
              if (!cls) return false;
              
              // Check if class has enrolledStudents property (could be undefined or null)
              if (!cls.enrolledStudents) {
                console.log(`Class ${cls.id} has no enrolledStudents property`);
                return false;
              }
              
              // Check if it's an array
              if (!Array.isArray(cls.enrolledStudents)) {
                console.log(`Class ${cls.id} enrolledStudents is not an array:`, cls.enrolledStudents);
                return false;
              }
              
              // Check if student is in the array
              if (cls.enrolledStudents.includes(studentId)) {
                console.log(`Found student ${studentId} enrolled in class ${cls.id} with manual checking`);
                return true;
              }
              
              return false;
            });
            
            if (manuallyEnrolledClasses.length > 0) {
              console.log(`Found ${manuallyEnrolledClasses.length} enrolled classes with manual checking`);
              // Continue with these classes
              processEnrolledClasses(manuallyEnrolledClasses, studentId);
              return;
            }
          }
          
          toast({
            title: "Not enrolled in any classes",
            description: "You are not currently enrolled in any classes. Please contact your teacher if this is an error.",
            variant: "default"
          });
        } catch (finalError) {
          console.error("Final attempt to find classes failed:", finalError);
          toast({
            title: "Error loading classes",
            description: "There was a problem loading your enrolled classes. Please try refreshing the page.",
            variant: "destructive"
          });
        }
        return;
      }

      console.log(`Found ${enrolledClasses.length} enrolled classes for student ${studentId}`);
      await processEnrolledClasses(enrolledClasses, studentId);
      
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast({
        title: "Error loading assignments",
        description: "There was a problem loading your assignments. Please try refreshing the page.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };
  
  // Separate function to process enrolled classes and extract assignments
  const processEnrolledClasses = async (enrolledClasses: any[], studentId: string) => {
    const allAssignments: EnrichedAssignment[] = [];
    const dueAssignments: EnrichedAssignment[] = [];
    let foundAnyPublishedContent = false;

    // For each class, load the curriculum and extract assignments
    for (const classItem of enrolledClasses) {
      try {
        console.log(`Loading curriculum for class: ${classItem.id}`);
        let foundPublishedContent = false;
        
        // Try multiple sources for published content, in order of preference
        
        // 1. First try direct published content array (newest format)
        try {
          if (typeof window !== 'undefined') {
            const directPublishedContent = localStorage.getItem(`published-contents-${classItem.id}`);
            if (directPublishedContent) {
              const parsedContent = JSON.parse(directPublishedContent);
              console.log(`Found ${parsedContent.length} published contents in direct format`);
              
              if (Array.isArray(parsedContent) && parsedContent.length > 0) {
                // These are already filtered for published status
                const assignmentContent = parsedContent.filter(item => 
                  item && (item.type === 'assignment' || item.type === 'quiz')
                );
                
                if (assignmentContent.length > 0) {
                  allAssignments.push(...assignmentContent);
                  foundPublishedContent = true;
                  foundAnyPublishedContent = true;
                  
                  // Check for assignments due soon
                  const now = new Date();
                  const oneWeekFromNow = new Date();
                  oneWeekFromNow.setDate(now.getDate() + 7);
                  
                  const pendingAssignments = assignmentContent.filter((assignment: EnrichedAssignment) => {
                    if (!assignment.dueDate) return false;
                    const dueDate = new Date(assignment.dueDate);
                    return dueDate > now && dueDate <= oneWeekFromNow;
                  });
                  
                  dueAssignments.push(...pendingAssignments);
                }
              }
            }
          }
        } catch (directError) {
          console.warn(`Error accessing direct published content: ${directError}`);
        }
        
        // Continue to try other methods if we haven't found anything
        if (!foundPublishedContent) {
          // 2. Try the published curriculum structure from storage API
          try {
            const curriculum = await storage.getCurriculum(classItem.id, { id: studentId, role: "student" } as User);
            
            if (curriculum && curriculum.content) {
              console.log("Loaded curriculum structure from API:", JSON.stringify(curriculum).substring(0, 200) + "...");
              
              // Extract assignments from curriculum content
              const extractedAssignments = extractAssignmentsFromContent(curriculum.content, classItem);
              
              if (extractedAssignments.length > 0) {
                allAssignments.push(...extractedAssignments);
                foundPublishedContent = true;
                foundAnyPublishedContent = true;
                
                // Check for assignments due soon
                const now = new Date();
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(now.getDate() + 7);
                
                const pendingAssignments = extractedAssignments.filter((assignment: EnrichedAssignment) => {
                  if (!assignment.dueDate) return false;
                  const dueDate = new Date(assignment.dueDate);
                  return dueDate > now && dueDate <= oneWeekFromNow;
                });
                
                dueAssignments.push(...pendingAssignments);
              }
            }
          } catch (apiError) {
            console.warn(`Error getting curriculum from API: ${apiError}`);
          }
        }
        
        // 3. Try legacy published formats from localStorage
        if (!foundPublishedContent && typeof window !== 'undefined') {
          try {
            // Try published curriculum format
            const publishedCurriculum = localStorage.getItem(`published-curriculum-${classItem.id}`);
            if (publishedCurriculum) {
              const parsedCurriculum = JSON.parse(publishedCurriculum);
              console.log("Found published curriculum in localStorage:", JSON.stringify(parsedCurriculum).substring(0, 200) + "...");
              
              if (parsedCurriculum.lessons && Array.isArray(parsedCurriculum.lessons)) {
                const extractedAssignments = extractAssignmentsFromContent(parsedCurriculum, classItem);
                
                if (extractedAssignments.length > 0) {
                  allAssignments.push(...extractedAssignments);
                  foundPublishedContent = true;
                  foundAnyPublishedContent = true;
                  
                  // Check for assignments due soon
                  const now = new Date();
                  const oneWeekFromNow = new Date();
                  oneWeekFromNow.setDate(now.getDate() + 7);
                  
                  const pendingAssignments = extractedAssignments.filter((assignment: EnrichedAssignment) => {
                    if (!assignment.dueDate) return false;
                    const dueDate = new Date(assignment.dueDate);
                    return dueDate > now && dueDate <= oneWeekFromNow;
                  });
                  
                  dueAssignments.push(...pendingAssignments);
                }
              }
            }
            
            // Try legacy indexed format
            if (!foundPublishedContent) {
              const legacyFormat = localStorage.getItem(`published-curriculum-${classItem.id}-legacy`);
              if (legacyFormat) {
                const parsedLegacy = JSON.parse(legacyFormat);
                console.log("Found legacy published format in localStorage");
                
                if (typeof parsedLegacy === 'object' && !Array.isArray(parsedLegacy)) {
                  const extractedAssignments: EnrichedAssignment[] = [];
                  
                  // Parse the legacy indexed format
                  for (const lessonIdx in parsedLegacy) {
                    for (const contentIdx in parsedLegacy[lessonIdx]) {
                      const content = parsedLegacy[lessonIdx][contentIdx];
                      if (content && content.isPublished === true && 
                          (content.type === 'assignment' || content.type === 'quiz')) {
                        extractedAssignments.push({
                          ...content,
                          classId: classItem.id,
                          className: classItem.name
                        });
                      }
                    }
                  }
                  
                  if (extractedAssignments.length > 0) {
                    allAssignments.push(...extractedAssignments);
                    foundPublishedContent = true;
                    foundAnyPublishedContent = true;
                    
                    // Check for assignments due soon
                    const now = new Date();
                    const oneWeekFromNow = new Date();
                    oneWeekFromNow.setDate(now.getDate() + 7);
                    
                    const pendingAssignments = extractedAssignments.filter((assignment: EnrichedAssignment) => {
                      if (!assignment.dueDate) return false;
                      const dueDate = new Date(assignment.dueDate);
                      return dueDate > now && dueDate <= oneWeekFromNow;
                    });
                    
                    dueAssignments.push(...pendingAssignments);
                  }
                }
              }
            }
          } catch (localStorageError) {
            console.warn(`Error accessing published curriculum from localStorage: ${localStorageError}`);
          }
        }
        
        if (!foundPublishedContent) {
          console.log(`No published content found for class ${classItem.name} (${classItem.id})`);
        }
        
      } catch (error) {
        console.error(`Error loading assignments for class ${classItem.id}:`, error);
      }
    }

    console.log(`Found a total of ${allAssignments.length} published assignments across all classes`);
    
    // Sort assignments by due date
    const sortedAssignments = allAssignments.sort((a, b) => {
      if (!a.dueDate) return 1; // Push items without due dates to the end
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    
    // Update state
    setAssignments(sortedAssignments);
    setPendingAssignments(dueAssignments);
    setLoading(false);
    
    // Show message if no published content was found
    if (!foundAnyPublishedContent) {
      toast({
        title: "No assignments available",
        description: "There are no published assignments available for your enrolled classes.",
        variant: "default"
      });
    }
  };

  // Helper function to extract assignments from content
  const extractAssignmentsFromContent = (content: any, classItem: any): EnrichedAssignment[] => {
    let extractedAssignments: EnrichedAssignment[] = [];
    
    // Direct assignments array at top level
    if (content.assignments && Array.isArray(content.assignments)) {
      const assignments = content.assignments
        .filter((item: Content) => item && item.isPublished === true)
        .map((assignment: Content) => ({
          ...assignment,
          className: classItem.name,
          classId: classItem.id
        }));
      
      if (assignments.length > 0) {
        console.log(`Found ${assignments.length} published assignments in class ${classItem.name}`);
        extractedAssignments.push(...assignments);
      }
    }
    
    // Process lessons array
    if (content.lessons && Array.isArray(content.lessons)) {
      console.log(`Processing ${content.lessons.length} lessons in class ${classItem.name}`);
      
      content.lessons.forEach((lesson: any) => {
        // Extract direct assignments from lesson
        if (lesson.assignments && Array.isArray(lesson.assignments)) {
          const assignments = lesson.assignments
            .filter((item: Content) => item && item.isPublished === true)
            .map((assignment: Content) => ({
              ...assignment,
              className: classItem.name,
              classId: classItem.id,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            }));
          
          if (assignments.length > 0) {
            extractedAssignments.push(...assignments);
          }
        }
        
        // Extract from lesson contents array
        if (lesson.contents && Array.isArray(lesson.contents)) {
          const assignmentContents = lesson.contents
            .filter((content: Content) => 
              content && 
              content.isPublished === true && 
              (content.type === 'assignment' || content.type === 'quiz')
            )
            .map((content: Content) => ({
              ...content,
              classId: classItem.id,
              className: classItem.name,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            }));
          
          if (assignmentContents.length > 0) {
            extractedAssignments.push(...assignmentContents);
          }
        }
        
        // Handle content property as well (some data models use this)
        if (lesson.content && Array.isArray(lesson.content)) {
          const assignmentContents = lesson.content
            .filter((content: Content) => 
              content && 
              content.isPublished === true && 
              (content.type === 'assignment' || content.type === 'quiz')
            )
            .map((content: Content) => ({
              ...content,
              classId: classItem.id,
              className: classItem.name,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            }));
          
          if (assignmentContents.length > 0) {
            extractedAssignments.push(...assignmentContents);
          }
        }
      });
    }
    
    // Process units with lessons
    if (content.units && Array.isArray(content.units)) {
      content.units.forEach((unit: any) => {
        if (unit.lessons && Array.isArray(unit.lessons)) {
          unit.lessons.forEach((lesson: any) => {
            // Extract from lesson contents array
            if (lesson.contents && Array.isArray(lesson.contents)) {
              const assignmentContents = lesson.contents
                .filter((content: Content) => 
                  content && 
                  content.isPublished === true && 
                  (content.type === 'assignment' || content.type === 'quiz')
                )
                .map((content: Content) => ({
                  ...content,
                  classId: classItem.id,
                  className: classItem.name,
                  lessonId: lesson.id,
                  lessonTitle: lesson.title,
                  unitId: unit.id,
                  unitTitle: unit.title
                }));
              
              if (assignmentContents.length > 0) {
                extractedAssignments.push(...assignmentContents);
              }
            }
          });
        }
      });
    }
    
    return extractedAssignments;
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