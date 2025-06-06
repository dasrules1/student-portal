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
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  progress?: StudentProgress;
}

export default function StudentAssignments() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [assignments, setAssignments] = useState<EnrichedAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingAssignments, setPendingAssignments] = useState<EnrichedAssignment[]>([])

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
                  password: "",
                  status: "active",
                  classes: []
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
      setAssignments(directAssignments);
      
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
      
      // NEW: First try the specialized published_assignments collection
      try {
        console.log("Checking published_assignments collection");
        if (db) {
          // Get classes student is enrolled in
          let enrolledClassIds: string[] = [];
          
          // Try getting direct enrollment record from localStorage first
          const enrollmentsKey = `student-enrollments-${studentId}`;
          const enrollmentsJson = localStorage.getItem(enrollmentsKey);
          
          if (enrollmentsJson) {
            try {
              const parsedEnrollments = JSON.parse(enrollmentsJson);
              if (Array.isArray(parsedEnrollments)) {
                enrolledClassIds = parsedEnrollments;
                console.log(`Found ${enrolledClassIds.length} enrolled classes in direct localStorage record`);
              }
            } catch (parseError) {
              console.warn("Error parsing enrollments from localStorage:", parseError);
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
                
                if (!querySnapshot.empty) {
                  querySnapshot.forEach((docSnapshot) => {
                    const assignmentData = docSnapshot.data();
                    console.log(`Found published assignment: ${assignmentData.title}`);
                    
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
                  
                  console.log(`Found ${querySnapshot.size} published assignments for class ${classId}`);
                }
              } catch (queryError) {
                console.error(`Error querying published assignments for class ${classId}:`, queryError);
              }
            }
          } else {
            console.log("No enrolled classes found for published assignments query");
          }
        }
      } catch (publishedAssignmentsError) {
        console.warn("Error checking published_assignments collection:", publishedAssignmentsError);
      }
      
      // 2. Next try Firestore published_curricula collection
      try {
        console.log("Checking Firestore published_curricula collection");
        if (db) {
          // Get classes the student is enrolled in to check each one
          let enrolledClassIds: string[] = [];
          
          // Try getting direct enrollment record from localStorage first
          const enrollmentsKey = `student-enrollments-${studentId}`;
          const enrollmentsJson = localStorage.getItem(enrollmentsKey);
          
          if (enrollmentsJson) {
            try {
              const parsedEnrollments = JSON.parse(enrollmentsJson);
              if (Array.isArray(parsedEnrollments)) {
                enrolledClassIds = parsedEnrollments;
                console.log(`Found ${enrolledClassIds.length} enrolled classes in direct localStorage record`);
              }
            } catch (parseError) {
              console.warn("Error parsing enrollments from localStorage:", parseError);
            }
          }
          
          // If no direct record, try getting the user to see their classes
          if (enrolledClassIds.length === 0) {
            const user = await storage.getUserById(studentId);
            if (user && Array.isArray(user.classes)) {
              enrolledClassIds = user.classes;
              console.log(`Found ${enrolledClassIds.length} enrolled classes from user record`);
            }
          }
          
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
      
      // 3. Then check localStorage including new direct keys
      // Check for direct assignment publications in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // Check if it's a published content key (check all formats)
        if (key.startsWith('published-contents-') || 
            key.startsWith('published-curriculum-') ||
            key.startsWith('assignment-')) {
          try {
            const content = localStorage.getItem(key);
            if (content) {
              const parsedContent = JSON.parse(content);
              
              // Handle array format (published-contents)
              if (Array.isArray(parsedContent)) {
                // Filter for assignment and quiz type content
                const assignments = parsedContent.filter(item => 
                  item && item.isPublished === true && 
                  (item.type === 'assignment' || item.type === 'quiz')
                );
                
                if (assignments.length > 0) {
                  console.log(`Found ${assignments.length} assignments in ${key}`);
                  allAssignments.push(...assignments);
                }
              } 
              // Handle single assignment format (assignment-classId-contentId)
              else if (key.startsWith('assignment-') && 
                      parsedContent.isPublished === true &&
                      (parsedContent.type === 'assignment' || parsedContent.type === 'quiz')) {
                console.log(`Found direct assignment in ${key}`);
                allAssignments.push(parsedContent);
              }
              // Handle nested format (published-curriculum)
              else if (parsedContent.lessons && Array.isArray(parsedContent.lessons)) {
                const extractedAssignments: EnrichedAssignment[] = [];
                
                parsedContent.lessons.forEach((lesson: any) => {
                  if (lesson.contents && Array.isArray(lesson.contents)) {
                    lesson.contents.forEach((content: any) => {
                      if (content.isPublished === true && 
                         (content.type === 'assignment' || content.type === 'quiz')) {
                        extractedAssignments.push({
                          ...content,
                          classId: content.classId || lesson.classId || '',
                          className: content.className || lesson.className || 'Class',
                          lessonId: lesson.id,
                          lessonTitle: lesson.title
                        });
                      }
                    });
                  }
                });
                
                if (extractedAssignments.length > 0) {
                  console.log(`Found ${extractedAssignments.length} assignments in nested curriculum format`);
                  allAssignments.push(...extractedAssignments);
                }
              }
            }
          } catch (keyError) {
            console.warn(`Error processing key ${key}:`, keyError);
          }
        }
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
            const curriculum = await storage.getCurriculum(classItem.id, 'student');
            
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
    console.log(`Extracting assignments from content for class ${classItem.name}`);
    
    // Log the full structure to debug
    console.log("Content structure:", JSON.stringify(content).substring(0, 500) + "...");
    
    // Handle indexed/numeric lesson structure (content.0, content.1, etc.)
    // This needs to be checked first for the format from the API
    if (typeof content === 'object' && content !== null) {
      // Check for numeric keys that might be lessons
      const numericKeys = Object.keys(content).filter(key => !isNaN(Number(key)));
      
      if (numericKeys.length > 0) {
        console.log(`Found indexed structure with ${numericKeys.length} potential lessons`);
        
        for (const lessonIdx of numericKeys) {
          const lesson = content[lessonIdx];
          
          if (lesson && typeof lesson === 'object') {
            const lessonId = lesson.id || `lesson_${lessonIdx}`;
            const lessonTitle = lesson.title || `Lesson ${lessonIdx}`;
            
            console.log(`Processing indexed lesson: ${lessonTitle}`);
            
            // Check for contents array
            if (lesson.contents && Array.isArray(lesson.contents)) {
              for (const item of lesson.contents) {
                if (item && 
                    item.isPublished === true && 
                    (item.type === 'assignment' || item.type === 'quiz' || 
                     item.type === 'homework' || item.type === 'test')) {
                  
                  console.log(`Found published ${item.type}: ${item.title}`);
                  
                  extractedAssignments.push({
                    ...item,
                    classId: classItem.id,
                    className: classItem.name,
                    lessonId: lessonId,
                    lessonTitle: lessonTitle
                  });
                }
              }
            }
          }
        }
        
        // If we've found assignments in the indexed structure, return them
        if (extractedAssignments.length > 0) {
          console.log(`Successfully extracted ${extractedAssignments.length} assignments from indexed structure`);
          return extractedAssignments;
        }
      }
    }
    
    // Check for numeric keys directly in content.contents
    if (content.contents && typeof content.contents === 'object' && content.contents !== null) {
      const numericContentKeys = Object.keys(content.contents).filter(key => !isNaN(Number(key)));
      
      if (numericContentKeys.length > 0) {
        console.log(`Found indexed structure with ${numericContentKeys.length} potential content items`);
        
        for (const contentIdx of numericContentKeys) {
          const item = content.contents[contentIdx];
          
          if (item && 
              item.isPublished === true && 
              (item.type === 'assignment' || item.type === 'quiz' || 
               item.type === 'homework' || item.type === 'test')) {
            
            console.log(`Found published ${item.type} in content.contents: ${item.title}`);
            
            extractedAssignments.push({
              ...item,
              classId: classItem.id,
              className: classItem.name,
              lessonId: item.lessonId || '',
              lessonTitle: item.lessonTitle || ''
            });
          }
        }
        
        if (extractedAssignments.length > 0) {
          console.log(`Successfully extracted ${extractedAssignments.length} assignments from content.contents structure`);
          return extractedAssignments;
        }
      }
    }
    
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
            console.log(`Found ${assignments.length} published assignments in lesson ${lesson.title}`);
            extractedAssignments.push(...assignments);
          }
        }
        
        // Extract from lesson contents array
        if (lesson.contents && Array.isArray(lesson.contents)) {
          const assignmentContents = lesson.contents
            .filter((content: Content) => 
              content && 
              content.isPublished === true && 
              (content.type === 'assignment' || content.type === 'quiz' || 
               content.type === 'homework' || content.type === 'test')
            )
            .map((content: Content) => ({
              ...content,
              classId: classItem.id,
              className: classItem.name,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            }));
          
          if (assignmentContents.length > 0) {
            console.log(`Found ${assignmentContents.length} published assignment contents in lesson ${lesson.title}`);
            extractedAssignments.push(...assignmentContents);
          }
        }
        
        // Handle content property as well (some data models use this)
        if (lesson.content && Array.isArray(lesson.content)) {
          const assignmentContents = lesson.content
            .filter((content: Content) => 
              content && 
              content.isPublished === true && 
              (content.type === 'assignment' || content.type === 'quiz' || 
               content.type === 'homework' || content.type === 'test')
            )
            .map((content: Content) => ({
              ...content,
              classId: classItem.id,
              className: classItem.name,
              lessonId: lesson.id,
              lessonTitle: lesson.title
            }));
          
          if (assignmentContents.length > 0) {
            console.log(`Found ${assignmentContents.length} published assignment contents in lesson ${lesson.title}`);
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
                  (content.type === 'assignment' || content.type === 'quiz' || 
                   content.type === 'homework' || content.type === 'test')
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
    
    if (extractedAssignments.length > 0) {
      console.log(`Successfully extracted ${extractedAssignments.length} assignments from class ${classItem.name}`);
    } else {
      console.log(`No published content found for class ${classItem.name} (${classItem.id})`);
    }
    
    return extractedAssignments;
  };

  // Update progress when answering questions
  const handleAnswerSubmit = async (assignmentId: string, problemId: string, answer: string) => {
    try {
      const studentId = localStorage.getItem('userId')
      if (!studentId) return

      const assignment = assignments.find(a => a.id === assignmentId)
      if (!assignment) return

      const currentProgress = assignment.progress || {
        studentId,
        assignmentId,
        courseId: assignment.courseId,
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
      const allProblemsAnswered = assignment.problems.every(
        problem => updatedProgress.answers[problem.id]
      )

      if (allProblemsAnswered) {
        updatedProgress.status = 'completed'
        updatedProgress.completedAt = new Date()
      }

      await updateStudentProgress(updatedProgress)

      // Update local state
      setAssignments(prev => prev.map(a => 
        a.id === assignmentId 
          ? { ...a, progress: updatedProgress }
          : a
      ))
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
                          {assignment.className} • Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No due date"}
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
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}&type=${assignment.type}`}>
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
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}&type=${assignment.type}`}>
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
        <section className="mb-8">
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
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}&type=${assignment.type}`}>
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
        
        {/* All Assignments (for debugging) */}
        <section>
          <h2 className="text-xl font-semibold mb-4">All Available Assignments</h2>
          <div className="space-y-4">
            {assignments.length > 0 ? (
              assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{assignment.title}</CardTitle>
                        <CardDescription>
                          {assignment.className} • {assignment.lessonTitle ? `Lesson: ${assignment.lessonTitle}` : ''} 
                          {assignment.dueDate ? ` • Due: ${new Date(assignment.dueDate).toLocaleDateString()}` : ' • No due date'}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">{assignment.type === 'quiz' ? 'Quiz' : 'Assignment'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{assignment.description || "No description provided"}</p>
                    <p className="text-sm mt-2">
                      <strong>Debug info:</strong> ID: {assignment.id} • Type: {assignment.type} • 
                      Published: {assignment.isPublished ? 'Yes' : 'No'} • 
                      Completed: {assignment.completed ? 'Yes' : 'No'}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      asChild 
                      className="w-full"
                    >
                      <Link href={`/student/curriculum/${assignment.classId}?lesson=${assignment.lessonId}&content=${assignment.id}&type=${assignment.type}`}>
                        View Assignment
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No assignments found at all</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  )
} 