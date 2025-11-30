"use client"

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { storage } from '@/lib/storage';
import { sessionManager } from '@/lib/session';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckSquare, LayoutDashboard, Book, File, Cog, ArrowLeft, Send, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface Problem {
  id?: string;
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string | number;
  correctAnswers?: (string | number)[];
  keywords?: string[];
  tolerance?: number;
  points?: number;
  maxAttempts?: number;
}

interface Content {
  id: string;
  title: string;
  description?: string;
  type: string;
  problems?: Problem[];
  points?: number;
}

interface UserAnswers {
  [contentId: string]: {
    [problemIndex: number]: number;
  };
}

interface MathExpressionInputs {
  [contentId: string]: {
    [problemIndex: number]: string;
  };
}

interface OpenEndedAnswers {
  [contentId: string]: {
    [problemIndex: number]: string;
  };
}

interface SubmittedProblems {
  [key: string]: {
    isSubmitted: boolean;
    score: number;
  };
}

interface ProblemState {
  [key: string]: {
    answer?: string | number;
    submitted?: boolean;
    score?: number;
    attempts?: number;
    isHalfCredit?: boolean;
  };
}

interface GradingResult {
  correct: boolean;
  score: number;
}

const AssignmentDetailPage: React.FC = () => {
  const params = useParams<{ classId: string; contentId: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [problemScores, setProblemScores] = useState<Record<string, number>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [problemStatuses, setProblemStatuses] = useState<Record<number, 'correct' | 'incorrect' | 'pending'>>({});
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [mathExpressionInputs, setMathExpressionInputs] = useState<MathExpressionInputs>({});
  const [openEndedAnswers, setOpenEndedAnswers] = useState<OpenEndedAnswers>({});
  const [submittedProblems, setSubmittedProblems] = useState<SubmittedProblems>({});
  const [problemState, setProblemState] = useState<ProblemState>({});
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  const classId = params.classId;
  const contentId = params.contentId;

  // Load user from session manager (like curriculum page does)
  useEffect(() => {
    const loadUser = () => {
      try {
        const sessionUser = sessionManager.getCurrentUser();
        if (sessionUser && sessionUser.user) {
          setCurrentUser(sessionUser.user);
        } else if (authUser) {
          setCurrentUser(authUser);
        }
      } catch (error) {
        console.error('Error loading user:', error);
        if (authUser) {
          setCurrentUser(authUser);
        }
      }
    };
    loadUser();
  }, [authUser]);

  useEffect(() => {
    if (classId && contentId) {
      loadAssignment();
      if (currentUser) {
        loadScores();
      }
    }
  }, [classId, contentId, currentUser]);

  const loadAssignment = async () => {
    try {
      setLoading(true);
      console.log('Loading assignment for classId:', classId, 'contentId:', contentId);
      
      const curriculum = await storage.getCurriculum(classId, 'student');
      console.log('Curriculum loaded:', curriculum);
      
      if (!curriculum) {
        console.log('No curriculum found');
        setLoading(false);
        return;
      }
      
      if (!curriculum.content) {
        console.log('Curriculum has no content property');
        setLoading(false);
        return;
      }
      
      const lessons = curriculum.content.lessons || [];
      console.log('Found lessons:', lessons.length);
      
      let foundContent = null;
      
      for (const lesson of lessons) {
        const lessonAny = lesson as any;
        if (lessonAny.contents && Array.isArray(lessonAny.contents)) {
          console.log('Checking lesson:', lessonAny.title, 'with', lessonAny.contents.length, 'contents');
          foundContent = lessonAny.contents.find((c: any) => c && c.id === contentId);
          if (foundContent) {
            console.log('Found content:', foundContent.title);
            break;
          }
        }
      }
      
      if (foundContent) {
        setContent(foundContent);
        // Load existing answers if user is available
        if (currentUser && db) {
          try {
            await loadExistingAnswers(foundContent);
          } catch (error) {
            console.error('Error loading existing answers:', error);
            // Don't block the UI if loading answers fails
          }
        }
      } else {
        console.log('Content not found in any lesson');
        toast({
          title: "Assignment Not Found",
          description: "The assignment you're looking for could not be found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading assignment:', error);
      toast({
        title: "Error",
        description: "Failed to load assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAnswers = async (content: Content) => {
    if (!db || !currentUser || !classId || !content.id) return;

    try {
      const userId = currentUser.uid || currentUser.id;
      const answersQuery = query(
        collection(db, 'student-answers', classId, 'answers'),
        where('contentId', '==', content.id),
        where('studentId', '==', userId)
      );
      const answersSnapshot = await getDocs(answersQuery);
      
      const answers: UserAnswers = {};
      const mathExpressions: MathExpressionInputs = {};
      const openEnded: OpenEndedAnswers = {};
      const submitted: SubmittedProblems = {};
      const problemStates: ProblemState = {};
      const scores: Record<string, number> = {};
      const statuses: Record<number, 'correct' | 'incorrect' | 'pending'> = {};
      const attempts: Record<string, number> = {};
      let total = 0;

      answersSnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const problemIndex = data.problemIndex;
        
        if (problemIndex !== undefined) {
          const key = `${content.id}-${problemIndex}`;
          
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
          submitted[key] = { isSubmitted: data.submitted || data.status === 'submitted' || data.status === 'completed', score: data.score || 0 };
          problemStates[key] = {
            answer: data.answer,
            submitted: data.submitted || data.status === 'submitted' || data.status === 'completed',
            score: data.score || 0,
            isHalfCredit: data.isHalfCredit || false
          };
          
          scores[key] = data.score || 0;
          total += data.score || 0;
          statuses[problemIndex] = data.correct ? 'correct' : 'incorrect';
          
          // Count attempts (we'll need to track this separately or estimate)
          attempts[key] = (attempts[key] || 0) + 1;
        }
      });
      
      setUserAnswers(answers);
      setMathExpressionInputs(mathExpressions);
      setOpenEndedAnswers(openEnded);
      setSubmittedProblems(submitted);
      setProblemState(problemStates);
      setProblemScores(scores);
      setTotalScore(total);
      setProblemStatuses(statuses);
      setAttemptCounts(attempts);
    } catch (error) {
      console.error('Error loading existing answers:', error);
    }
  };

  const loadScores = async () => {
    if (!db || !currentUser || !classId || !contentId) return;

    try {
      const userId = currentUser.uid || currentUser.id;
      const answersRef = collection(db, 'student-answers', classId, 'answers');
      const q = query(
        answersRef,
        where('studentId', '==', userId),
        where('contentId', '==', contentId)
      );
      const querySnapshot = await getDocs(q);

      const scores: Record<number, number> = {};
      const statuses: Record<number, 'correct' | 'incorrect' | 'pending'> = {};
      let total = 0;

      querySnapshot.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const problemIndex = data.problemIndex;
        if (problemIndex !== undefined) {
          scores[problemIndex] = data.score || 0;
          total += data.score || 0;
          statuses[problemIndex] = data.correct ? 'correct' : 'incorrect';
        }
      });

      setProblemScores(prev => ({ ...prev, ...scores }));
      setTotalScore(total);
      setProblemStatuses(statuses);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
  };

  const gradeMathExpression = (problem: Problem, studentAnswer: string): GradingResult => {
    let result: GradingResult = { correct: false, score: 0 };
    
    if (!studentAnswer || !problem) return result;

    const cleanStudentAnswer = studentAnswer.trim().toLowerCase();
    
    if (problem.correctAnswers && Array.isArray(problem.correctAnswers)) {
      for (const correctAnswer of problem.correctAnswers) {
        const cleanCorrectAnswer = correctAnswer.toString().trim().toLowerCase();
        
        if (cleanStudentAnswer === cleanCorrectAnswer) {
          result = { correct: true, score: problem.points || 0 };
          return result;
        }
        
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
      const correctAnswer = problem.correctAnswer.toString();
      const cleanCorrectAnswer = correctAnswer.trim().toLowerCase();
      
      if (cleanStudentAnswer === cleanCorrectAnswer) {
        result = { correct: true, score: problem.points || 0 };
        return result;
      }
      
      const studentNum = parseFloat(cleanStudentAnswer);
      const correctNum = parseFloat(correctAnswer);
      
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

  const gradeOpenEnded = (problem: Problem, studentAnswer: string): GradingResult => {
    let result: GradingResult = { correct: false, score: 0 };
    
    if (!studentAnswer || !problem || !problem.keywords || !Array.isArray(problem.keywords)) {
      return result;
    }
    
    const foundKeywords = problem.keywords.filter(keyword => 
      studentAnswer.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (foundKeywords.length > 0) {
      const keywordScore = (foundKeywords.length / problem.keywords.length) * (problem.points || 1);
      result = { correct: keywordScore >= (problem.points || 1) * 0.5, score: Math.round(keywordScore) };
    }
    
    return result;
  };

  const handleMultipleChoiceSelect = (problemIndex: number, value: number) => {
    if (!content?.id) return;
    const key = `${content.id}-${problemIndex}`;
    
    setProblemState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        answer: value,
        submitted: false
      }
    }));
    
    setUserAnswers(prev => ({
      ...prev,
      [content.id]: {
        ...(prev[content.id] || {}),
        [problemIndex]: value
      }
    }));
  };

  const handleMathExpressionInput = (problemIndex: number, value: string) => {
    if (!content?.id) return;
    const key = `${content.id}-${problemIndex}`;
    
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
      [content.id]: {
        ...(prev[content.id] || {}),
        [problemIndex]: value
      }
    }));
  };

  const handleOpenEndedInput = (problemIndex: number, value: string) => {
    if (!content?.id) return;
    const key = `${content.id}-${problemIndex}`;
    
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
      [content.id]: {
        ...(prev[content.id] || {}),
        [problemIndex]: value
      }
    }));
  };

  const sendRealTimeUpdate = async (
    problemIndex: number, 
    answer: string | number, 
    type: string, 
    problem: Problem, 
    isSubmitted: boolean,
    finalScore: number,
    isCorrect: boolean,
    isHalfCredit: boolean
  ) => {
    console.log('sendRealTimeUpdate called:', {
      problemIndex,
      answer,
      type,
      isSubmitted,
      finalScore,
      isCorrect,
      isHalfCredit,
      hasUser: !!currentUser,
      hasContent: !!content,
      hasDb: !!db,
      currentUser
    });
    
    if (!currentUser) {
      console.error('No user in sendRealTimeUpdate');
      toast({
        title: "Authentication Error",
        description: "Please log in to submit answers.",
        variant: "destructive",
      });
      return;
    }
    
    if (!content?.id) {
      console.error('No content ID in sendRealTimeUpdate');
      toast({
        title: "Error",
        description: "Assignment content is not loaded.",
        variant: "destructive",
      });
      return;
    }
    
    if (!db) {
      console.error('No database in sendRealTimeUpdate');
      toast({
        title: "Error",
        description: "Database connection is not available.",
        variant: "destructive",
      });
      return;
    }

    const userId = currentUser.uid || currentUser.id;
    const userName = currentUser.displayName || currentUser.name || 'Student';
    const userEmail = currentUser.email || '';
    
    try {
      console.log('Sending real-time update:', {
        problemIndex,
        answer,
        type,
        finalScore,
        isCorrect,
        isSubmitted,
        isHalfCredit
      });

      const answerData = {
        // Required fields for real-time matching
        studentId: userId,
        classId: classId,
        contentId: content.id,
        problemIndex: problemIndex,
        
        // Answer data
        answer: answer?.toString() || '',
        answerType: type,
        correct: isCorrect,
        score: finalScore,
        
        // Metadata
        updatedAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        
        // Additional fields (optional but useful)
        studentName: userName,
        studentEmail: userEmail,
        questionId: problem.id || `problem-${problemIndex}`,
        questionText: problem.question || 'Question not available',
        problemType: problem.type,
        problemPoints: problem.points || 1,
        contentTitle: content.title || 'Untitled Content',
        status: isSubmitted ? "submitted" : "in-progress",
        submitted: isSubmitted,
        submittedAt: isSubmitted ? serverTimestamp() : null,
        isHalfCredit: isHalfCredit
      };

      // Save to Firestore using standardized schema and document ID
      // Document ID: ${contentId}_${studentId}_problem-${problemIndex}
      const docId = `${content.id}_${userId}_problem-${problemIndex}`;
      const answerRef = doc(db, 'student-answers', classId, 'answers', docId);
      
      console.log('Attempting to save to Firestore:', {
        docId,
        path: `student-answers/${classId}/answers/${docId}`,
        classId,
        contentId: content.id,
        userId,
        answerData
      });
      
      try {
        await setDoc(answerRef, answerData, { merge: true });
        console.log('Successfully saved to student-answers collection');
      } catch (saveError) {
        console.error('Error saving to student-answers:', saveError);
        throw saveError;
      }

      // Also save to student-progress collection
      try {
        const progressRef = doc(db, 'student-progress', `${classId}_${content.id}_${userId}_problem-${problemIndex}`);
        await setDoc(progressRef, answerData, { merge: true });
        console.log('Successfully saved to student-progress collection');
      } catch (progressError) {
        console.error('Error saving to student-progress (non-fatal):', progressError);
        // Don't throw - this is optional
      }

      // Update local state
      const newKey = `${content.id}-${problemIndex}`;
      setProblemScores(prev => ({ ...prev, [newKey]: finalScore }));
      setProblemStatuses(prev => ({ ...prev, [problemIndex]: isCorrect ? 'correct' : 'incorrect' }));
      
      // Update total score
      setTotalScore(prev => {
        const oldScore = problemScores[newKey] || 0;
        return prev - oldScore + finalScore;
      });
      
      console.log('Local state updated with score:', finalScore);
    } catch (error) {
      console.error('Error saving answer:', error);
      toast({
        title: "Error saving answer",
        description: "There was a problem saving your answer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmitProblem = async (problemIndex: number) => {
    console.log('handleSubmitProblem called:', { 
      problemIndex, 
      hasContent: !!content, 
      hasProblems: !!content?.problems, 
      hasUser: !!currentUser, 
      currentUser,
      hasDb: !!db
    });
    
    if (!content?.problems) {
      console.error('No content or problems available');
      toast({
        title: "Error",
        description: "Assignment content is not loaded. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentUser) {
      console.error('No user available');
      toast({
        title: "Authentication Error",
        description: "Please log in to submit answers.",
        variant: "destructive",
      });
      return;
    }
    
    if (!db) {
      console.error('Database not available');
      toast({
        title: "Error",
        description: "Database connection is not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    const problem = content.problems[problemIndex];
    const key = `${content.id}-${problemIndex}`;
    
    const currentAttempts = attemptCounts[key] || 0;
    const maxAttempts = problem.maxAttempts || Infinity;
    const newAttemptCount = currentAttempts + 1;
    
    setAttemptCounts(prev => ({
      ...prev,
      [key]: newAttemptCount
    }));

    let answer: string | number = '';
    let result: GradingResult = { correct: false, score: 0 };
    
    if (problem.type === "multiple-choice") {
      const selectedOption = userAnswers[content.id]?.[problemIndex];
      if (selectedOption === undefined || selectedOption === null) {
        toast({
          title: "No answer selected",
          description: "Please select an answer before submitting.",
          variant: "destructive",
        });
        return;
      }
      answer = selectedOption;
      result = {
        correct: selectedOption === problem.correctAnswer,
        score: selectedOption === problem.correctAnswer ? (problem.points || 1) : 0
      };
    } else if (problem.type === "math-expression") {
      answer = mathExpressionInputs[content.id]?.[problemIndex] || "";
      if (!answer) {
        toast({
          title: "No answer provided",
          description: "Please enter an answer before submitting.",
          variant: "destructive",
        });
        return;
      }
      result = gradeMathExpression(problem, answer);
    } else if (problem.type === "open-ended") {
      answer = openEndedAnswers[content.id]?.[problemIndex] || "";
      if (!answer) {
        toast({
          title: "No answer provided",
          description: "Please enter an answer before submitting.",
          variant: "destructive",
        });
        return;
      }
      result = gradeOpenEnded(problem, answer);
    }

    const hasExceededMaxAttempts = newAttemptCount > maxAttempts;
    let finalScore = result.score;
    
    if (hasExceededMaxAttempts && result.correct) {
      finalScore = (problem.points || 1) / 2;
    }

    const isHalfCredit = hasExceededMaxAttempts && result.correct;

    console.log('Submitting problem:', {
      problemIndex,
      answer,
      result,
      finalScore,
      isCorrect: result.correct,
      isHalfCredit,
      hasExceededMaxAttempts,
      newAttemptCount,
      maxAttempts
    });

    // Update local state first
    setSubmittedProblems(prev => ({
      ...prev,
      [key]: { isSubmitted: true, score: finalScore }
    }));

    setProblemState(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        submitted: true,
        score: finalScore,
        isHalfCredit: isHalfCredit
      }
    }));

    // Send to Firestore with the calculated values
    await sendRealTimeUpdate(
      problemIndex, 
      answer, 
      problem.type, 
      problem, 
      true,
      finalScore,
      result.correct,
      isHalfCredit
    );

    toast({
      title: result.correct ? "Correct!" : "Incorrect",
      description: isHalfCredit 
        ? `You received ${finalScore.toFixed(1)} points (half credit for exceeding max attempts).`
        : `You received ${finalScore} out of ${problem.points || 1} points.`,
      variant: result.correct ? "default" : "destructive",
    });
  };

  const isProblemSubmitted = (problemIndex: number): boolean => {
    if (!content?.id) return false;
    const key = `${content.id}-${problemIndex}`;
    const submitted = submittedProblems[key];
    return typeof submitted === 'boolean' 
      ? submitted 
      : (submitted && typeof submitted === 'object' ? submitted.isSubmitted : false) 
      || problemState[key]?.submitted 
      || false;
  };

  const getProblemScore = (problemIndex: number): number => {
    if (!content?.id) return 0;
    const key = `${content.id}-${problemIndex}`;
    return problemScores[key] || problemState[key]?.score || submittedProblems[key]?.score || 0;
  };

  const renderLatex = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);
    if (parts.length === 1) return text;
    return (
      <>
        {parts.map((part, index) => {
          if (!part) return null;
          if (part.startsWith("$$") && part.endsWith("$$")) {
            const latex = part.slice(2, -2).trim();
            try {
              return <BlockMath key={index} math={latex} />;
            } catch (error) {
              return <span key={index}>{part}</span>;
            }
          } else if (part.startsWith("$") && part.endsWith("$")) {
            const latex = part.slice(1, -1).trim();
            try {
              return <InlineMath key={index} math={latex} />;
            } catch (error) {
              return <span key={index}>{part}</span>;
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const navigation = [
    { title: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard, current: false },
    { title: "Classes", href: "/student/classes", icon: Book, current: false },
    { title: "Assignments", href: "/student/assignments", icon: CheckSquare, current: false },
    { title: "Grades", href: "/student/grades", icon: File, current: false },
    { title: "Settings", href: "/student/settings", icon: Cog, current: false },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser ? { id: currentUser.uid || currentUser.id, name: currentUser.displayName || currentUser.name || 'Student', email: currentUser.email || '', role: 'student' } : undefined} />
        <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
          <p>Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={currentUser ? { id: currentUser.uid || currentUser.id, name: currentUser.displayName || currentUser.name || 'Student', email: currentUser.email || '', role: 'student' } : undefined} />
        <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Not Found</CardTitle>
              <CardDescription>The assignment you're looking for doesn't exist or isn't available.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/student/assignments">Back to Assignments</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const problems = content.problems || [];
  const maxPoints = problems.reduce((sum, p) => sum + (p.points || 1), 0);
  const percentage = maxPoints > 0 ? Math.round((totalScore / maxPoints) * 100) : 0;
  const currentProblem = problems[currentProblemIndex];

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} user={currentUser ? { id: currentUser.uid || currentUser.id, name: currentUser.displayName || currentUser.name || 'Student', email: currentUser.email || '', role: 'student' } : undefined} />
      <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/student/assignments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assignments
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mb-2">{content.title}</h1>
          {content.description && (
            <p className="text-muted-foreground">{content.description}</p>
          )}
        </div>

        {/* Score Display - Simple text, no circle */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
    <div>
              <p className="text-sm text-muted-foreground">Your Score</p>
              <p className="text-4xl font-bold">{percentage}</p>
            </div>
          </div>
        </div>

        {/* Problem Boxes Grid - Numbers instead of letters */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Problems</h2>
          <div className="grid grid-cols-5 gap-4">
            {problems.map((problem, index) => {
              const status = problemStatuses[index] || 'pending';
              const score = getProblemScore(index);
              const isCorrect = status === 'correct';
              const isSubmitted = isProblemSubmitted(index);
              
              return (
                <button
                  key={index}
                  onClick={() => setCurrentProblemIndex(index)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    ${currentProblemIndex === index ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                    ${isCorrect && isSubmitted ? 'bg-green-50 border-green-300' : status === 'incorrect' && isSubmitted ? 'bg-red-50 border-red-300' : 'bg-white'}
                    hover:shadow-md
                  `}
                >
                  {isCorrect && isSubmitted && (
                    <div className="absolute top-1 left-1">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-700">
                      {index + 1}
                    </p>
                    {score > 0 && (
                      <p className="text-xs text-gray-500 mt-1">{score}/{problem.points || 1}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Problem View with Submission Interface */}
        {currentProblem && (
          <Card>
            <CardHeader>
              <CardTitle>Problem {currentProblemIndex + 1}</CardTitle>
              <CardDescription>
                {renderLatex(currentProblem.question)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Points: {currentProblem.points || 1}
                  </p>
                  {currentProblem.maxAttempts && currentProblem.maxAttempts !== Infinity && (
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const key = `${content.id}-${currentProblemIndex}`;
                        const currentAttempts = attemptCounts[key] || 0;
                        const remaining = currentProblem.maxAttempts - currentAttempts;
                        return remaining > 0 
                          ? `Attempts remaining: ${remaining}`
                          : 'Maximum attempts reached';
                      })()}
                    </p>
                  )}
                  {isProblemSubmitted(currentProblemIndex) && (
                    <Badge variant={getProblemScore(currentProblemIndex) === (currentProblem.points || 1) ? 'default' : 'destructive'}>
                      Score: {getProblemScore(currentProblemIndex)}/{currentProblem.points || 1}
                    </Badge>
                  )}
                </div>

                {currentProblem.type === "multiple-choice" && (
                  <div className="space-y-3">
                    <RadioGroup
                      value={userAnswers[content.id]?.[currentProblemIndex]?.toString()}
                      onValueChange={(value) =>
                        handleMultipleChoiceSelect(currentProblemIndex, parseInt(value))
                      }
                      disabled={getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit}
                    >
                      {currentProblem.options?.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={optionIndex.toString()}
                            id={`option-${currentProblemIndex}-${optionIndex}`}
                          />
                          <Label
                            htmlFor={`option-${currentProblemIndex}-${optionIndex}`}
                            className="flex-1 cursor-pointer"
                          >
                            {renderLatex(option || '')}
                          </Label>
                          {isProblemSubmitted(currentProblemIndex) && optionIndex === currentProblem.correctAnswer && (
                            <CheckCircle2 className="w-4 h-4 ml-auto text-green-500" />
                          )}
                          {isProblemSubmitted(currentProblemIndex) &&
                            userAnswers[content.id]?.[currentProblemIndex] === optionIndex &&
                            optionIndex !== currentProblem.correctAnswer && (
                              <AlertCircle className="w-4 h-4 ml-auto text-red-500" />
                            )}
                        </div>
                      ))}
                    </RadioGroup>
                    {!(getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit) && (
                      <Button
                        onClick={async () => {
                          console.log('Submit button clicked for multiple-choice problem', currentProblemIndex);
                          console.log('Current state:', {
                            hasUser: !!currentUser,
                            hasContent: !!content,
                            hasDb: !!db,
                            answer: userAnswers[content.id]?.[currentProblemIndex]
                          });
                          await handleSubmitProblem(currentProblemIndex);
                        }}
                        className="w-full"
                        disabled={userAnswers[content.id]?.[currentProblemIndex] === undefined}
                        variant={(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "secondary" : "default";
                        })()}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "Submit for Half Credit" : "Submit Answer";
                        })()}
                      </Button>
                    )}
                  </div>
                )}

                {currentProblem.type === "math-expression" && (
                  <div className="space-y-3">
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor={`math-answer-${currentProblemIndex}`}>Your Answer:</Label>
                      <Input
                        id={`math-answer-${currentProblemIndex}`}
                        value={mathExpressionInputs[content.id]?.[currentProblemIndex] || ""}
                        onChange={(e) => handleMathExpressionInput(currentProblemIndex, e.target.value)}
                        placeholder="Enter your answer (e.g., 2x + 3 or 7)"
                        disabled={getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit}
                        className="flex-1"
                      />
                    </div>
                    {!(getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit) && (
                      <Button
                        onClick={async () => {
                          console.log('Submit button clicked for math-expression problem', currentProblemIndex);
                          console.log('Current state:', {
                            hasUser: !!currentUser,
                            hasContent: !!content,
                            hasDb: !!db,
                            answer: mathExpressionInputs[content.id]?.[currentProblemIndex]
                          });
                          await handleSubmitProblem(currentProblemIndex);
                        }}
                        className="w-full"
                        disabled={!mathExpressionInputs[content.id]?.[currentProblemIndex]}
                        variant={(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "secondary" : "default";
                        })()}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "Submit for Half Credit" : "Submit Answer";
                        })()}
                      </Button>
                    )}
                    {isProblemSubmitted(currentProblemIndex) && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Your Answer:</span>
                          <span className="text-sm">{mathExpressionInputs[content.id]?.[currentProblemIndex] || 'No answer'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Score:</span>
                          <span className="text-sm font-semibold">
                            {getProblemScore(currentProblemIndex)} / {currentProblem.points || 1} points
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentProblem.type === "open-ended" && (
                  <div className="space-y-3">
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor={`open-ended-answer-${currentProblemIndex}`}>Your Answer:</Label>
                      <Input
                        id={`open-ended-answer-${currentProblemIndex}`}
                        value={openEndedAnswers[content.id]?.[currentProblemIndex] || ""}
                        onChange={(e) => handleOpenEndedInput(currentProblemIndex, e.target.value)}
                        placeholder="Enter your answer"
                        disabled={getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit}
                        className="flex-1"
                      />
                    </div>
                    {!(getProblemScore(currentProblemIndex) === (currentProblem.points || 1) || problemState[`${content.id}-${currentProblemIndex}`]?.isHalfCredit) && (
                      <Button
                        onClick={async () => {
                          console.log('Submit button clicked for open-ended problem', currentProblemIndex);
                          console.log('Current state:', {
                            hasUser: !!currentUser,
                            hasContent: !!content,
                            hasDb: !!db,
                            answer: openEndedAnswers[content.id]?.[currentProblemIndex]
                          });
                          await handleSubmitProblem(currentProblemIndex);
                        }}
                        className="w-full"
                        disabled={!openEndedAnswers[content.id]?.[currentProblemIndex]}
                        variant={(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "secondary" : "default";
                        })()}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {(() => {
                          const key = `${content.id}-${currentProblemIndex}`;
                          const currentAttempts = attemptCounts[key] || 0;
                          const maxAttempts = currentProblem.maxAttempts || Infinity;
                          return currentAttempts >= maxAttempts ? "Submit for Half Credit" : "Submit Answer";
                        })()}
                      </Button>
                    )}
                    {isProblemSubmitted(currentProblemIndex) && (
                      <div className="p-3 bg-muted rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Your Answer:</span>
                          <span className="text-sm">{openEndedAnswers[content.id]?.[currentProblemIndex] || 'No answer'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Score:</span>
                          <span className="text-sm font-semibold">
                            {getProblemScore(currentProblemIndex)} / {currentProblem.points || 1} points
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentProblemIndex(Math.max(0, currentProblemIndex - 1))}
            disabled={currentProblemIndex === 0}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentProblemIndex(Math.min(problems.length - 1, currentProblemIndex + 1))}
            disabled={currentProblemIndex === problems.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentDetailPage;
