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
  Bell,
} from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { storage } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from "@/components/ui/use-toast"
import { sessionManager } from "@/lib/session"
import { getDoc, doc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getStudentProgress, updateStudentProgress } from "@/lib/firestore"

// Define interfaces for data structures
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
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
interface EnrichedAssignment {
  id: string;
  title: string;
  description?: string;
  type: string;
  dueDate?: string;
  isPublished: boolean;
  completed?: boolean;
  completedAt?: string;
  classId: string;
  className: string;
  lessonId?: string;
  lessonTitle?: string;
  progress?: StudentProgress;
  problems?: any[];
  points?: number;
}

// Add these type definitions at the top of the file
interface StudentProgress {
  completed: boolean;
  score: number;
  lastUpdated: any;
  studentId?: string;
  assignmentId?: string;
  courseId?: string;
  status?: string;
  currentProblem?: number;
  answers?: Record<string, any>;
}

interface LessonGroup {
  lessonId: string;
  lessonTitle: string;
  assignments: EnrichedAssignment[];
  id?: string;
  progress?: StudentProgress;
  courseId?: string;
}

interface CustomQuerySnapshot {
  docs: QueryDocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach: (callback: (doc: QueryDocumentSnapshot) => void) => void;
}

export default function StudentAssignments() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [assignments, setAssignments] = useState<LessonGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingAssignments, setPendingAssignments] = useState<EnrichedAssignment[]>([])
  const [assignmentScores, setAssignmentScores] = useState<Record<string, { score: number; status: string }>>({})

  useEffect(() => {
    // Pre-initialize storage service
    const initStorage = async () => {
      try {
        console.log("Pre-initializing storage service to ensure classes can be fetched");
        // Load users first to initialize internal storage
        await storage.getUsers();
        // Then load classes to make sure they're cached
        await storage.getClasses();
        console.log("Storage service pre-initialization complete");
      } catch (error) {
        console.error("Error during storage pre-initialization:", error);
      }
    };
    
    // Sequence the initialization and authentication
    const initialize = async () => {
      // First initialize storage
      await initStorage();
      
      // Then check authentication
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
          
          // Try session manager instead of direct persistentStorage
          if (!user) {
            try {
              const sessionUser = sessionManager.getCurrentUser();
              if (sessionUser && sessionUser.user) {
                user = {
                  id: sessionUser.user.uid || sessionUser.user.id,
                  name: sessionUser.user.displayName || sessionUser.user.name || "Student",
                  email: sessionUser.user.email,
                  role: sessionUser.role || "student",
                };
                console.log("Found user from session manager:", user);
              }
            } catch (e) {
              console.error("Error getting user from session manager:", e);
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
          role: role,
        };
        
        console.log("Using normalized user:", normalizedUser);
        setCurrentUser(normalizedUser);
        setLoading(false);
        
        // Load assignments using the normalized user ID
        await loadAssignments(normalizedUser.id);
        // Load scores for all assignments
        await loadAssignmentScores(normalizedUser.id);
      } catch (error) {
        console.error('Authentication error:', error);
        setAuthError('Authentication error');
        setLoading(false);
      }
    };
    
    initialize();
  }, []);

  const getClassesForStudent = async (studentId: string) => {
    try {
      // Try the direct method from storage service first
      try {
        const directClasses = await storage.getClassesByStudentId(studentId);
        if (directClasses && Array.isArray(directClasses) && directClasses.length > 0) {
          console.log(`Found ${directClasses.length} classes directly from storage service`);
          
          // Log each class for debugging
          directClasses.forEach(cls => {
            console.log(`- Student enrolled in class: ${cls.id} - ${cls.name}`);
          });
          
          return directClasses;
        }
      } catch (directError) {
        console.error("Error using direct getClassesByStudentId method:", directError);
      }
      
      // Try persistent storage but using storage service as a proxy
      try {
        console.log("Trying to get classes via storage service proxy to persistent storage");
        const enrolledClasses = await storage.getClasses();
        
        if (enrolledClasses && Array.isArray(enrolledClasses)) {
          const filteredClasses = enrolledClasses.filter(cls => 
            cls && cls.enrolledStudents && 
            Array.isArray(cls.enrolledStudents) && 
            cls.enrolledStudents.includes(studentId)
          );
          
          if (filteredClasses.length > 0) {
            console.log(`Found ${filteredClasses.length} classes via storage service with enrollment check`);
            return filteredClasses;
          }
        }
      } catch (proxyError) {
        console.error("Error getting classes via storage service proxy:", proxyError);
      }
      
      // Skip direct persistentStorage calls as they're causing reference errors
      // Instead, always rely on the storage service or localStorage
      
      // Fallback to getting all classes and filtering
      console.log("Using fallback method: getting all classes and filtering");
      
      // Try to get from localStorage first
      if (typeof window !== 'undefined') {
        try {
          // Check for direct enrollment record
          const enrollmentsKey = `student-enrollments-${studentId}`;
          const enrollmentsJson = localStorage.getItem(enrollmentsKey);
          
          if (enrollmentsJson) {
            const enrollments = JSON.parse(enrollmentsJson);
            if (Array.isArray(enrollments) && enrollments.length > 0) {
              console.log(`Found direct enrollment record for student ${studentId} with ${enrollments.length} classes`);
              
              // Get details for each enrolled class
              const enrolledClasses = [];
              for (const classId of enrollments) {
                const classDetails = await storage.getClassById(classId);
                if (classDetails) {
                  enrolledClasses.push(classDetails);
                }
              }
              
              if (enrolledClasses.length > 0) {
                return enrolledClasses;
              }
            }
          }
          
          // Try classes in localStorage directly
          const classesJson = localStorage.getItem('classes');
          if (classesJson) {
            const allClasses = JSON.parse(classesJson);
            if (Array.isArray(allClasses) && allClasses.length > 0) {
              const filteredClasses = allClasses.filter(cls => 
                cls && cls.enrolledStudents && 
                Array.isArray(cls.enrolledStudents) && 
                cls.enrolledStudents.includes(studentId)
              );
              
              if (filteredClasses.length > 0) {
                console.log(`Found ${filteredClasses.length} classes in localStorage`);
                return filteredClasses;
              }
            }
          }
        } catch (localStorageError) {
          console.error("Error checking localStorage for enrollments:", localStorageError);
        }
      }
      
      // Last resort: try getting all classes from storage service
      console.log("Last resort: getting all classes from storage service");
      const storageClasses = await storage.getClasses();
      if (storageClasses && Array.isArray(storageClasses) && storageClasses.length > 0) {
        console.log(`Checking ${storageClasses.length} classes from storage service`);
        
        // Perform a loose check to handle different data formats
        const enrolledClasses = storageClasses.filter(cls => {
          // Skip invalid classes
          if (!cls) return false;
          
          // Try to match by student ID in enrolledStudents array
          if (cls.enrolledStudents && Array.isArray(cls.enrolledStudents)) {
            const isDirectlyEnrolled = cls.enrolledStudents.includes(studentId);
            if (isDirectlyEnrolled) {
              console.log(`Found direct enrollment in class ${cls.id} - ${cls.name}`);
              return true;
            }
          }
          
          // Check if student ID is in the class's students array
          if (cls.students && Array.isArray(cls.students)) {
            const isInStudentsArray = cls.students.includes(studentId);
            if (isInStudentsArray) {
              console.log(`Found student in class.students array: ${cls.id} - ${cls.name}`);
              return true;
            }
          }
          
          // Check if student's classes list includes this class
          const currentUser = sessionManager.getCurrentUser();
          if (currentUser && currentUser.user) {
            // Cast the user to any type to bypass TypeScript checks
            const userAny = currentUser.user as any;
            const userClasses = userAny.classes || [];
            
            if (Array.isArray(userClasses) && userClasses.includes(cls.id)) {
              console.log(`Found class ID in user's classes list: ${cls.id} - ${cls.name}`);
              return true;
            }
          }
          
          return false;
        });
        
        if (enrolledClasses.length > 0) {
          console.log(`Found ${enrolledClasses.length} enrolled classes with comprehensive checks`);
          return enrolledClasses;
        }
      }
      
      console.warn(`No enrolled classes found for student ${studentId} after trying all methods`);
      return [];
    } catch (error) {
      console.error("Critical error in getClassesForStudent:", error);
      return [];
    }
  };

  const loadAssignments = async (studentId: string) => {
    if (!studentId) return;
    
    setLoading(true);
    console.log(`Loading assignments for student ${studentId}`);
    
    // First check if we have any published assignments directly, regardless of enrollment
    const directAssignments = await checkForDirectPublishedAssignments(studentId);
    if (directAssignments && directAssignments.length > 0) {
      console.log(`Found ${directAssignments.length} direct published assignments`);
      // Group directAssignments by lesson
      const lessonGroupsMap: Record<string, EnrichedAssignment[]> = {};
      directAssignments.forEach((assignment) => {
        const lessonId = assignment.lessonId || 'ungrouped';
        if (!lessonGroupsMap[lessonId]) lessonGroupsMap[lessonId] = [];
        lessonGroupsMap[lessonId].push(assignment);
      });
      const lessonGroups: LessonGroup[] = Object.entries(lessonGroupsMap).map(([lessonId, assignments]) => ({
        lessonId,
        lessonTitle: assignments[0]?.lessonTitle || 'Unnamed Lesson',
        assignments,
        courseId: assignments[0]?.classId || '',
        className: assignments[0]?.className || '',
      }));
      setAssignments(lessonGroups);
      // Calculate pending assignments
      const now = new Date();
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(now.getDate() + 7);
      const pendingAssignments = directAssignments.filter(assignment => {
        if (!assignment.dueDate) return false;
        const dueDate = new Date(assignment.dueDate);
        return dueDate > now && dueDate <= oneWeekFromNow;
      });
      setPendingAssignments(pendingAssignments);
      setLoading(false);
      return;
    }
    
    try {
      // Get all classes the student is enrolled in
      const enrolledClasses = await getClassesForStudent(studentId);
      if (!enrolledClasses || enrolledClasses.length === 0) {
        console.log('Student is not enrolled in any classes');
        
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
              await processEnrolledClasses(manuallyEnrolledClasses, studentId);
              return;
            }
          }
          
          // Rather than showing not enrolled message, just set loading to false
          // and let the published content check handle showing appropriate UI
          setLoading(false);
          
          // This is a secondary check - we'll fall back to checking for any published content 
          // before showing the "not enrolled" message
          await checkAllClassesForPublishedContent(studentId);
        } catch (finalError) {
          console.error("Final attempt to find classes failed:", finalError);
          setLoading(false);
          
          // Try as a last resort
          await checkAllClassesForPublishedContent(studentId);
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
      
      // Try as a last resort
      await checkAllClassesForPublishedContent(studentId);
    }
  };
  
  // Check for published assignments without requiring class enrollment
  const checkForDirectPublishedAssignments = async (studentId: string): Promise<EnrichedAssignment[]> => {
    try {
      if (typeof window === 'undefined') return [];

      console.log("Checking for direct published assignments");
      const allAssignments: EnrichedAssignment[] = [];

      // Fetch enrolled class IDs from Firestore users collection
      let enrolledClassIds: string[] = [];
      if (db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', studentId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (Array.isArray(userData.classes)) {
              enrolledClassIds = userData.classes;
              console.log(`Found ${enrolledClassIds.length} enrolled classes from Firestore user record`);
            } else {
              console.log('No classes array found in Firestore user record');
            }
          } else {
            console.log('No user document found in Firestore for student:', studentId);
          }
        } catch (firestoreUserError) {
          console.warn('Error fetching user from Firestore:', firestoreUserError);
        }
      }

      // If we have enrolled classes, search for published assignments for those classes
      if (enrolledClassIds.length > 0) {
        for (const classId of enrolledClassIds) {
          // Query for all published assignments for this class
          try {
            const assignmentsCollectionRef = collection(db, 'published_assignments');
            const q = query(
              assignmentsCollectionRef, 
              where('classId', '==', classId),
              where('isPublished', '==', true)
            );
            const querySnapshot = await getDocs(q);
            if (!(querySnapshot as any).empty) {
              (querySnapshot as any).forEach((docSnapshot: any) => {
                const assignmentData = docSnapshot.data();
                // Convert to EnrichedAssignment format
                allAssignments.push({
                  id: assignmentData.contentId,
                  title: assignmentData.title,
                  description: assignmentData.description,
                  type: assignmentData.type,
                  isPublished: true,
                  dueDate: assignmentData.dueDate,
                  classId: assignmentData.classId,
                  className: assignmentData.className,
                  lessonId: assignmentData.lessonId,
                  lessonTitle: assignmentData.lessonTitle,
                  problems: assignmentData.problems,
                  points: assignmentData.points
                });
              });
              console.log(`Found ${(querySnapshot as any).size} published assignments for class ${classId}`);
            }
          } catch (queryError) {
            console.error(`Error querying published assignments for class ${classId}:`, queryError);
          }
        }
      } else {
        console.log("No enrolled classes found for published assignments query");
      }

      // 2. Next try Firestore published_curricula collection
      try {
        console.log("Checking Firestore published_curricula collection");
        if (db) {
          // For each class, check for published curriculum in Firestore
          for (const classId of enrolledClassIds) {
            try {
              const publishedRef = doc(db, 'published_curricula', classId);
              const publishedSnap = await getDoc(publishedRef);
              if (publishedSnap.exists()) {
                const publishedData = publishedSnap.data();
                console.log(`Found published curriculum for class ${classId} in Firestore`);
                if (publishedData && publishedData.content) {
                  // Process this published curriculum to extract assignments
                  const classDetails = await storage.getClassById(classId);
                  const className = classDetails?.name || 'Class';
                  // Extract assignments from lessons
                  if (publishedData.content.lessons && Array.isArray(publishedData.content.lessons)) {
                    publishedData.content.lessons.forEach((lesson: any) => {
                      if (lesson.contents && Array.isArray(lesson.contents)) {
                        lesson.contents.forEach((content: any) => {
                          if (content.isPublished === true && 
                              (content.type === 'assignment' || content.type === 'quiz')) {
                            allAssignments.push({
                              ...content,
                              classId,
                              className,
                              lessonId: lesson.id,
                              lessonTitle: lesson.title
                            });
                          }
                        });
                      }
                    });
                  }
                }
              }
            } catch (classError) {
              console.warn(`Error checking published curriculum for class ${classId}:`, classError);
            }
          }
        }
      } catch (firestoreError) {
        console.warn("Error checking Firestore for published content:", firestoreError);
      }

      // If we found assignments, deduplicate and sort them by due date
      if (allAssignments.length > 0) {
        console.log(`Found a total of ${allAssignments.length} published assignments`);
        // Deduplicate assignments based on id
        const deduplicatedAssignments = Array.from(
          new Map(allAssignments.map(assignment => [assignment.id, assignment])).values()
        );
        console.log(`After deduplication: ${deduplicatedAssignments.length} unique assignments`);
        // Sort by due date
        return deduplicatedAssignments.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
      }
      return [];
    } catch (error) {
      console.error("Error checking for direct published assignments:", error);
      return [];
    }
  };

  // Check all available classes for published content
  const checkAllClassesForPublishedContent = async (studentId: string) => {
    try {
      // Get all classes from storage
      const allClasses = await storage.getClasses();
      if (!allClasses || !Array.isArray(allClasses) || allClasses.length === 0) {
        console.log("No classes available to check for content");
        
        // Now we can show the not enrolled message
        toast({
          title: "Not enrolled in any classes",
          description: "You are not currently enrolled in any classes. Please contact your teacher if this is an error.",
          variant: "default"
        });
        
        return;
      }
      
      console.log(`Checking ${allClasses.length} classes for published content`);
      
      // Process all classes to look for published content
      await processEnrolledClasses(allClasses, studentId);
    } catch (error) {
      console.error("Error checking all classes for content:", error);
      
      // Now show the error message
      toast({
        title: "Error loading classes",
        description: "There was a problem loading your enrolled classes. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };

  // Update the processEnrolledClasses function
  const processEnrolledClasses = async (enrolledClasses: any[], studentId: string) => {
    const allLessons: LessonGroup[] = [];
    const dueAssignments: EnrichedAssignment[] = [];
    let foundAnyPublishedContent = false;

    // For each class, load the curriculum and extract lessons with published assignments
    for (const classItem of enrolledClasses) {
      try {
        console.log(`Loading curriculum for class: ${classItem.id}`);
        let foundPublishedContent = false;
        
        // Try multiple sources for published content, in order of preference
        
        // 1. First try Firestore published_assignments collection (most reliable)
        try {
          const assignmentsCollectionRef = collection(db, 'published_assignments');
          const q = query(
            assignmentsCollectionRef, 
            where('classId', '==', classItem.id),
            where('isPublished', '==', true)
          );
          const querySnapshot = await getDocs(q);
          
          if (querySnapshot.docs.length > 0) {
            const firestoreAssignments: any[] = [];
            querySnapshot.docs.forEach((docSnapshot) => {
              const assignmentData = docSnapshot.data();
              // Only include if explicitly published
              if (assignmentData.isPublished === true) {
                firestoreAssignments.push({
                  id: assignmentData.contentId,
                  title: assignmentData.title,
                  description: assignmentData.description,
                  type: assignmentData.type,
                  isPublished: true,
                  dueDate: assignmentData.dueDate,
                  classId: assignmentData.classId,
                  className: assignmentData.className,
                  lessonId: assignmentData.lessonId,
                  lessonTitle: assignmentData.lessonTitle,
                  problems: assignmentData.problems,
                  points: assignmentData.points
                });
              }
            });
            
            if (firestoreAssignments.length > 0) {
              // Group by lesson
              const lessonGroups = firestoreAssignments.reduce((acc: Record<string, any[]>, content: any) => {
                const lessonId = content.lessonId || 'ungrouped';
                if (!acc[lessonId]) {
                  acc[lessonId] = [];
                }
                acc[lessonId].push(content);
                return acc;
              }, {});
              
              const groupedLessons = Object.entries(lessonGroups)
                .filter(([_, assignments]) => assignments.length > 0)
                .map(([lessonId, assignments]) => ({
                  lessonId,
                  lessonTitle: assignments[0]?.lessonTitle || 'Unnamed Lesson',
                  assignments: assignments as EnrichedAssignment[],
                  courseId: classItem.id,
                  className: classItem.name
                }));
              
              if (groupedLessons.length > 0) {
                allLessons.push(...groupedLessons);
                foundPublishedContent = true;
                foundAnyPublishedContent = true;
                
                // Check for assignments due soon
                const now = new Date();
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(now.getDate() + 7);
                
                groupedLessons.forEach(lesson => {
                  const pendingAssignments = lesson.assignments.filter((assignment: EnrichedAssignment) => {
                    if (!assignment.dueDate) return false;
                    const dueDate = new Date(assignment.dueDate);
                    return dueDate > now && dueDate <= oneWeekFromNow;
                  });
                  dueAssignments.push(...pendingAssignments);
                });
                
                console.log(`Found ${firestoreAssignments.length} published assignments from Firestore for class ${classItem.id}`);
              }
            }
          }
        } catch (firestoreError) {
          console.warn(`Error loading published assignments from Firestore for class ${classItem.id}:`, firestoreError);
        }
        
        // 2. Fallback to localStorage only if Firestore didn't have data
        if (!foundPublishedContent) {
        try {
          if (typeof window !== 'undefined') {
            const directPublishedContent = localStorage.getItem(`published-contents-${classItem.id}`);
            if (directPublishedContent) {
              const parsedContent = JSON.parse(directPublishedContent);
                console.log("Found direct published content in localStorage (fallback):", parsedContent);
              
              if (Array.isArray(parsedContent)) {
                  // Group assignments by lesson - STRICT filtering for isPublished === true
                const lessonGroups = parsedContent.reduce((acc: Record<string, any[]>, content: any) => {
                    // Only include if explicitly published (strict check)
                  if (content.isPublished === true && 
                      (content.type === 'assignment' || content.type === 'quiz')) {
                    const lessonId = content.lessonId || 'ungrouped';
                    if (!acc[lessonId]) {
                      acc[lessonId] = [];
                    }
                    acc[lessonId].push({
                      ...content,
                      classId: classItem.id,
                      className: classItem.name,
                      lessonTitle: content.lessonTitle || 'Unnamed Lesson'
                    });
                  }
                  return acc;
                }, {});

                console.log("Grouped assignments by lesson:", lessonGroups);

                // Convert grouped assignments to array format, only including lessons with published assignments
                const groupedLessons = Object.entries(lessonGroups)
                  .filter(([_, assignments]) => assignments.length > 0)
                  .map(([lessonId, assignments]) => ({
                    lessonId,
                    lessonTitle: assignments[0]?.lessonTitle || 'Unnamed Lesson',
                    assignments: assignments as EnrichedAssignment[],
                    courseId: classItem.id,
                    className: classItem.name
                  }));

                console.log("Converted to lesson groups:", groupedLessons);

                if (groupedLessons.length > 0) {
                  allLessons.push(...groupedLessons);
                foundPublishedContent = true;
                foundAnyPublishedContent = true;
                
                // Check for assignments due soon
                const now = new Date();
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(now.getDate() + 7);
                
                  groupedLessons.forEach(lesson => {
                    const pendingAssignments = lesson.assignments.filter((assignment: EnrichedAssignment) => {
                  if (!assignment.dueDate) return false;
                  const dueDate = new Date(assignment.dueDate);
                  return dueDate > now && dueDate <= oneWeekFromNow;
                });
                dueAssignments.push(...pendingAssignments);
                  });
              }
            }
          }
          }
        } catch (error) {
          console.warn(`Error loading direct published content: ${error}`);
          }
        }
        
        // 3. Final fallback: Try published curriculum format from localStorage
        if (!foundPublishedContent) {
          try {
            const publishedCurriculum = localStorage.getItem(`published-curriculum-${classItem.id}`);
            if (publishedCurriculum) {
              const parsedCurriculum = JSON.parse(publishedCurriculum);
              console.log("Found published curriculum in localStorage (fallback):", parsedCurriculum);
              
              if (parsedCurriculum.lessons && Array.isArray(parsedCurriculum.lessons)) {
                const lessonGroups = parsedCurriculum.lessons.reduce((acc: Record<string, any[]>, lesson: any) => {
                  if (lesson.contents && Array.isArray(lesson.contents)) {
                    // STRICT filtering - only isPublished === true
                    const publishedContents = lesson.contents.filter((content: any) => 
                      content && content.isPublished === true && 
                      (content.type === 'assignment' || content.type === 'quiz')
                    );

                    if (publishedContents.length > 0) {
                      const lessonId = lesson.id || 'ungrouped';
                      acc[lessonId] = publishedContents.map((content: any) => ({
                          ...content,
                          classId: classItem.id,
                        className: classItem.name,
                        lessonId: lesson.id,
                        lessonTitle: lesson.title
                      }));
                    }
                  }
                  return acc;
                }, {});

                const groupedLessons = Object.entries(lessonGroups)
                  .filter(([_, assignments]) => assignments.length > 0)
                  .map(([lessonId, assignments]) => ({
                    lessonId,
                    lessonTitle: assignments[0]?.lessonTitle || 'Unnamed Lesson',
                    assignments: assignments as EnrichedAssignment[],
                    courseId: classItem.id,
                    className: classItem.name
                  }));

                if (groupedLessons.length > 0) {
                  allLessons.push(...groupedLessons);
                    foundPublishedContent = true;
                    foundAnyPublishedContent = true;
                    
                    // Check for assignments due soon
                    const now = new Date();
                    const oneWeekFromNow = new Date();
                    oneWeekFromNow.setDate(now.getDate() + 7);
                    
                  groupedLessons.forEach(lesson => {
                    const pendingAssignments = lesson.assignments.filter((assignment: EnrichedAssignment) => {
                      if (!assignment.dueDate) return false;
                      const dueDate = new Date(assignment.dueDate);
                      return dueDate > now && dueDate <= oneWeekFromNow;
                    });
                    dueAssignments.push(...pendingAssignments);
                  });
                }
              }
            }
          } catch (error) {
            console.warn(`Error loading published curriculum: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error loading assignments for class ${classItem.id}:`, error);
      }
    }

    console.log(`Found a total of ${allLessons.length} lessons with published assignments across all classes`);
    console.log("All lessons:", allLessons);
    
    // Sort lessons by title
    const sortedLessons = allLessons.sort((a, b) => 
      a.lessonTitle.localeCompare(b.lessonTitle)
    );
    
    // Update state
    setAssignments(sortedLessons);
    setPendingAssignments(dueAssignments);
    setLoading(false);
  };

  // Load assignment scores from Firestore
  const loadAssignmentScores = async (studentId: string) => {
    if (!db || !studentId) return;
    
    try {
      const scores: Record<string, { score: number; status: string }> = {};
      
      // Get all classes the student is enrolled in
      const enrolledClasses = await getClassesForStudent(studentId);
      
      for (const cls of enrolledClasses) {
        if (!cls.id) continue;
        
        try {
          // Query all student answers for this class
          const answersRef = collection(db, 'student-answers', cls.id, 'answers');
          const q = query(answersRef, where('studentId', '==', studentId));
          const querySnapshot = await getDocs(q);
          
          // Group answers by contentId
          const answersByContent: Record<string, any[]> = {};
          querySnapshot.docs.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            const contentId = data.contentId;
            if (contentId) {
              if (!answersByContent[contentId]) {
                answersByContent[contentId] = [];
              }
              answersByContent[contentId].push(data);
            }
          });
          
          // Calculate scores for each content
          Object.entries(answersByContent).forEach(([contentId, answers]) => {
            const submittedAnswers = answers.filter(a => a.submitted === true || a.status === 'submitted' || a.status === 'completed');
            if (submittedAnswers.length > 0) {
              const totalScore = submittedAnswers.reduce((sum, a) => sum + (a.score || 0), 0);
              const maxScore = submittedAnswers.reduce((sum, a) => sum + (a.problemPoints || 1), 0);
              const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
              
              // Check if all problems are completed
              const allCompleted = submittedAnswers.every(a => a.status === 'completed' || a.submitted === true);
              
              scores[contentId] = {
                score: percentage,
                status: allCompleted ? 'Completed' : 'In Progress'
              };
            } else {
              scores[contentId] = {
                score: 0,
                status: 'Not Started'
              };
            }
          });
        } catch (error) {
          console.error(`Error loading scores for class ${cls.id}:`, error);
        }
      }
      
      setAssignmentScores(scores);
    } catch (error) {
      console.error('Error loading assignment scores:', error);
    }
  };

  // Update progress when answering questions
  const handleAnswerSubmit = async (assignmentId: string, problemId: string, answer: string) => {
    try {
      const studentId = localStorage.getItem('userId')
      if (!studentId) return

      // Find the assignment in all lessons
      let foundAssignment: EnrichedAssignment | undefined = undefined;
      let lessonIdx = -1;
      let assignmentIdx = -1;
      (assignments as LessonGroup[]).forEach((lesson, lIdx) => {
        const aIdx = lesson.assignments.findIndex(a => a.id === assignmentId);
        if (aIdx !== -1) {
          foundAssignment = lesson.assignments[aIdx];
          lessonIdx = lIdx;
          assignmentIdx = aIdx;
        }
      });
      if (!foundAssignment) return;

      const currentProgress = foundAssignment.progress || {
        studentId,
        assignmentId,
        courseId: foundAssignment.classId,
        status: 'in-progress',
        currentProblem: 0,
        answers: {}
      }

      const updatedProgress = {
        ...currentProgress,
        answers: {
          ...currentProgress.answers,
          [problemId]: {
            answer,
            submittedAt: new Date()
          }
        }
      }

      // Check if all problems are answered
      const allProblemsAnswered = foundAssignment.problems && foundAssignment.problems.every(
        (problem: any) => updatedProgress.answers[problem.id]
      )

      if (allProblemsAnswered) {
        updatedProgress.status = 'completed'
        updatedProgress.completedAt = new Date()
      }

      await updateStudentProgress(updatedProgress)

      // Update local state
      setAssignments(prev => (prev as LessonGroup[]).map((lesson, lIdx) => {
        if (lIdx !== lessonIdx) return lesson;
        return {
          ...lesson,
          assignments: lesson.assignments.map((a, aIdx) =>
            aIdx === assignmentIdx ? { ...a, progress: updatedProgress } : a
          )
        };
      }))
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

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
      title: "Announcements",
      href: "/student/announcements",
      icon: Bell,
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
        <Sidebar navigation={navigation} user={currentUser} />
        <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img src="/logo.png" alt="Education More" className="h-8" />
                <h2 className="text-lg font-semibold">Education More</h2>
              </div>
              <h1 className="text-3xl font-bold">Lessons</h1>
              <p className="text-muted-foreground">
                View your lessons with published assignments
              </p>
            </div>
          </div>

          <div className="flex flex-col space-y-6">
            {/* Lessons Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4">All Lessons</h2>
              <div className="space-y-6">
                {assignments.length > 0 ? (
                  assignments.map((lessonGroup) => (
                    <Card key={lessonGroup.lessonId}>
                      <CardHeader>
                        <CardTitle>{lessonGroup.lessonTitle}</CardTitle>
                        <CardDescription>
                          {lessonGroup.className} • {lessonGroup.assignments.length} published assignments
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          This lesson contains {lessonGroup.assignments.length} published assignments. 
                          Click below to view and complete them.
                        </p>
                        {lessonGroup.courseId && lessonGroup.lessonId ? (
                          <Button asChild className="w-full">
                            <Link href={`/student/curriculum/${lessonGroup.courseId}?lesson=${lessonGroup.lessonId}`}
                              onClick={() => console.log('Navigating to:', `/student/curriculum/${lessonGroup.courseId}?lesson=${lessonGroup.lessonId}`)}>
                              View Lesson
                            </Link>
                          </Button>
                        ) : (
                          <div className="text-red-500 text-xs mt-2">Lesson or class ID missing for this lesson. Cannot view lesson.</div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">No lessons with published assignments found</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser} />
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
        <Sidebar navigation={navigation} user={currentUser} />
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

  // Debug all assignments
  console.log("DEBUG - All assignments before filtering:", assignments);
  console.log("DEBUG - Pending assignments count:", pendingAssignments.length);
  console.log("DEBUG - Upcoming assignments count:", upcomingAssignments.length);
  console.log("DEBUG - Overdue assignments count:", overdueAssignments.length);
  console.log("DEBUG - Completed assignments count:", completedAssignments.length);

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
              View and complete your assignments
            </p>
          </div>
        </div>

        {/* Flatten all assignments from all lessons */}
        {(() => {
          const allAssignments: (EnrichedAssignment & { lessonTitle: string })[] = [];
          assignments.forEach(lessonGroup => {
            lessonGroup.assignments.forEach(assignment => {
              allAssignments.push({
                ...assignment,
                lessonTitle: lessonGroup.lessonTitle
              });
            });
          });

          // Separate into classwork and homework
          const classworkAssignments = allAssignments.filter(a => 
            a.type === 'classwork' || 
            a.type === 'guided-practice' || 
            a.type === 'test' || 
            a.type === 'quiz' || 
            a.type === 'new-material'
          );
          
          const homeworkAssignments = allAssignments.filter(a => 
            a.type === 'homework'
          );

          return (
            <Tabs defaultValue="classwork" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="classwork">Classwork</TabsTrigger>
                <TabsTrigger value="homework">Homework</TabsTrigger>
              </TabsList>
              
              <TabsContent value="classwork" className="mt-6">
                <Card>
                    <CardHeader>
                    <CardTitle>Classwork Assignments</CardTitle>
                        <CardDescription>
                      All classwork, guided practice, tests, quizzes, and new material
                        </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {classworkAssignments.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Assignment Lesson</TableHead>
                            <TableHead>Assignment Name</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {classworkAssignments.map((assignment) => {
                            const scoreData = assignmentScores[assignment.id || ''] || { score: 0, status: 'Not Started' };
                            return (
                              <TableRow key={assignment.id}>
                                <TableCell className="font-medium">{assignment.lessonTitle}</TableCell>
                                <TableCell>{assignment.title}</TableCell>
                                <TableCell className="text-right">
                                  {scoreData.score > 0 ? `${scoreData.score}%` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={
                                    scoreData.status === 'Completed' ? 'default' :
                                    scoreData.status === 'In Progress' ? 'secondary' :
                                    'outline'
                                  }>
                                    {scoreData.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/student/assignments/${assignment.classId}/${assignment.id}`}>
                                      View
                        </Link>
                      </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No classwork assignments found</p>
                      </div>
                    )}
                    </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="homework" className="mt-6">
              <Card>
                  <CardHeader>
                    <CardTitle>Homework Assignments</CardTitle>
                    <CardDescription>
                      All homework assignments
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {homeworkAssignments.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Assignment Lesson</TableHead>
                            <TableHead>Assignment Name</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {homeworkAssignments.map((assignment) => {
                            const scoreData = assignmentScores[assignment.id || ''] || { score: 0, status: 'Not Started' };
                            return (
                              <TableRow key={assignment.id}>
                                <TableCell className="font-medium">{assignment.lessonTitle}</TableCell>
                                <TableCell>{assignment.title}</TableCell>
                                <TableCell className="text-right">
                                  {scoreData.score > 0 ? `${scoreData.score}%` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={
                                    scoreData.status === 'Completed' ? 'default' :
                                    scoreData.status === 'In Progress' ? 'secondary' :
                                    'outline'
                                  }>
                                    {scoreData.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={`/student/assignments/${assignment.classId}/${assignment.id}`}>
                                      View
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No homework assignments found</p>
                      </div>
                    )}
                </CardContent>
              </Card>
              </TabsContent>
            </Tabs>
          );
        })()}
      </div>
    </div>
  )
} 