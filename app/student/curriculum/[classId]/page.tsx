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
import { doc, setDoc } from "firebase/firestore"
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
  name: string;
  email: string;
  password: string;
  role: "student" | "teacher" | "admin";
  status?: "active" | "inactive";
  avatar?: string;
  classes: string[];
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

interface Curriculum {
  lessons: Lesson[];
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
}

interface ProblemState {
  [key: string]: {
    answer: string;
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

export default function StudentCurriculum() {
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

  // Handle selecting a content item
  const handleSelectContent = async (content: Content) => {
    setActiveContent(content)

    // Check if this content has already been graded for this student
    if (currentUser) {
      try {
        // Get user ID from all possible sources
        const userId = currentUser.id || currentUser.uid || currentUser.user?.id || currentUser.user?.uid;
        
        if (!userId) {
          console.error('No user ID found in current user data:', currentUser);
          toast({
            title: "Authentication Error",
            description: "Please log in again to continue.",
            variant: "destructive",
          });
          return;
        }

        // First check Firebase for existing answers
        const answersRef = ref(realtimeDb, `student-answers/${classId}/${content.id}/${userId}/problems`);
        console.log('Loading answers from path:', `student-answers/${classId}/${content.id}/${userId}/problems`);
        const snapshot = await get(answersRef);
        const existingAnswers = snapshot.val();

        console.log('Loaded existing answers:', existingAnswers);

        if (existingAnswers) {
          // If the student has already completed this content, show the results
          setShowResults(true);

          // Process each problem's answer
          Object.entries(existingAnswers).forEach(([problemKey, answerData]: [string, any]) => {
            if (!answerData) {
              console.warn(`No answer data found for problem ${problemKey}`);
              return;
            }

            const problemIndex = parseInt(problemKey.replace('problem-', ''), 10);
            if (isNaN(problemIndex)) {
              console.warn(`Invalid problem index in key ${problemKey}`);
              return;
            }

            const problem = content.problems?.[problemIndex];
            if (!problem) {
              console.warn(`No problem found for index ${problemIndex}`);
              return;
            }

            // Update the appropriate state based on problem type
            if (problem.type === 'multiple-choice') {
              setUserAnswers(prev => ({
                ...prev,
                [content.id]: {
                  ...(prev[content.id] || {}),
                  [problemIndex]: Number(answerData.answer) || -1
                }
              }));
            } else if (problem.type === 'math-expression') {
              setMathExpressionInputs(prev => ({
                ...prev,
                [content.id]: {
                  ...(prev[content.id] || {}),
                  [problemIndex]: answerData.answer || ''
                }
              }));
            } else if (problem.type === 'open-ended') {
              setOpenEndedAnswers(prev => ({
                ...prev,
                [content.id]: {
                  ...(prev[content.id] || {}),
                  [problemIndex]: answerData.answer || ''
                }
              }));
            }

            // Update problem state
            setProblemState(prev => ({
              ...prev,
              [`${content.id}-${problemIndex}`]: {
                answer: answerData.answer || '',
                submitted: true,
                score: answerData.score || 0
              }
            }));

            // Update submitted problems
            setSubmittedProblems(prev => ({
              ...prev,
              [`${content.id}-${problemIndex}`]: true
            }));
          });

          return;
        }

        // If no Firebase data, check localStorage as fallback
        const gradedContentKey = `graded-content-${classId}-${content.id}`;
        const gradedData = localStorage.getItem(gradedContentKey);

        if (gradedData) {
          try {
            const submissions = JSON.parse(gradedData) as Submission[];
            const userSubmission = submissions.find((sub: Submission) => sub.studentId === currentUser.id);

            if (userSubmission && userSubmission.status === "completed") {
              setShowResults(true);

              if (userSubmission.answers) {
                if (userSubmission.answers.multipleChoice) {
                  setUserAnswers({
                    [content.id]: userSubmission.answers.multipleChoice,
                  });
                }

                if (userSubmission.answers.mathExpression) {
                  setMathExpressionInputs({
                    [content.id]: userSubmission.answers.mathExpression,
                  });
                }

                if (userSubmission.answers.openEnded) {
                  setOpenEndedAnswers({
                    [content.id]: userSubmission.answers.openEnded,
                  });
                }
              }

              return;
            }
          } catch (error) {
            console.error("Error loading graded content:", error);
          }
        }
      } catch (error) {
        console.error("Error loading student answers:", error);
        toast({
          title: "Error",
          description: "Failed to load your previous answers. Please try again.",
          variant: "destructive",
        });
      }
    }

    setShowResults(false);

    // Initialize user answers if not already set
    if (content.problems && content.problems.length > 0) {
      // For multiple choice questions
      const initialMultipleChoiceAnswers = {};
      // For math expression questions
      const initialMathExpressionInputs = {};
      // For open ended questions
      const initialOpenEndedAnswers = {};

      content.problems.forEach((problem, index) => {
        if (problem.type === "multiple-choice") {
          if (!userAnswers[content.id] || userAnswers[content.id][index] === undefined) {
            initialMultipleChoiceAnswers[index] = -1; // -1 means no answer selected
          }
        } else if (problem.type === "math-expression") {
          if (!mathExpressionInputs[content.id] || mathExpressionInputs[content.id][index] === undefined) {
            initialMathExpressionInputs[index] = "";
          }
        } else if (problem.type === "open-ended") {
          if (!openEndedAnswers[content.id] || openEndedAnswers[content.id][index] === undefined) {
            initialOpenEndedAnswers[index] = "";
          }
        }
      });

      if (Object.keys(initialMultipleChoiceAnswers).length > 0) {
        setUserAnswers({
          ...userAnswers,
          [content.id]: {
            ...(userAnswers[content.id] || {}),
            ...initialMultipleChoiceAnswers,
          },
        });
      }

      if (Object.keys(initialMathExpressionInputs).length > 0) {
        setMathExpressionInputs({
          ...mathExpressionInputs,
          [content.id]: {
            ...(mathExpressionInputs[content.id] || {}),
            ...initialMathExpressionInputs,
          },
        });
      }

      if (Object.keys(initialOpenEndedAnswers).length > 0) {
        setOpenEndedAnswers({
          ...openEndedAnswers,
          [content.id]: {
            ...(openEndedAnswers[content.id] || {}),
            ...initialOpenEndedAnswers,
          },
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
    let result;

    if (problem.type === "multiple-choice") {
      const selectedOption = userAnswers[activeContent.id]?.[problemIndex];
      result = selectedOption === problem.answer;
    } else if (problem.type === "math-expression") {
      result = gradeMathExpression(problem, mathExpressionInputs[activeContent.id]?.[problemIndex] || "");
    } else if (problem.type === "open-ended") {
      result = gradeOpenEnded(problem, openEndedAnswers[activeContent.id]?.[problemIndex] || "");
    }

    // Update problem scores
    setProblemScores(prev => ({
      ...prev,
      [`${activeContent.id}-${problemIndex}`]: result?.score || 0
    }));

    // Mark problem as submitted
    setSubmittedProblems(prev => ({
      ...prev,
      [`${activeContent.id}-${problemIndex}`]: true
    }));

    // Show feedback toast
    toast({
      title: result?.correct ? "Correct!" : "Incorrect",
      description: `You scored ${result?.score || 0} points for this problem.`,
      variant: result?.correct ? "default" : "destructive",
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
  const sendRealTimeUpdate = async (problemIndex: number, answer: string | number, type: string, problem: Problem) => {
    // Add detailed validation logging
    console.log('Current user data:', currentUser);
    console.log('Active content:', activeContent);
    console.log('Problem data:', problem);
    
    // Get user ID from all possible sources
    const userId = currentUser?.uid || currentUser?.id || currentUser?.user?.uid;
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
        timestamp: Date.now(),
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

      // Save to Realtime Database for real-time updates
      const realtimeRef = ref(realtimeDb, `student-answers/${classId}/${activeContent.id}/${userId}/problems/problem-${problemIndex}`);
      await set(realtimeRef, answerData);

      // Also save to student-progress for the progress table
      const progressRef = ref(realtimeDb, `student-progress/${classId}/${activeContent.id}/${userId}/problems/problem-${problemIndex}`);
      await set(progressRef, answerData);

      // Check if all problems are answered
      const allProblemsRef = ref(realtimeDb, `student-answers/${classId}/${activeContent.id}/${userId}/problems`);
      const allProblemsSnapshot = await get(allProblemsRef);
      const allProblems = allProblemsSnapshot.val() || {};
      
      const totalProblems = activeContent.problems?.length || 0;
      const answeredProblems = Object.keys(allProblems).length;
      
      // If all problems are answered, update the status to completed
      if (answeredProblems >= totalProblems) {
        const completionData = {
          ...answerData,
          status: "completed",
          completedAt: Date.now()
        };
        
        // Update both paths with completion status
        await set(realtimeRef, completionData);
        await set(progressRef, completionData);
        
        // Also update the parent node status
        const parentRef = ref(realtimeDb, `student-answers/${classId}/${activeContent.id}/${userId}`);
        await set(parentRef, { status: "completed", completedAt: Date.now() });
        
        const parentProgressRef = ref(realtimeDb, `student-progress/${classId}/${activeContent.id}/${userId}`);
        await set(parentProgressRef, { status: "completed", completedAt: Date.now() });
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
                        const problemScore = getProblemScore(problemIndex);
                        
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
                                      (problem.type === "multiple-choice" && 
                                       (userAnswers[activeContent.id]?.[problemIndex] === undefined || 
                                        userAnswers[activeContent.id]?.[problemIndex] === -1)) ||
                                      (problem.type === "math-expression" && 
                                       (!mathExpressionInputs[activeContent.id]?.[problemIndex] || 
                                        mathExpressionInputs[activeContent.id]?.[problemIndex] === "")) ||
                                      (problem.type === "open-ended" && 
                                       (!openEndedAnswers[activeContent.id]?.[problemIndex] || 
                                        openEndedAnswers[activeContent.id]?.[problemIndex] === ""))
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
