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
  const answersRef = React.useRef<UserAnswers>({});
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
    if (!activeContent || !sessionManager.getSession()?.userId) return;
    
    try {
      const userId = sessionManager.getSession()?.userId;
      const updateRef = ref(realtimeDb, `student-answers/${classId}/${contentId}/${userId}/${problemId}`);
      
      const updateData = {
        answer,
        timestamp: Date.now(),
        studentId: userId,
        studentName: sessionManager.getSession()?.name || 'Unknown Student',
        studentEmail: sessionManager.getSession()?.email,
        questionId: problemId,
        questionText: activeContent.problems?.[parseInt(problemId)]?.question || 'Question not available',
        answerType: activeContent.problems?.[parseInt(problemId)]?.type || 'open-ended',
        correct: undefined, // Will be set by teacher
        partialCredit: undefined // Will be set by teacher
      };

      await set(updateRef, updateData);
      console.log('Real-time update sent:', updateData);
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

  const saveAnswers = async (content: Content) => {
    const userId = sessionManager.getSession()?.userId;
    if (!userId || !content?.id) {
      console.error('Error: userId or content.id is undefined. Cannot save answers.');
      return;
    }

    try {
      // Get the answers for this specific content
      const contentAnswers = userAnswers[content.id] || {};
      
      // Create a sanitized version of answers without undefined values
      const sanitizedAnswers = Object.entries(contentAnswers).reduce((acc, [problemIndex, value]) => {
        if (value !== undefined && value !== null) {
          acc[problemIndex] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      // Save to Firestore for persistence
      const answersRef = ref(realtimeDb, `answers/${userId}/${content.id}`);
      const isComplete = checkContentCompletion(content);

      await set(answersRef, {
        userAnswers: sanitizedAnswers,
        status: isComplete ? 'completed' : 'in-progress',
        lastUpdated: new Date().toISOString(),
        studentId: userId,
        contentId: content.id,
        classId: classId
      });

      // Also save to real-time database for teacher monitoring
      const realtimeRef = ref(realtimeDb, `student-answers/${classId}/${content.id}/${userId}`);
      await set(realtimeRef, {
        answers: sanitizedAnswers,
        lastUpdated: Date.now(),
        status: isComplete ? 'completed' : 'in-progress',
        studentId: userId,
        studentName: sessionManager.getSession()?.name || 'Unknown Student',
        studentEmail: sessionManager.getSession()?.email
      });

      console.log('Answers saved successfully:', {
        contentId: content.id,
        answers: sanitizedAnswers,
        isComplete
      });
    } catch (error) {
      console.error('Error saving answers:', error);
      // Show error toast to user
      toast({
        title: "Error saving answers",
        description: "There was a problem saving your answers. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleMultipleChoiceSelect = (value: string, problemIndex: number) => {
    if (!activeContent) return;
    
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }));

    // Save answers and send real-time update
    saveAnswers(activeContent);
    sendRealTimeUpdate(activeContent.id, `problem-${problemIndex}`, value);
  };

  const handleMathExpressionInput = (value: string, problemIndex: number) => {
    if (!activeContent) return;
    
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }));

    // Save answers and send real-time update
    saveAnswers(activeContent);
    sendRealTimeUpdate(activeContent.id, `problem-${problemIndex}`, value);
  };

  const handleOpenEndedInput = (value: string, problemIndex: number) => {
    if (!activeContent) return;
    
    setUserAnswers(prev => ({
      ...prev,
      [activeContent.id]: {
        ...prev[activeContent.id],
        [problemIndex]: value
      }
    }));

    // Save answers and send real-time update
    saveAnswers(activeContent);
    sendRealTimeUpdate(activeContent.id, `problem-${problemIndex}`, value);
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
}
