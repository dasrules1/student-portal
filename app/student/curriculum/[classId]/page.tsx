"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  BookOpen,
  PenTool,
  ClipboardList,
  BookMarked,
  FileQuestion,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { sessionManager } from "@/lib/session"
import { storage } from "@/lib/storage"
import { realtimeDb } from "@/lib/firebase"
import { ref, set, push, serverTimestamp, get } from "firebase/database"
import { doc, setDoc, getDoc, collection, query, where, getDocs, DocumentData, QueryDocumentSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Content types for curriculum
const getContentTypeIcon = (type: string) => {
  switch (type) {
    case "new-material":
      return <BookOpen className="w-4 h-4 mr-2" />;
    case "guided-practice":
      return <PenTool className="w-4 h-4 mr-2" />;
    case "classwork":
      return <ClipboardList className="w-4 h-4 mr-2" />;
    case "homework":
      return <BookMarked className="w-4 h-4 mr-2" />;
    case "quiz":
      return <FileQuestion className="w-4 h-4 mr-2" />;
    case "test":
      return <FileText className="w-4 h-4 mr-2" />;
    default:
      return null;
  }
};

const contentTypes = [
  { id: "new-material", name: "New Material" },
  { id: "guided-practice", name: "Guided Practice" },
  { id: "classwork", name: "Classwork" },
  { id: "homework", name: "Homework" },
  { id: "quiz", name: "Quiz" },
  { id: "test", name: "Test" },
];

// Function to render LaTeX in the UI
const renderLatex = (text: string) => {
  if (!text) return ""

  // Simple regex to identify LaTeX-like content between $$ delimiters
  const parts = text.split(/(\$\$.*?\$\$)/g)

  if (parts.length === 1) return text

  return (
    <>
      {parts && Array.isArray(parts) && parts.map((part, index) => {
        if (part && part.startsWith("$$") && part.endsWith("$$")) {
          const latex = part.slice(2, -2)
          return (
            <span
              key={index}
              className="inline-block px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-sm"
            >
              {latex}
            </span>
          )
        }
        return part
      })}
    </>
  )
}

// Update User type to match the actual structure
interface User {
  id: string;
  uid?: string;
  name: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin";
  status?: "active" | "inactive";
  avatar?: string;
  classes: string[];
  user?: {
    id?: string;
    uid?: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
  };
  displayName?: string;
  photoURL?: string;
}

// Update Content type to include problems
interface Content {
  id: string;
  title: string;
  type: string;
  description?: string;
  isPublished?: boolean;
  dueDate?: string;
  completed?: boolean;
  completedAt?: string;
  problems?: Problem[];
}

// Add type for user answers
interface UserAnswers {
  [contentId: string]: {
    [problemIndex: number]: number;
  };
}

// Add type for math expression inputs
interface MathExpressionInputs {
  [contentId: string]: {
    [problemIndex: number]: string;
  };
}

// Add type for open ended answers
interface OpenEndedAnswers {
  [contentId: string]: {
    [problemIndex: number]: string;
  };
}

// Add type for attempt counts
interface AttemptCounts {
  [key: string]: number;
}

interface Lesson {
  id: string;
  title: string;
  contents?: Content[];
  assignments?: Content[];
  quizzes?: Content[];
}

// Update Curriculum interface
interface Curriculum {
  content?: {
    lessons: Lesson[];
  };
  lastUpdated?: string;
}

interface UserSubmission {
  studentId: string;
  status: string;
  score?: number;
}

interface ProblemScores {
  [key: string]: number;
}

interface SubmittedProblems {
  [key: string]: boolean;
}

interface Problem {
  id?: string;
  type: string;
  question: string;
  options?: string[];
  answer?: string;
  keywords?: string[];
  points?: number;
  correctAnswer?: number | string;
  correctAnswers?: string[];
  tolerance?: number;
  explanation?: string;
}

interface ProblemState {
  [key: string]: {
    answer: string | number;
    submitted: boolean;
    score: number;
  };
}

interface ProblemSubmission {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar?: string;
  questionId: string;
  questionText: string;
  answer: string | number;
  answerType: string;
  timestamp: number;
  correct?: boolean;
  partialCredit?: number;
  problemType: string;
  problemPoints: number;
  classId: string;
  contentId: string;
  contentTitle: string;
  status?: string;
  score?: number;
}

interface GradingResult {
  correct: boolean;
  score: number;
}

interface StudentSubmission {
  studentId: string;
  problemResults: Array<{
    type: string;
    correct: boolean;
    points: number;
    maxPoints: number;
    studentAnswer: string;
    timestamp: number;
  }>;
  score: number;
  status: string;
  submittedAt: number;
  lastUpdated: number;
}

// Add type for submission
interface Submission {
  studentId: string;
  status: string;
  answers?: {
    multipleChoice?: { [key: number]: number };
    mathExpression?: { [key: number]: string };
    openEnded?: { [key: number]: string };
  };
}

// Update Badge variant type
type BadgeVariant = "default" | "destructive" | "secondary" | "outline" | "success";

interface ExistingAnswers {
  [key: number]: {
    problemIndex: number;
    answer: string;
    score: number;
  };
}

// Add type guard for classId
const isClassIdValid = (id: string | undefined): id is string => {
  return typeof id === 'string' && id.length > 0;
};

export default function StudentCurriculum() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string
  const [isLoading, setIsLoading] = useState(true)
  
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

  const [currentClass, setCurrentClass] = useState<any>(null)
  const [curriculum, setCurriculum] = useState<any>(null)
  const [activeLesson, setActiveLesson] = useState(1)
  const [activeContent, setActiveContent] = useState<Content | null>(null)
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({})
  const [showResults, setShowResults] = useState(false)
  const [mathExpressionInputs, setMathExpressionInputs] = useState<MathExpressionInputs>({})
  const [openEndedAnswers, setOpenEndedAnswers] = useState<OpenEndedAnswers>({})
  const [attemptCounts, setAttemptCounts] = useState<AttemptCounts>({})
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(null)
  const [lessonsWithContent, setLessonsWithContent] = useState<any[]>([])
  const [problemScores, setProblemScores] = useState<ProblemScores>({})
  const [submittedProblems, setSubmittedProblems] = useState<SubmittedProblems>({})
  const [problemState, setProblemState] = useState<ProblemState>({})
  const [existingAnswers, setExistingAnswers] = useState<ExistingAnswers>({})

  // Load class and curriculum data
  useEffect(() => {
    const loadClassAndCurriculum = async () => {
      // Check if user is a student
      const user = sessionManager.getCurrentUser()
      console.log('Current user:', user)
      
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
      console.log('Typed user:', typedUser)

      // Try to get class from storage
      try {
        // Get classes and make sure it's an array before using .find()
        const classes = await storage.getClasses();
        console.log("DEBUG - ClassId from URL:", classId);
        console.log("DEBUG - Retrieved classes:", classes);
        
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
            const userId = typedUser.id || typedUser.uid;
            console.log("DEBUG - User ID for enrollment check:", userId);
            
            if (!userId) {
              console.error("No user ID found");
              toast({
                title: "Error",
                description: "User ID not found",
                variant: "destructive",
              });
              return;
            }
            
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
            // Try to get the class directly from Firestore
            try {
              const classDoc = await getDoc(doc(db, 'classes', classId));
              if (classDoc.exists()) {
                const classData = classDoc.data();
                console.log("DEBUG - Found class in Firestore:", classData);
                setCurrentClass(classData);
                loadCurriculum();
              } else {
                toast({
                  title: "Class not found",
                  description: "The requested class could not be found",
                  variant: "destructive",
                });
                router.push("/student");
              }
            } catch (error) {
              console.error("Error loading class from Firestore:", error);
              toast({
                title: "Error loading class",
                description: "There was an error loading the class data",
                variant: "destructive",
              });
            }
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

  const loadCurriculum = async () => {
    try {
      setIsLoading(true)
      console.log('Loading curriculum for classId:', classId)
      
      const curriculumDoc = await getDoc(doc(db, 'published_curricula', classId))
      console.log('Published curriculum doc exists:', curriculumDoc.exists())
      
      if (curriculumDoc.exists()) {
        const curriculumData = curriculumDoc.data() as Curriculum
        console.log('Loaded curriculum data:', curriculumData)
        setCurriculum(curriculumData)
      } else {
        const classDoc = await getDoc(doc(db, 'classes', classId))
        console.log('Class doc exists:', classDoc.exists())
        
        if (classDoc.exists()) {
          const classData = classDoc.data()
          console.log('Class data:', classData)
          
          if (classData.curriculum) {
            console.log('Found curriculum in class data')
            setCurriculum(classData.curriculum as Curriculum)
          } else {
            console.log('No curriculum found in class data')
            toast({
              title: "No Curriculum Available",
              description: "This class doesn't have any curriculum content yet.",
              variant: "destructive"
            })
          }
        } else {
          console.log('Class document not found')
          toast({
            title: "Error",
            description: "Class not found",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error('Error loading curriculum:', error)
      toast({
        title: "Error",
        description: "Failed to load curriculum",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load curriculum data
  useEffect(() => {
    if (classId) {
      console.log('Effect triggered with classId:', classId)
      loadCurriculum()
    }
  }, [classId, toast])

  // Handle selecting a content item
  const handleSelectContent = async (content: Content) => {
    console.log('Selecting content:', content);
    setActiveContent(content);
    setUserAnswers({});
    setMathExpressionInputs({});
    setOpenEndedAnswers({});
    setSubmittedProblems({});
    setProblemState({});
    
    // Load existing answers for this content
    if (typeof content.id === 'string' && currentUser?.uid) {
      try {
        const answersRef = doc(db, 'student-answers', classId, 'answers', content.id);
        const answersDoc = await getDoc(answersRef);
        
        if (answersDoc.exists()) {
          const answersData = answersDoc.data();
          console.log('Loaded existing answers:', answersData);
          
          // Update state with existing answers
          setUserAnswers(answersData.answers || {});
          setMathExpressionInputs(answersData.mathExpressionInputs || {});
          setOpenEndedAnswers(answersData.openEndedAnswers || {});
          setSubmittedProblems(answersData.submittedProblems || {});
          setProblemState(answersData.problemState || {});
        }
      } catch (error) {
        console.error('Error loading existing answers:', error);
        toast({
          title: 'Error loading answers',
          description: 'There was a problem loading your previous answers.',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle multiple choice answer selection
  const handleMultipleChoiceSelect = (problemIndex: number, optionIndex: number) => {
    if (!activeContent?.id || !activeContent.problems) return;
    const key = `${activeContent.id}-${problemIndex}`;
    const problem = activeContent.problems[problemIndex];
    if (!problem) return;

    setProblemState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        answer: optionIndex,
        submitted: false
      }
    }));
    
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...(prev[activeContent.id] || {}),
        [problemIndex.toString()]: optionIndex
      }
    }));
    
    // Send real-time update to Firebase
    if (currentUser) {
      sendRealTimeUpdate(problemIndex, optionIndex.toString(), 'multiple-choice', problem);
    }
  }

  // Handle math expression input
  const handleMathExpressionInput = (problemIndex: number, value: string) => {
    if (!activeContent?.id || !activeContent.problems) return;
    const key = `${activeContent.id}-${problemIndex}`;
    const problem = activeContent.problems[problemIndex];
    if (!problem) return;

    setProblemState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        answer: value,
        submitted: false
      }
    }));
    
    setMathExpressionInputs(prev => ({
      ...prev,
      [activeContent.id]: {
        ...(prev[activeContent.id] || {}),
        [problemIndex.toString()]: value
      }
    }));
    
    // Send real-time update to Firebase every few keystrokes
    if (currentUser && (!lastUpdateTimestamp || Date.now() - Number(lastUpdateTimestamp) > 2000)) {
      sendRealTimeUpdate(problemIndex, value, 'math-expression', problem);
      setLastUpdateTimestamp(Date.now().toString());
    }
  }

  // Handle open ended answer input
  const handleOpenEndedInput = (problemIndex: number, value: string) => {
    if (!activeContent?.id || !activeContent.problems) return;
    const key = `${activeContent.id}-${problemIndex}`;
    const problem = activeContent.problems[problemIndex];
    if (!problem) return;

    setProblemState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        answer: value,
        submitted: false
      }
    }));
    
    setOpenEndedAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...(prev[activeContent.id] || {}),
        [problemIndex.toString()]: value
      }
    }));
    
    // Send real-time update to Firebase every few keystrokes
    if (currentUser && (!lastUpdateTimestamp || Date.now() - Number(lastUpdateTimestamp) > 2000)) {
      sendRealTimeUpdate(problemIndex, value, 'open-ended', problem);
      setLastUpdateTimestamp(Date.now().toString());
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
    }
    
    return result;
  };

  // Handle submitting a single problem
  const handleSubmitProblem = (problemIndex: number) => {
    if (!activeContent?.problems) return;

    const problem = activeContent.problems[problemIndex];
    let result: GradingResult = { correct: false, score: 0 };

    if (problem.type === "multiple-choice") {
      const selectedOption = userAnswers[activeContent.id]?.[problemIndex];
      result = {
        correct: selectedOption === problem.correctAnswer,
        score: selectedOption === problem.correctAnswer ? (problem.points || 1) : 0
      };
    } else if (problem.type === "math-expression") {
      result = gradeMathExpression(problem, mathExpressionInputs[activeContent.id]?.[problemIndex] || "");
    } else if (problem.type === "open-ended") {
      result = gradeOpenEnded(problem, openEndedAnswers[activeContent.id]?.[problemIndex] || "");
    }

    // Update problem scores
    setProblemScores(prev => ({
      ...prev,
      [`${activeContent.id}-${problemIndex}`]: result.score || 0
    }));

    // Mark problem as submitted
    setSubmittedProblems(prev => ({
      ...prev,
      [`${activeContent.id}-${problemIndex}`]: true
    }));

    // Show feedback toast
    toast({
      title: result.correct ? "Correct!" : "Incorrect",
      description: `You scored ${result.score || 0} points for this problem.`,
      variant: result.correct ? "default" : "destructive",
    });

    // Send real-time update
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
                <Badge variant="default" className="bg-green-500">
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
  const sendRealTimeUpdate = async (problemIndex: number, answer: string | number, type: string, problem: Problem) => {
    // Add detailed validation logging
    console.log('Current user data:', currentUser);
    console.log('Active content:', activeContent);
    console.log('Problem data:', problem);
    
    // Use currentUser.uid as the studentId
    const userId = currentUser?.uid;
    const userName = currentUser?.displayName || currentUser?.name || currentUser?.user?.displayName || 'Unknown Student';
    const userEmail = currentUser?.email || currentUser?.user?.email || '';
    const userAvatar = currentUser?.photoURL || currentUser?.avatar || currentUser?.user?.photoURL || '';
    
    if (!userId) {
      console.error('No user ID found in current user data:', currentUser);
      toast({
        title: "Authentication Error",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!activeContent?.id) {
      console.error('No active content ID');
      return;
    }

    if (!problem) {
      console.error('No problem data provided');
      return;
    }
    
    try {
      // Determine if the answer is correct based on the problem type
      let isCorrect = false;
      let score = 0;

      if (type === 'multiple-choice') {
        isCorrect = Number(answer) === problem.correctAnswer;
        score = isCorrect ? (problem.points || 1) : 0;
      } else if (type === 'math-expression') {
        const result = gradeMathExpression(problem, answer.toString());
        isCorrect = result.correct;
        score = result.score;
      } else if (type === 'open-ended') {
        const result = gradeOpenEnded(problem, answer.toString());
        isCorrect = result.correct;
        score = result.score;
      }

      // Create the answer object with all required fields
      const answerData = {
        studentId: userId,
        studentName: userName,
        studentEmail: userEmail,
        studentAvatar: userAvatar,
        questionId: problem.id || `problem-${problemIndex}`,
        questionText: problem.question || 'Question not available',
        answer: answer?.toString() || '',
        answerType: type,
        timestamp: serverTimestamp(),
        correct: isCorrect,
        partialCredit: 0,
        problemType: problem.type,
        problemPoints: problem.points || 1,
        classId: classId,
        contentId: activeContent.id,
        contentTitle: activeContent.title || 'Untitled Content',
        status: "in-progress",
        score: score,
        problemIndex: problemIndex
      };

      console.log('Attempting to save answer data:', answerData);

      // Save to Firestore using the correct nested path structure
      const answerRef = doc(db, 'student-answers', classId, 'answers', `${activeContent.id}_${userId}_problem-${problemIndex}`);
      await setDoc(answerRef, answerData);

      // Also save to student-progress collection
      const progressRef = doc(db, 'student-progress', `${classId}_${activeContent.id}_${userId}_problem-${problemIndex}`);
      await setDoc(progressRef, answerData);

      // Check if all problems are answered
      const answersQuery = query(
        collection(db, 'student-answers', classId, 'answers'),
        where('contentId', '==', activeContent.id),
        where('studentId', '==', userId)
      );
      
      const answersSnapshot = await getDocs(answersQuery);
      const totalProblems = activeContent.problems?.length || 0;
      const answeredProblems = answersSnapshot.docs.length;
      
      // If all problems are answered, update the status to completed
      if (answeredProblems >= totalProblems) {
        const completionData = {
          ...answerData,
          status: "completed",
          completedAt: serverTimestamp()
        };
        
        // Update both documents with completion status
        await setDoc(answerRef, completionData);
        await setDoc(progressRef, completionData);
        
        // Also create a completion record
        const completionRef = doc(db, 'student-completions', `${classId}_${activeContent.id}_${userId}`);
        await setDoc(completionRef, {
          status: "completed",
          completedAt: serverTimestamp(),
          classId,
          contentId: activeContent.id,
          studentId: userId,
          totalProblems,
          answeredProblems
        });
      }
      
      console.log(`Answer saved successfully for problem ${problemIndex}`);
    } catch (error) {
      console.error('Error saving answer:', error);
      toast({
        title: "Error saving answer",
        description: "There was a problem saving your answer. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update the loadExistingAnswers function
  const loadExistingAnswers = async (content: Content) => {
    if (!currentUser?.uid || !isClassIdValid(classId)) return;
    
    try {
      // Get both uid and id for student identification
      const studentId = currentUser.uid;
      const studentAltId = currentUser.id || currentUser.user?.id;
      
      // Query all answers for this content and student
      const answersQuery = query(
        collection(db, 'student-answers', classId, 'answers'),
        where('contentId', '==', content.id),
        where('studentId', 'in', [studentId, studentAltId].filter(Boolean))
      );
      
      const answersSnapshot = await getDocs(answersQuery);
      const answers: UserAnswers = {};
      const mathExpressions: MathExpressionInputs = {};
      const openEnded: OpenEndedAnswers = {};
      const submitted: SubmittedProblems = {};
      const problemStates: ProblemState = {};
      
      answersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const problemIndex = data.problemIndex;
        
        if (problemIndex !== undefined) {
          // Update answers based on problem type
          if (data.answerType === 'multiple-choice') {
            if (!answers[content.id]) answers[content.id] = {};
            answers[content.id][problemIndex] = Number(data.answer);
          } else if (data.answerType === 'math-expression') {
            if (!mathExpressions[content.id]) mathExpressions[content.id] = {};
            mathExpressions[content.id][problemIndex] = data.answer;
          } else if (data.answerType === 'open-ended') {
            if (!openEnded[content.id]) openEnded[content.id] = {};
            openEnded[content.id][problemIndex] = data.answer;
          }
          
          // Update submitted problems and problem states
          const key = `${content.id}-${problemIndex}`;
          submitted[key] = true;
          problemStates[key] = {
            answer: data.answer,
            submitted: true,
            score: data.score || 0
          };
        }
      });
      
      // Update all states
      setUserAnswers(answers);
      setMathExpressionInputs(mathExpressions);
      setOpenEndedAnswers(openEnded);
      setSubmittedProblems(submitted);
      setProblemState(problemStates);
      
      console.log('Loaded existing answers:', {
        answers,
        mathExpressions,
        openEnded,
        submitted,
        problemStates
      });
    } catch (error) {
      console.error('Error loading existing answers:', error);
      toast({
        title: 'Error loading answers',
        description: 'There was a problem loading your previous answers.',
        variant: 'destructive',
      });
    }
  };

  // Add useEffect to load existing answers when activeContent changes
  useEffect(() => {
    if (activeContent && currentUser?.uid) {
      const content: Content = {
        id: activeContent.id,
        title: activeContent.title,
        type: activeContent.type,
        description: activeContent.description,
        isPublished: activeContent.isPublished,
        dueDate: activeContent.dueDate,
        completed: activeContent.completed,
        completedAt: activeContent.completedAt,
        problems: activeContent.problems
      };
      loadExistingAnswers(content);
    }
  }, [activeContent, currentUser?.uid]);

  // Main render function
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading curriculum...</p>
        </div>
      </div>
    )
  }

  if (!curriculum) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-muted-foreground">No curriculum found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Curriculum</h1>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Loading curriculum...</p>
            </div>
          </div>
        ) : !curriculum?.content?.lessons ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground">No curriculum found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="md:col-span-1 space-y-4">
              {curriculum?.content?.lessons && curriculum.content.lessons.length > 0 ? (
                curriculum.content.lessons.map((lesson: Lesson) => (
                  <Card key={lesson.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{lesson.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {lesson.contents?.map((content: Content) => (
                          <Button
                            key={content.id}
                            variant={activeContent?.id === content.id ? "default" : "ghost"}
                            className="w-full justify-start"
                            onClick={() => handleSelectContent(content)}
                          >
                            {renderContentTypeIcon(content.type)}
                            <span className="truncate">{content.title}</span>
                            {getStatusBadge(content)}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="p-4 border rounded-lg">
                  <p className="text-muted-foreground">No lessons available</p>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="md:col-span-3">
              {activeContent ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{activeContent.title}</CardTitle>
                    <CardDescription>
                      {renderContentTypeIcon(activeContent.type)}
                      {contentTypes.find((type) => type.id === activeContent.type)?.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeContent.problems && activeContent.problems.length > 0 ? (
                      <div className="space-y-6">
                        {activeContent.problems.map((problem, problemIndex) => {
                          const isSubmitted = isProblemSubmitted(problemIndex);
                          const problemScore = getProblemScore(problemIndex);
                          return (
                            <div key={problemIndex} className="p-4 border rounded-lg">
                              <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="space-y-1">
                                    <h3 className="font-medium">
                                      Problem {problemIndex + 1}
                                      {problem.points && (
                                        <span className="ml-2 text-sm text-muted-foreground">
                                          ({problem.points} points)
                                        </span>
                                      )}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      {renderLatex(problem.question)}
                                    </p>
                                  </div>
                                  {isSubmitted && (
                                    <Badge
                                      variant={problemScore === problem.points ? "default" : "destructive"}
                                    >
                                      {problemScore}/{problem.points} points
                                    </Badge>
                                  )}
                                </div>

                                {problem.type === "multiple-choice" && (
                                  <RadioGroup
                                    value={userAnswers[activeContent.id]?.[problemIndex]?.toString()}
                                    onValueChange={(value) =>
                                      handleMultipleChoiceSelect(problemIndex, parseInt(value))
                                    }
                                    disabled={isSubmitted}
                                  >
                                    {problem.options?.map((option, optionIndex) => (
                                      <div key={optionIndex} className="flex items-center space-x-2">
                                        <RadioGroupItem
                                          value={optionIndex.toString()}
                                          id={`option-${problemIndex}-${optionIndex}`}
                                        />
                                        <Label
                                          htmlFor={`option-${problemIndex}-${optionIndex}`}
                                          className="flex-1 cursor-pointer"
                                        >
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
                                                    <div key={i}>{renderLatex(String(answer))}</div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <div>{renderLatex(String(problem.correctAnswer || ''))}</div>
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
                                      <Label htmlFor={`open-ended-answer-${problemIndex}`}>Your Answer:</Label>
                                      <div className="flex space-x-2">
                                        <Input
                                          id={`open-ended-answer-${problemIndex}`}
                                          value={openEndedAnswers[activeContent.id]?.[problemIndex] || ""}
                                          onChange={(e) => handleOpenEndedInput(problemIndex, e.target.value)}
                                          placeholder="Enter your answer"
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
                                              {renderLatex(String(problem.correctAnswer || ''))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-muted-foreground">No problems found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center">
                  <p className="text-muted-foreground">No content selected</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}