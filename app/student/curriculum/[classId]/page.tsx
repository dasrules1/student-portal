"use client"

import * as React from 'react';
import { useEffect, useState } from 'react';
import { ref, get, set, onValue, serverTimestamp } from 'firebase/database';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  BookOpen,
  FileQuestion,
  FileText,
  CheckCircle2,
  Clock,
  Pencil,
  Calculator,
  Loader2,
  Send,
  ArrowLeft,
  ArrowRight,
  Video,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { realtimeDb } from '@/lib/firebase';
import { sessionManager } from '@/lib/session';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
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
  type: 'lesson' | 'quiz' | 'assignment';
  problems?: Problem[];
}

interface Problem {
  readonly id: string;
  question: string;
  type: 'multiple_choice' | 'math_expression' | 'open_ended';
  options?: string[];
  correctAnswer?: string | number;
  readonly points: number;
  explanation?: string;
}

interface ProblemSubmission {
  readonly studentId: string;
  readonly status: 'completed' | 'in_progress';
  readonly score: number;
}

interface ContentState {
  id: string;
  title: string;
  type: 'lesson' | 'quiz' | 'assignment';
  problems?: Problem[];
  status: 'not_started' | 'in_progress' | 'completed';
  score?: number;
  totalPoints?: number;
}

type MathExpressionInputs = Record<string, string[]>;
type OpenEndedAnswers = Record<string, string>;
type UserAnswers = Record<string, (string | number | null)[]>;
type ProblemType = 'multiple_choice' | 'math_expression' | 'open_ended';

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
    [problemIndex: number]: string
  }
}

interface UserGrades {
  [contentId: string]: {
    [problemIndex: number]: {
      score: number
      correct: boolean
    }
  }
}

interface AttemptCounts {
  [contentId: string]: {
    [problemIndex: number]: number
  }
}

interface ProblemScores {
  [problemId: string]: number
}

interface SubmittedProblems {
  [problemId: string]: boolean
}

interface MathExpressionInputs {
  [key: string]: {
    [key: string]: string;
  };
}

interface OpenEndedAnswers {
  [key: string]: {
    [key: string]: string;
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

  correct: boolean;
  score: number;
}

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
  const loadSavedAnswers = async (content: Content) => {
    if (!currentUser?.id || !content?.id) return;

    const answersPath = `student-answers/${classId}/${content.id}`;
    const answersRef = ref(realtimeDb, answersPath);

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
