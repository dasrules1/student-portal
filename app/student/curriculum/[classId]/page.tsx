"use client"

import * as React from 'react';
import { useState, useEffect, FC } from 'react';
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ref, set, push, serverTimestamp, get, onValue } from "firebase/database";
import { 
  BookOpen,
  ClipboardCheck,
  Pencil,
  CheckCircle2,
  Clock,
  Send,
  ArrowLeft,
  ArrowRight,
  Video,
  AlertCircle,
  Check,
  X,
  FileText,
  FileQuestion
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { realtimeDb } from '@/lib/firebase';
import { sessionManager } from '@/lib/session';
import { storage } from '@/lib/storage';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

// Types for state management
interface RealTimeUpdate {
  value: string;
  type: 'multiple_choice' | 'math_expression' | 'open_ended';
  timestamp: string;
  problemId: string;
}

interface Session {
  userId: string
}

declare module '@/lib/session' {
  interface SessionManager {
    getSession(): Session | null
  }
}

// Content types for curriculum
const getContentIcon = (type: string) => {
  switch (type) {
    case "new-material":
      return <BookOpen className="w-4 h-4 mr-2" />;
    case "guided-practice":
      return <PencilLine className="w-4 h-4 mr-2" />;
    case "classwork":
      return <ClipboardList className="w-4 h-4 mr-2" />;
    case "homework":
      return <FileText className="w-4 h-4 mr-2" />;
    case "quiz":
      return <FileQuestion className="w-4 h-4 mr-2" />;
    case "test":
      return <FileText className="w-4 h-4 mr-2" />;
    default:
      return null;
  }
};

type ToasterToast = Toast & {
  dismiss: () => void;
  update: (props: Toast) => void;
};

// Install required type definitions
// npm install --save-dev @types/lucide-react @types/next
// Types
interface Content {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'assignment' | 'homework' | 'test' | 'classwork';
  description: string;
  problems?: Problem[];
}

interface Problem {
  id: string;
  type: 'multiple-choice' | 'math-expression' | 'open-ended';
  question: string;
  correctAnswer: string;
  points: number;
  options?: string[];
  explanation?: string;
}

interface ProblemSubmission {
  problemId: string;
  answer: string | number;
  score?: number;
  correct?: boolean;
  feedback?: string;
  studentId?: string;
  status?: 'completed' | 'in_progress';
}

interface UserAnswers {
  [contentId: string]: {
    [problemId: string]: ProblemSubmission;
  };
}

interface UserGrades {
  [contentId: string]: {
    totalScore: number;
    maxScore: number;
    submissions: ProblemSubmission[];
  };
}

interface GradingResult {
  correct: boolean;
  score: number;
}

interface ProblemScores {
  [key: string]: number;
}

interface SubmittedProblems {
  [problemId: string]: boolean;
}

interface AttemptCounts {
  [contentId: string]: {
    [problemIndex: number]: number;
  };
}

interface Lesson {
  id: string;
  title: string;
  contents?: Content[];
  assignments?: Content[];
  quizzes?: Content[];
}

interface Curriculum {
  lessons: Lesson[];
  lastUpdated?: string;
}

interface UserSubmission {
  studentId: string;
  status: string;
  score?: number;
}

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

type ProblemType = 'multiple-choice' | 'math-expression' | 'open-ended';

interface ContentState {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'assignment';
  problems?: Problem[];
  status: 'not_started' | 'in_progress' | 'completed';
  score?: number;
  totalPoints?: number;
}

interface Content {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'assignment';
  description?: string;
  isPublished?: boolean;
  dueDate?: string;
  completed?: boolean;
  completedAt?: string;
  problems?: Problem[];
}

interface AttemptCounts {
  [key: string]: number;
}

interface StudentCurriculumProps {
  classId?: string;
}

const StudentCurriculum: React.FC<StudentCurriculumProps> = ({ classId }) => {
  const router = useRouter();
  const [activeContent, setActiveContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const answersRef = useRef<UserAnswers>({});
  const [problemIndex, setProblemIndex] = useState(0);

  const getContentTypeIcon = (type: Content['type']) => {
    switch (type) {
      case 'lesson':
        return <BookOpen className="w-4 h-4" />;
      case 'quiz':
        return <ClipboardCheck className="w-4 h-4" />;
      case 'assignment':
        return <Pencil className="w-4 h-4" />;
      case 'homework':
        return <FileText className="w-4 h-4" />;
      case 'test':
        return <FileQuestion className="w-4 h-4" />;
      case 'classwork':
        return <ClipboardCheck className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const sendRealTimeUpdate = async (contentId: string, problemId: string, answer: string | number) => {
    if (!activeContent) return;
    
    try {
      // Add real-time update logic here
      console.log('Sending real-time update:', { contentId, problemId, answer });
    } catch (error) {
      console.error('Error sending real-time update:', error);
    }
  };

  const getProblemScore = (problem: Problem, userAnswer: string | number): number => {
    if (!problem.correctAnswer) return 0;
    if (typeof userAnswer === 'string' && typeof problem.correctAnswer === 'string') {
      return userAnswer.toLowerCase() === problem.correctAnswer.toLowerCase() ? problem.points : 0;
    }
    return userAnswer === problem.correctAnswer ? problem.points : 0;
  };

  useEffect(() => {
    const loadContent = async () => {
      if (!classId) return;
      
      try {
        // Add content loading logic here
        setLoading(false);
      } catch (error) {
        setError('Failed to load content');
        setLoading(false);
      }
    };

    loadContent();
  }, [classId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!activeContent) return <div>No content found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-bold">{activeContent.title}</h1>
        {/* Content type indicator */}
        <div className="flex items-center text-sm text-gray-600">
          {getContentTypeIcon(activeContent.type)}
          <span className="ml-1 capitalize">{activeContent.type}</span>
        </div>
        {/* Main content */}
        <div className="prose max-w-none">
          {activeContent.description}
        </div>
      </div>
    </div>
  );

  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [studentInfo, setStudentInfo] = useState({
    status: 'in_progress' as 'completed' | 'in_progress',
    score: 0,
    name: '',
    id: '',
    email: '',
    avatar: '',
    grade: '',
    class: '',
    school: '',
    district: '',
    state: '',
    country: '',
    isActive: false,
    lastActive: 0
  });
  const [problemState, setProblemState] = useState({
    type: '',
    points: 0,
    classId: '',
    contentId: '',
    contentTitle: '',
    correct: false,
    score: 0
  });

  const answersRef = useRef<UserAnswers>({});
  const [problemIndex, setProblemIndex] = useState(0);

  const renderLatex = (text: string) => {
    // Add latex rendering logic here
    return text;
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'lesson':
        return <BookOpen className="w-4 h-4" />;
      case 'quiz':
        return <ClipboardList className="w-4 h-4" />;
      case 'assignment':
        return <PencilLine className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };


const StudentCurriculum: React.FC<StudentCurriculumProps> = () => {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string
  
  // Read query parameters
  const [queryParams, setQueryParams] = useState<{
    lesson?: string;
    content?: string;
  }>({})
  
  // Get query parameters on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const lessonParam = urlParams.get('lesson')
      const contentParam = urlParams.get('content')
      
      console.log("URL Parameters:", { lessonParam, contentParam })
      
      setQueryParams({
        lesson: lessonParam || undefined,
        content: contentParam || undefined
      })
    }
  }, [])

  // Class and curriculum state
  const [currentClass, setCurrentClass] = useState<{
    id: string;
    name: string;
    description?: string;
    curriculum?: Curriculum;
    teacher?: string;
    virtualLink?: string;
    meeting_day?: string;
    meetingDates?: string[];
    startTime?: string;
    endTime?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  } | null>(null)
  
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [activeLesson, setActiveLesson] = useState<number>(1)
  const [activeContent, setActiveContent] = useState<Content | null>(null)
  
  // Answer state management
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [userGrades, setUserGrades] = useState<{
    [contentId: string]: {
      [problemIndex: number]: {
        score: number;
        correct: boolean;
      }
    }
  }>({})  
  
  const [showResults, setShowResults] = useState<boolean>(false)  
  
  const [attemptCounts, setAttemptCounts] = useState<{
    [contentId: string]: {
      [problemIndex: number]: number
    }
  }>({})  
  
  // User and content state
  const [currentUser, setCurrentUser] = useState<User | null>(null)  
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(null)  
  const [lessonsWithContent, setLessonsWithContent] = useState<Array<{
    id: string;
    title: string;
    contents: Content[];
  }>>([])

  
  const [mathExpressionInputs, setMathExpressionInputs] = useState<Record<string, string[]>>({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState<Record<string, string>>({});
  
  // Load saved answers with offline support

  const [problemScores, setProblemScores] = useState<ProblemScores>({})  
  const [submittedProblems, setSubmittedProblems] = useState<SubmittedProblems>({})  
  const [problemState, setProblemState] = useState<ProblemState>({})

  // Real-time updates listener
  useEffect(() => {
    if (!currentUser?.id || !activeContent?.id) return

    const updatesRef = ref(realtimeDb, `updates/${currentUser.id}/${activeContent.id}`)
    const unsubscribe = onValue(updatesRef, (snapshot) => {
      const updates = snapshot.val() as Record<string, RealTimeUpdate>
      if (!updates) return

      Object.entries(updates).forEach(([problemIndex, update]) => {
        const index = parseInt(problemIndex)
        if (isNaN(index)) return

        setUserAnswers(prev => ({
          ...prev,
          [activeContent.id]: {
            ...(prev[activeContent.id] || {}),
            [index]: update.value
          }
        }))
      })
    })

    return () => unsubscribe()
  }, [currentUser?.id, activeContent?.id])
  
  // Save answers when user navigates away or closes tab
  useEffect(() => {
    if (!activeContent || !currentUser) return
    
    // Function to save answers before unloading
    const saveBeforeUnload = () => {
      console.log("Saving answers before unload...")
      saveAnswers(activeContent)
    }
    
    // Add event listeners for page unload
    window.addEventListener('beforeunload', saveBeforeUnload)
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('beforeunload', saveBeforeUnload)
      // Also save when unmounting component (e.g., navigating to another page)
      saveBeforeUnload()
    }
  }, [activeContent, userAnswers, currentUser])
  
  // Auto-save answers periodically
  useEffect(() => {
    if (!activeContent || !currentUser) return
    
    // Set up auto-save interval (every 30 seconds)
    const autoSaveInterval = setInterval(() => {
      console.log("Auto-saving answers...")
      saveAnswers(activeContent)
    }, 30000) // 30 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(autoSaveInterval)
  }, [activeContent, userAnswers, currentUser])

  // Load class and curriculum data
  useEffect(() => {
    const loadClassAndCurriculum = async () => {
      // Check if user is a student
      const user = sessionManager.getCurrentUser()
      if (!user || user.role !== "student") {
        toast({
          title: "Access denied",
          description: "You must be logged in as a student to view this page",
          variant: "destructive",
        })
        router.push("/student")
        return
      }

      // Cast user to User type
      const typedUser = user.user as unknown as User;
      setCurrentUser(typedUser);

      // Try to get class from storage
      try {
        // Get classes and make sure it's an array before using .find()
        const classes = await storage.getClasses();
        console.log("DEBUG - ClassId from URL:", classId);
        console.log("DEBUG - Retrieved classes count:", Array.isArray(classes) ? classes.length : "Not an array");
        
        if (Array.isArray(classes)) {
          // Log class IDs for debugging
          console.log("DEBUG - Available class IDs:", classes.map(c => c && c.id).filter(Boolean));
          
          // Try to find the class with more flexible matching
          const foundClass = classes.find((c) => {
            if (!c) return false;
            console.log(`DEBUG - Comparing class ID: ${c.id} with URL classId: ${classId}`);
            return c.id === classId || c.id?.includes(classId) || classId.includes(c.id);
          });
          
          console.log("DEBUG - Found class:", foundClass ? "Yes - " + foundClass.name : "No class found with this ID");
          
          if (foundClass) {
            // Enhanced debug logging for enrollment check
            console.log("DEBUG - Current user:", JSON.stringify(typedUser));
            
            // Check if user has an id directly or nested in user property
            const userId = typedUser.id;
            console.log("DEBUG - User ID for enrollment check:", userId);
            
            // Debug enrolled students array
            console.log("DEBUG - Class enrolled students:", 
              foundClass.enrolledStudents && Array.isArray(foundClass.enrolledStudents) 
                ? foundClass.enrolledStudents 
                : "No enrolled students array");
            
            // More flexible enrollment check that handles different user ID formats
            const isEnrolled = 
              // Standard check
              (foundClass.enrolledStudents && 
               Array.isArray(foundClass.enrolledStudents) && 
               foundClass.enrolledStudents.includes(userId)) ||
              // Special check for non-standard enrollment format
              (Array.isArray(foundClass.students) && 
               foundClass.students.includes(userId)) ||
              // Check user classes if available
              (typedUser.classes && Array.isArray(typedUser.classes) && 
               typedUser.classes.includes(foundClass.id));
            
            console.log("DEBUG - Is user enrolled:", isEnrolled);
            
            // If we're directly accessing an assignment via URL, bypass enrollment check for better UX
            // Get URL parameters directly in case our state hasn't updated yet
            let directLessonParam, directContentParam;
            if (typeof window !== 'undefined') {
              const urlParams = new URLSearchParams(window.location.search);
              directLessonParam = urlParams.get('lesson');
              directContentParam = urlParams.get('content');
              console.log("DEBUG - Direct URL parameters check:", { directLessonParam, directContentParam });
            }
            
            // Check both the state-based params and direct URL params
            const hasDirectAssignmentAccess = 
              (queryParams.content && queryParams.lesson) || 
              (directLessonParam && directContentParam);
            
            console.log("DEBUG - Direct assignment access:", hasDirectAssignmentAccess, 
              "State params:", queryParams, 
              "URL params:", { lesson: directLessonParam, content: directContentParam });
            
            if (isEnrolled || hasDirectAssignmentAccess) {
              if (!isEnrolled && hasDirectAssignmentAccess) {
                console.log("DEBUG - Allowing direct access to assignment despite enrollment issue");
              }
              setCurrentClass(foundClass);
              loadCurriculum();
            } else {
              toast({
                title: "Access denied",
                description: "You are not enrolled in this class",
                variant: "destructive",
              });
              router.push("/student");
            }
          } else {
            toast({
              title: "Class not found",
              description: "The requested class could not be found",
              variant: "destructive",
            });
            router.push("/student");
          }
        }
      } catch (error) {
        console.error("Error loading class:", error);
        toast({
          title: "Error loading class",
          description: "There was an error loading the class data",
          variant: "destructive",
        });
      }
    };

    loadClassAndCurriculum();
  }, [classId, router, toast, queryParams]);

  // Load curriculum data
  const loadCurriculum = async () => {
    try {
      // First try the regular curriculum with filtering
      const curriculumData = await storage.getCurriculum(classId, currentUser?.role);
      
      if (curriculumData) {
        console.log("Loaded curriculum data:", curriculumData);
        setCurriculum(curriculumData);
        setLessonsWithContent(curriculumData.content?.lessons || []);
        setLastUpdateTimestamp(curriculumData.lastUpdated || null);
      } else {
        toast({
          title: "No content available",
          description: "There is no published curriculum content available for this class yet.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error loading curriculum:", error);
      toast({
        title: "Error loading curriculum",
        description: "There was a problem loading the curriculum content.",
        variant: "destructive",
      });
    }
  };

  // Load saved answers

  const loadSavedAnswers = async (content: Content) => {
    if (!currentUser?.id || !content?.id) return;


    const answersPath = `student-answers/${classId}/${content.id}`;
    const answersRef = ref(realtimeDb, answersPath);


    try {
      const answersRef = ref(realtimeDb, `answers/${currentUser.id}/${content.id}`)
      const snapshot = await get(answersRef)
      const savedData = snapshot.val()

      console.log(`Loading saved answers for content ${content.id}:`, savedData)

      if (savedData && savedData.userAnswers) {
        // Update the user answers with the saved data
        setUserAnswers(prev => ({
          ...prev,
          [content.id]: savedData.userAnswers
        }))

        // Update user grades if available
        if (savedData.userGrades) {
          setUserGrades(prev => ({
            ...prev,
            [content.id]: savedData.userGrades
          }))
        }
      } else {
        // Initialize empty answers for this content
        setUserAnswers(prev => ({
          ...prev,
          [content.id]: {}
        }))
        setUserGrades(prev => ({
          ...prev,
          [content.id]: {}
        }))
      }

      // Set up real-time listener for updates
      const updatesRef = ref(realtimeDb, `updates/${currentUser.id}/${content.id}`)
      const unsubscribe = onValue(updatesRef, (snapshot) => {
        const updates = snapshot.val() as Record<string, RealTimeUpdate>
        if (!updates) return

        Object.entries(updates).forEach(([problemIndex, update]) => {
          const index = parseInt(problemIndex)
          if (isNaN(index)) return

          setUserAnswers(prev => ({
            ...prev,
            [content.id]: {
              ...(prev[content.id] || {}),
              [index]: update.value
            }
          }))
        })
      })

      return () => unsubscribe()
    } catch (error) {
      console.error(`Error loading saved answers for content ${content.id}:`, error)
      
      // Initialize empty answers for this content as fallback
      setUserAnswers(prev => ({
        ...prev,
        [content.id]: {}
      }))
      setUserGrades(prev => ({
        ...prev,
        [content.id]: {}
      }))
    }
  }

  // Check if all problems in content are completed
  const checkContentCompletion = (content: Content): boolean => {
    if (!content?.problems || !content.id || !userAnswers[content.id]) return false

    return content.problems.every((problem, index) => {
      if (!problem) return false
      return userAnswers[content.id][index] !== undefined
    })
  };

  // Save answers to Firebase
  const saveAnswers = async (content: Content) => {
    const userId = sessionManager.getSession()?.userId
    if (!userId || !content?.id) return

    // Get the answers for this specific content
    const contentAnswers = userAnswers[content.id] || {}
    
    // Create a sanitized version of answers without undefined values
    const sanitizedAnswers = Object.entries(contentAnswers).reduce((acc, [problemIndex, value]) => {
      if (value !== undefined && value !== null) {
        acc[problemIndex] = value
      }
      return acc
    }, {} as Record<string, any>)

    // Get the grades for this specific content
    const contentGrades = userGrades[content.id] || {}
    
    // Create a sanitized version of grades without undefined values
    const sanitizedGrades = Object.entries(contentGrades).reduce((acc, [problemIndex, value]) => {
      if (value !== undefined && value !== null) {
        acc[problemIndex] = value
      }
      return acc
    }, {} as Record<string, any>)

    const answersRef = ref(realtimeDb, `answers/${userId}/${content.id}`)
    const isComplete = checkContentCompletion(content)

    console.log(`Saving answers for content ${content.id}:`, sanitizedAnswers)
    
    await set(answersRef, {
      userAnswers: sanitizedAnswers,
      userGrades: sanitizedGrades,
      status: isComplete ? 'completed' : 'in-progress',
      lastUpdated: new Date().toISOString(),
      studentId: userId,  // Explicitly include studentId
      contentId: content.id  // Explicitly include contentId
    })
  }

  const handleSelectContent = async (content: Content) => {
    setActiveContent(content)
    await loadSavedAnswers(content)

    // Check if this content has already been graded for this student
    if (currentUser) {
      const gradedContentKey = `graded-content-${classId}-${content.id}`
      const gradedData = localStorage.getItem(gradedContentKey)

      if (gradedData) {
        try {
          const submissions = JSON.parse(gradedData)
          const userSubmission = submissions.find((sub) => sub.studentId === currentUser.id)

          if (userSubmission && userSubmission.status === "completed") {
            // If the student has already completed this content, show the results
            setShowResults(true)

            // Load their previous answers if available
            if (userSubmission.answers) {
              if (userSubmission.answers.multipleChoice) {
                setUserAnswers({
                  [content.id]: userSubmission.answers.multipleChoice,
                })
              }

              if (userSubmission.answers.mathExpression) {
                setMathExpressionInputs({
                  [content.id]: userSubmission.answers.mathExpression,
                })
              }

              if (userSubmission.answers.openEnded) {
                setOpenEndedAnswers({
                  [content.id]: userSubmission.answers.openEnded,
                })
              }
            }

            return
          }
        } catch (error) {
          console.error("Error loading graded content:", error)
        }
      }
    }

    setShowResults(false)

    // Initialize user answers if not already set
    if (content.problems && content.problems.length > 0) {
      // For multiple choice questions
      const initialMultipleChoiceAnswers = {}
      // For math expression questions
      const initialMathExpressionInputs = {}
      // For open ended questions
      const initialOpenEndedAnswers = {}

      content.problems.forEach((problem, index) => {
        if (problem.type === "multiple-choice") {
          if (!userAnswers[content.id] || userAnswers[content.id][index] === undefined) {
            initialMultipleChoiceAnswers[index] = -1 // -1 means no answer selected
          }
        } else if (problem.type === "math-expression") {
          if (!mathExpressionInputs[content.id] || mathExpressionInputs[content.id][index] === undefined) {
            initialMathExpressionInputs[index] = ""
          }
        } else if (problem.type === "open-ended") {
          if (!openEndedAnswers[content.id] || openEndedAnswers[content.id][index] === undefined) {
            initialOpenEndedAnswers[index] = ""
          }
        }
      })

      if (Object.keys(initialMultipleChoiceAnswers).length > 0) {
        setUserAnswers({
          ...userAnswers,
          [content.id]: {
            ...(userAnswers[content.id] || {}),
            ...initialMultipleChoiceAnswers,
          },
        })
      }

      if (Object.keys(initialMathExpressionInputs).length > 0) {
        setMathExpressionInputs({
          ...mathExpressionInputs,
          [content.id]: {
            ...(mathExpressionInputs[content.id] || {}),
            ...initialMathExpressionInputs,
          },
        })
      }

      if (Object.keys(initialOpenEndedAnswers).length > 0) {
        setOpenEndedAnswers({
          ...openEndedAnswers,
          [content.id]: {
            ...(openEndedAnswers[content.id] || {}),
            ...initialOpenEndedAnswers,
          },
        })

  // Handle multiple choice answer selection
  const handleMultipleChoiceSelect = (value: string, problemIndex: number) => {
    if (!activeContent) return
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }))
    saveAnswers(activeContent)
    sendRealTimeUpdate(problemIndex, value, 'multiple-choice')
  }

  // Handle math expression input
  const handleMathExpressionInput = (value: string, problemIndex: number) => {
    if (!activeContent) return
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }))
    saveAnswers(activeContent)
    sendRealTimeUpdate(problemIndex, value, 'math-expression')
  }

  // Types for real-time updates
  type RealTimeUpdate = {
    value: string
    type: 'multiple-choice' | 'math-expression' | 'open-ended'
    timestamp: string
    problemId: string
  }

  // Send real-time update
  const sendRealTimeUpdate = async (problemIndex: number, value: string, type: RealTimeUpdate['type']) => {
    if (!currentUser?.id || !activeContent?.id || !activeContent.problems?.[problemIndex]) return

    const problem = activeContent.problems[problemIndex]
    const updateRef = ref(realtimeDb, `updates/${currentUser.id}/${activeContent.id}/${problemIndex}`)
    
    const update: RealTimeUpdate = {
      value,
      type,
      timestamp: new Date().toISOString(),
      problemId: problem.id || ''
    }

    await set(updateRef, update)
  }

  // Handle open ended answer input
  const handleOpenEndedInput = (value: string, problemIndex: number) => {
    if (!activeContent) return
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }))
    saveAnswers(activeContent)

    // Send real-time update every few keystrokes
    if (currentUser && (!lastUpdateTimestamp || Date.now() - Number(lastUpdateTimestamp) > 2000)) {
      sendRealTimeUpdate(problemIndex, value, 'open-ended')
      setLastUpdateTimestamp(Date.now().toString())
    }
  }

  // Auto-grade a math expression answer
  const gradeMathExpression = (problem: Problem, studentAnswer: string): GradingResult => {
    let result: GradingResult = { correct: false, score: 0 };
    
    if (!studentAnswer || !problem) return result;

    // Clean up the student answer
    const cleanStudentAnswer = studentAnswer.trim().toLowerCase();
    
    if (problem.correctAnswers && Array.isArray(problem.correctAnswers)) {
      // Multiple correct answers
      for (const correctAnswer of problem.correctAnswers) {
        const cleanCorrectAnswer = correctAnswer.trim().toLowerCase();
        
        // Check for exact match
        if (cleanStudentAnswer === cleanCorrectAnswer) {
          result = { correct: true, score: problem.points || 0 };
          return result;
        }
        
        // Try numeric comparison if both are numbers
        const studentNum = parseFloat(cleanStudentAnswer);
        const correctNum = parseFloat(cleanCorrectAnswer);
        
        if (!isNaN(studentNum) && !isNaN(correctNum)) {
          const tolerance = problem.tolerance || 0.001;
          if (Math.abs(correctNum - studentNum) <= tolerance) {
            result = { correct: true, score: problem.points || 0 };
            return result;
          }
        }
      }
    } else if (problem.correctAnswer) {
      // Legacy support for single correct answer
      const correctAnswer = problem.correctAnswer.toString();
      const cleanCorrectAnswer = correctAnswer.trim().toLowerCase();
      
      // Check for exact match first
      if (cleanStudentAnswer === cleanCorrectAnswer) {
        result = { correct: true, score: problem.points || 0 };
        return result;
      }
      
      // Try numeric comparison if both are numbers
      const studentNum = parseFloat(cleanStudentAnswer);
      const correctNum = parseFloat(cleanCorrectAnswer);
      
      if (!isNaN(studentNum) && !isNaN(correctNum)) {
        const tolerance = problem.tolerance || 0.001;
        if (Math.abs(correctNum - studentNum) <= tolerance) {
          result = { correct: true, score: problem.points || 0 };
          return result;
        }
      }
    }
    
    return result;
  };

  // Auto-grade an open ended answer
  const gradeOpenEnded = (problem: Problem, studentAnswer: string): GradingResult => {
    let result: GradingResult = { correct: false, score: 0 };
    
    if (!studentAnswer || !problem || !problem.keywords || !Array.isArray(problem.keywords)) {
      return result;
    }
    
    // Check for keywords
    const foundKeywords = problem.keywords.filter(keyword => 
      studentAnswer.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (foundKeywords.length > 0) {
      const score = (foundKeywords.length / problem.keywords.length) * (problem.points || 1);
      result = { correct: score >= (problem.points || 1) * 0.6, score };
  if (currentUser) {
    sendRealTimeUpdate(problemIndex, 
      problem.type === "multiple-choice" ? userAnswers[activeContent.id]?.[problemIndex]?.toString() :
      problem.type === "math-expression" ? mathExpressionInputs[activeContent.id]?.[problemIndex] :
      openEndedAnswers[activeContent.id]?.[problemIndex],
      problem.type,
      problem
    );
  }
};

  // Calculate total score
  const calculateTotalScore = () => {
    if (!activeContent?.problems) return 0;
    return activeContent.problems.reduce((total, _, index) => {
      return total + (problemScores[`${activeContent.id}-${index}`] || 0);
    }, 0);
  };

  // Calculate total possible points
  const calculateTotalPossiblePoints = () => {
    if (!activeContent?.problems) return 0;
    return activeContent.problems.reduce((total, problem) => {
      return total + (problem.points || 0);
    }, 0);
  };

  // Check if a problem is submitted
  const isProblemSubmitted = (problemIndex: number) => {
    if (!activeContent?.id) return false;
    const key = `${activeContent.id}-${problemIndex}`;
    return problemState[key]?.submitted || false;
  };

  // Get problem score
  const getProblemScore = (problemIndex: number) => {
    if (!activeContent?.id) return 0;
    const key = `${activeContent.id}-${problemIndex}`;
    return problemState[key]?.score || 0;
  };

  // Render content type icon
  const renderContentTypeIcon = (type: string | undefined) => {
    // Always return a valid React element
    if (!type) return <FileText className="w-4 h-4 mr-2" />;
    
    const icon = getContentTypeIcon(type);
    if (!icon) return <FileText className="w-4 h-4 mr-2" />;
    
    return icon;
  }

  // Get status badge for content
  const getStatusBadge = (content: Content) => {
    if (currentUser) {
      const gradedContentKey = `graded-content-${classId}-${content.id}`;
      const gradedData = localStorage.getItem(gradedContentKey);

      if (gradedData) {
        try {
          const submissions = JSON.parse(gradedData) as ProblemSubmission[];
          const userSubmission = submissions.find((sub: ProblemSubmission) => sub.studentId === currentUser.id);

          if (userSubmission) {
            if (userSubmission.status === "completed") {
              return (
                <Badge variant="success" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed ({userSubmission.score}%)
                </Badge>
              );
            } else {
              return (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  In Progress
                </Badge>
              );
            }
          }
        } catch (error) {
          console.error("Error loading graded content:", error);
        }
      }
    }

    return <Badge variant="outline">Not Started</Badge>;
  }

  // Add the new function for sending real-time updates
  const sendRealTimeUpdate = (problemIndex: number, answer: string | number, type: string, problem: Problem) => {
    if (!currentUser || !activeContent || !problem) return;
    

    try {
      // Try to load from Firebase first
      const snapshot = await get(answersRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data?.answers) {
          setUserAnswers(prev => ({
            ...prev,
            [content.id]: data.answers
          }));
          return;
        }
      }

      // If Firebase load fails or no data, try local storage
      if (typeof window !== 'undefined') {
        const localData = localStorage.getItem(`progress_${content.id}`);
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            if (parsedData?.answers) {
              setUserAnswers(prev => ({
                ...prev,
                [content.id]: parsedData.answers
              }));
              
              // Sync local data back to Firebase
              await saveAnswers(content);
              return;
            }
          } catch (e) {
            console.error('Error parsing local storage data:', e);
          }
        }
      }

      // If no saved data found, initialize empty answers
      setUserAnswers(prev => ({
        ...prev,
        [content.id]: {}
      }));
    } catch (error) {
      console.error('Error loading saved answers:', error);
      toast.error({
        title: 'Error loading progress',
        description: 'Unable to load your previous work. Starting fresh.'
      });
      
      // Initialize empty answers on error
      setUserAnswers(prev => ({
        ...prev,
        [content.id]: {}
      }));
    }
}

// Save answers to Firebase with proper error handling and retry logic
const saveAnswers = async (content: Content, retryCount = 3) => {
  const userId = sessionManager.getSession()?.userId;
  if (!userId || !content?.id) return;

  const savePath = `student-answers/${classId}/${content.id}`;
  const answersRef = ref(realtimeDb, savePath);

  try {
    // Create a sanitized version of answers without undefined values
    const currentAnswers = userAnswers[content.id] || {};
    const sanitizedAnswers = Object.entries(currentAnswers).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    // Save the current state
    await set(answersRef, {
      answers: sanitizedAnswers,
      lastUpdated: serverTimestamp(),
      completed: checkContentCompletion(content),
      contentType: content.type,
      contentTitle: content.title
    });

    // Update local storage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem(`progress_${content.id}`, JSON.stringify({
        answers: sanitizedAnswers,
        lastUpdated: new Date().toISOString(),
        completed: checkContentCompletion(content)
      }));
    }
  } catch (error) {
    console.error('Error saving answers:', error);
    if (retryCount > 0) {
      await saveAnswers(content, retryCount - 1);
    }
  }
}

const checkContentCompletion = (content: Content): boolean => {
  if (!content.problems || content.problems.length === 0) return true;
  return content.problems.every((problem, index) => {
    const answer = userAnswers[content.id]?.[index];
    return answer !== undefined && answer !== null;
  });
};

const getProblemScore = (problem: Problem, answer: any): number => {
  if (!problem.correctAnswer) return 0;
  return answer === problem.correctAnswer ? problem.points : 0;
};

const handleSubmitProblem = async (problemIndex: number) => {
  if (!activeContent?.problems?.[problemIndex] || !currentUser?.id) return;
  
  const problem = activeContent.problems[problemIndex];
  const answer = userAnswers[activeContent.id]?.[problemIndex];
  
  try {
    await set(
      ref(realtimeDb, `submissions/${currentUser.id}/${activeContent.id}/${problemIndex}`),
      {
        answer,
        timestamp: serverTimestamp(),
        status: 'completed' as const,
        score: getProblemScore(problem, answer)
      }
    );
  } catch (error) {
    console.error('Error submitting problem:', error);
    toast({
      title: 'Error',
      description: 'Failed to submit answer. Please try again.',
      error: true
    });
  }
}

const handleSelectContent = async (content: Content) => {
  if (!content?.id) return;
  
  setActiveContent(content);
  await loadSavedAnswers(content);
  
  // Save initial state
  await saveAnswers(content);
}

// ... rest of the code remains the same ...

  // Handle real-time updates and auto-save
  useEffect(() => {
    if (!currentUser?.id || !activeContent?.id) return;

    // Set up auto-save timer
    const autoSaveInterval = setInterval(() => {
      if (activeContent) {
        saveAnswers(activeContent);
      // Determine if the answer is correct (for multiple choice)
      let isCorrect: boolean | undefined = undefined;
      let partialCredit: number | undefined = undefined;
      
      if (type === 'multiple-choice' && typeof problem.correctAnswer !== 'undefined') {
        isCorrect = Number(answer) === problem.correctAnswer;
      }
      
      // Create the answer object
      const answerData: ProblemSubmission = {
        studentId: currentUser.id,
        studentName: currentUser.name || 'Student',
        studentEmail: currentUser.email,
        studentAvatar: currentUser.avatar,
        questionId: problem.id || `problem-${problemIndex}`,
        questionText: questionText,
        answer: answer,
        answerType: type,
        timestamp: Date.now(),
        correct: isCorrect,
        partialCredit: partialCredit,
        problemType: problem.type,
        problemPoints: problem.points || 1,
        classId: classId,
        contentId: activeContent.id,
        contentTitle: activeContent.title,
        status: isCorrect ? "completed" : "in-progress",
        score: isCorrect ? (problem.points || 0) : undefined
      };
      
      // Send the update
      set(newAnswerRef, answerData);
      
      console.log(`Real-time update sent for problem ${problemIndex}:`, answerData);
    } catch (error) {
      console.error('Error sending real-time update:', error);
    }
  };

  // Main render function
  if (!currentClass || !curriculum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading curriculum...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container py-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 space-y-4 md:flex-row md:items-center md:space-y-0">
          <div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{currentClass.name}</h1>
            <p className="text-muted-foreground">Teacher: {currentClass.teacher}</p>
          </div>
          {currentClass.virtualLink && (
            <Button asChild className="mt-2 md:mt-0">
              <a href={currentClass.virtualLink} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4 mr-2" />
                Join Class Meeting
              </a>
            </Button>
          )}
        </div>

        {/* Class information panel */}
        <Card className="mb-6">
          <CardContent className="p-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Schedule</p>
                <p>{currentClass.meeting_day || currentClass.meetingDates || "No schedule set"}</p>
                {currentClass.startTime && currentClass.endTime && (
                  <p>{currentClass.startTime} - {currentClass.endTime}</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p>{currentClass.location || "No location set"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p>
                  {currentClass.startDate && currentClass.endDate 
                    ? `${currentClass.startDate} to ${currentClass.endDate}` 
                    : "Dates not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center">
                  <Badge variant={currentClass.status === "active" ? "default" : "secondary"}>
                    {currentClass.status || "Active"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Lesson sidebar */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>Available lessons and materials</CardDescription>
              </CardHeader>
              <CardContent>
                {lessonsWithContent && lessonsWithContent.length > 0 ? (
                  <div className="space-y-1">
                    {lessonsWithContent.map((lesson, index) => {
                      if (!lesson) return null;
                      const publishedContents = lesson.contents && Array.isArray(lesson.contents) 
                        ? lesson.contents.filter((c) => c && c.isPublished) 
                        : [];
                      
                      if (publishedContents.length === 0) return null;

                      return (
                        <Button
                          key={lesson.id || `lesson-${index}`}
                          variant={activeLesson === index + 1 ? "default" : "ghost"}
                          className="justify-start w-full"
                          onClick={() => {
                            setActiveLesson(index + 1)
                            setActiveContent(null)
                          }}
                        >
                          <span className="mr-2">{index + 1}.</span>
                          {lesson.title || `Lesson ${index + 1}`}
                          {publishedContents.length > 0 && (
                            <Badge variant="secondary" className="ml-auto">
                              {publishedContents.length}
                            </Badge>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="w-12 h-12 mb-2 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No published content available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content area */}
          <div className="md:col-span-9">
            {!activeContent ? (
              lessonsWithContent && lessonsWithContent.length > 0 && lessonsWithContent[activeLesson - 1] ? (
                // Lesson overview
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Lesson {activeLesson}: {lessonsWithContent[activeLesson - 1]?.title || `Lesson ${activeLesson}`}
                    </CardTitle>
                    <CardDescription>
                      {renderLatex(lessonsWithContent[activeLesson - 1]?.description) || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {lessonsWithContent[activeLesson - 1]?.contents &&
                       Array.isArray(lessonsWithContent[activeLesson - 1]?.contents) &&
                       lessonsWithContent[activeLesson - 1]?.contents
                        .filter((content) => content && content.isPublished)
                        .map((content) => (
                          <Card key={content.id || `content-${Math.random()}`} className="overflow-hidden">
                            <div
                              className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => handleSelectContent(content)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  {renderContentTypeIcon(content.type)}
                                  <div>
                                    <CardTitle className="text-base">{content.title}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{renderLatex(content.description)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center">{getStatusBadge(content)}</div>
                              </div>
                            </div>
                          </Card>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                // No content view
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-16 h-16 mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-xl font-medium mb-2">No Content Available Yet</h3>
                    <p className="text-muted-foreground max-w-md">
                      Your teacher hasn't published any content for this class yet. Check back later.
                    </p>
                  </CardContent>
                </Card>
              )
            ) : (
              // Content detail view
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {renderContentTypeIcon(activeContent.type)}
                      <div>
                        <CardTitle>{activeContent.title || 'Untitled Content'}</CardTitle>
                        <CardDescription>{renderLatex(activeContent.description || '')}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActiveContent(null)
                        setShowResults(false)
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Lesson
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeContent.problems && Array.isArray(activeContent.problems) && activeContent.problems.length > 0 ? (
                    <div className="space-y-8">
                      {activeContent.problems.map((problem, problemIndex) => {
                        if (!problem) return null;
                        const isSubmitted = isProblemSubmitted(problemIndex);
                        const problemScore = getProblemScore(problem, userAnswers[activeContent.id]?.[problemIndex]);
                        
                        return (
                          <div key={problemIndex} className="p-4 border rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <p className="font-medium">Problem {problemIndex + 1}</p>
                                  <Badge variant="outline" className="ml-2">
                                    {problem.type === "multiple-choice"
                                      ? "Multiple Choice"
                                      : problem.type === "open-ended"
                                        ? "Open Ended"
                                        : "Math Expression"}
                                  </Badge>
                                  <Badge variant="secondary" className="ml-2">
                                    {problem.points} {problem.points === 1 ? "point" : "points"}
                                  </Badge>
                                  {isSubmitted && (
                                    <Badge variant={problemScore === problem.points ? "success" : "destructive"} className="ml-2">
                                      Score: {problemScore}/{problem.points}
                                    </Badge>
                                  )}
                                </div>

                                <p className="mt-2 mb-4">{renderLatex(problem.question || '')}</p>

                                {problem.type === "multiple-choice" && problem.options && Array.isArray(problem.options) && (
                                  <RadioGroup
                                    value={userAnswers[activeContent.id]?.[problemIndex]?.toString() || "-1"}
                                    onValueChange={(value) =>
                                      handleMultipleChoiceSelect(problemIndex, Number.parseInt(value))
                                    }
                                    disabled={isSubmitted}
                                    className="space-y-3"
                                  >
                                    {problem.options.map((option, optionIndex) => (
                                      <div
                                        key={optionIndex}
                                        className={`flex items-center space-x-2 p-2 rounded-md ${
                                          isSubmitted && optionIndex === problem.correctAnswer
                                            ? "bg-green-50 dark:bg-green-900/20"
                                            : isSubmitted &&
                                              userAnswers[activeContent.id]?.[problemIndex] === optionIndex &&
                                              optionIndex !== problem.correctAnswer
                                              ? "bg-red-50 dark:bg-red-900/20"
                                              : ""
                                        }`}
                                      >
                                        <RadioGroupItem
                                          value={optionIndex.toString()}
                                          id={`option-${problemIndex}-${optionIndex}`}
                                        />
                                        <Label htmlFor={`option-${problemIndex}-${optionIndex}`}>
                                          {renderLatex(option || '')}
                                        </Label>

                                        {isSubmitted && optionIndex === problem.correctAnswer && (
                                          <CheckCircle2 className="w-4 h-4 ml-auto text-green-500" />
                                        )}
                                        {isSubmitted &&
                                          userAnswers[activeContent.id]?.[problemIndex] === optionIndex &&
                                          optionIndex !== problem.correctAnswer && (
                                            <AlertCircle className="w-4 h-4 ml-auto text-red-500" />
                                          )}
                                      </div>
                                    ))}
                                  </RadioGroup>
                                )}

                                {problem.type === "math-expression" && (
                                  <div className="space-y-3">
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor={`math-answer-${problemIndex}`}>Your Answer:</Label>
                                      <div className="flex space-x-2">
                                        <Input
                                          id={`math-answer-${problemIndex}`}
                                          value={mathExpressionInputs[activeContent.id]?.[problemIndex] || ""}
                                          onChange={(e) => handleMathExpressionInput(problemIndex, e.target.value)}
                                          placeholder="Enter your answer (e.g., 2x + 3 or 7)"
                                          disabled={isSubmitted}
                                          className="flex-1"
                                        />
                                      </div>

                                      {isSubmitted && (
                                        <div
                                          className={`p-2 mt-2 rounded-md ${
                                            problemScore === problem.points
                                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                                          }`}
                                        >
                                          {problemScore === problem.points
                                            ? "Correct!"
                                            : "Incorrect. The correct answer is:"}
                                          {problemScore !== problem.points && (
                                            <div className="font-medium mt-1">
                                              {problem.correctAnswers && Array.isArray(problem.correctAnswers) && problem.correctAnswers.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                  {problem.correctAnswers.map((answer, i) => (
                                                    <div key={i}>{renderLatex(answer ? `$$${answer}$$` : '')}</div>
                                                  ))}
                                                </div>
                                              ) : (
                                                renderLatex(problem.correctAnswer ? `$$${problem.correctAnswer}$$` : '$$\\text{No answer provided}$$')
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {problem.type === "open-ended" && (
                                  <div className="space-y-3">
                                    <div className="flex flex-col space-y-2">
                                      <Label htmlFor={`open-answer-${problemIndex}`}>Your Answer:</Label>
                                      <Textarea
                                        id={`open-answer-${problemIndex}`}
                                        value={openEndedAnswers[activeContent.id]?.[problemIndex] || ""}
                                        onChange={(e) => handleOpenEndedInput(problemIndex, e.target.value)}
                                        placeholder="Type your answer here..."
                                        disabled={isSubmitted}
                                        rows={4}
                                      />

                                      {isSubmitted && (
                                        <div className="p-3 mt-2 bg-slate-50 dark:bg-slate-800 rounded-md">
                                          <p className="font-medium text-sm">Sample Correct Answer:</p>
                                          {problem.correctAnswers && problem.correctAnswers.length > 0 ? (
                                            <div className="flex flex-col gap-2 mt-1">
                                              {problem.correctAnswers.map((answer, i) => (
                                                <p key={i}>{answer}</p>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="mt-1">{problem.correctAnswer || 'No answer provided'}</p>
                                          )}

                                          {problem.keywords && Array.isArray(problem.keywords) && problem.keywords.length > 0 && (
                                            <div className="mt-3">
                                              <p className="font-medium text-sm">Keywords Found in Your Answer:</p>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {problem.keywords.map((keyword, keywordIndex) => {
                                                  const isMatched = openEndedAnswers[activeContent.id]?.[problemIndex]
                                                    ?.toLowerCase()
                                                    .includes(keyword.toLowerCase())
                                                  return (
                                                    <Badge
                                                      key={keywordIndex}
                                                      variant={isMatched ? "default" : "outline"}
                                                      className={isMatched ? "bg-green-500" : ""}
                                                    >
                                                      {keyword}
                                                      {isMatched && <CheckCircle2 className="w-3 h-3 ml-1" />}
                                                    </Badge>
                                                  )
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {isSubmitted && problem.explanation && (
                                  <div className="p-3 mt-4 bg-slate-50 dark:bg-slate-800 rounded-md">
                                    <p className="font-medium text-sm">Explanation:</p>
                                    <p className="text-sm">{renderLatex(problem.explanation)}</p>
                                  </div>
                                )}

                                {!isSubmitted && (
                                  <Button
                                    className="mt-4"
                                    onClick={() => handleSubmitProblem(problemIndex)}
                                    disabled={
                                      problem.type === 'multiple_choice' && 
                                      (userAnswers[activeContent.id]?.[problemIndex] === undefined || 
                                       userAnswers[activeContent.id]?.[problemIndex] === -1) ||
                                      problem.type === 'math_expression' && 
                                      (!mathExpressionInputs[activeContent.id]?.[problemIndex] || 
                                       mathExpressionInputs[activeContent.id]?.[problemIndex] === "") ||
                                      problem.type === 'open_ended' && 
                                      (!openEndedAnswers[activeContent.id]?.[problemIndex] || 
                                       openEndedAnswers[activeContent.id]?.[problemIndex] === "")
                                    }
                                  >
                                    Submit Answer
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Show total score */}
                      {Object.keys(submittedProblems).length > 0 && (
                        <div className="p-4 border rounded-lg">
                          <p className="font-medium">Total Score</p>
                          <div className="flex items-center mt-2 space-x-4">
                            <Progress 
                              value={(calculateTotalScore() / calculateTotalPossiblePoints()) * 100} 
                              className="flex-1" 
                            />
                            <span className="font-bold">
                              {calculateTotalScore()}/{calculateTotalPossiblePoints()} points
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 border rounded-lg">
                      <p>{renderLatex(activeContent.description || '')}</p>
                      <p className="mt-4 text-sm text-muted-foreground">
                        This content doesn't have any problems to solve.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
