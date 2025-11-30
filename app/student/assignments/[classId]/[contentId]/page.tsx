"use client"

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/components/ui/use-toast';
import { storage } from '@/lib/storage';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckSquare, LayoutDashboard, Book, File, Cog, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Problem {
  id?: string;
  question: string;
  type: string;
  options?: string[];
  correctAnswer?: string | number;
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

const AssignmentDetailPage: React.FC = () => {
  const params = useParams<{ classId: string; contentId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [problemScores, setProblemScores] = useState<Record<number, number>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [problemStatuses, setProblemStatuses] = useState<Record<number, 'correct' | 'incorrect' | 'pending'>>({});

  const classId = params.classId;
  const contentId = params.contentId;

  useEffect(() => {
    if (classId && contentId) {
      loadAssignment();
      loadScores();
    }
  }, [classId, contentId]);

  const loadAssignment = async () => {
    try {
      const curriculum = await storage.getCurriculum(classId, 'student');
      if (curriculum && curriculum.content && curriculum.content.lessons) {
        for (const lesson of curriculum.content.lessons) {
          const lessonAny = lesson as any;
          if (lessonAny.contents && Array.isArray(lessonAny.contents)) {
            const foundContent = lessonAny.contents.find((c: any) => c.id === contentId);
            if (foundContent) {
              setContent(foundContent);
              break;
            }
          }
        }
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

  const loadScores = async () => {
    if (!db || !user || !classId || !contentId) return;

    try {
      const answersRef = collection(db, 'student-answers', classId, 'answers');
      const q = query(
        answersRef,
        where('studentId', '==', user.uid),
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

      setProblemScores(scores);
      setTotalScore(total);
      setProblemStatuses(statuses);
    } catch (error) {
      console.error('Error loading scores:', error);
    }
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
        <Sidebar navigation={navigation} user={user ? { id: user.uid, name: user.displayName || 'Student', email: user.email || '', role: 'student' } : undefined} />
        <div className="flex-1 p-8 pt-6 overflow-y-auto max-h-screen">
          <p>Loading assignment...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex min-h-screen">
        <Sidebar navigation={navigation} user={user ? { id: user.uid, name: user.displayName || 'Student', email: user.email || '', role: 'student' } : undefined} />
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

  return (
    <div className="flex min-h-screen">
      <Sidebar navigation={navigation} user={user ? { id: user.uid, name: user.displayName || 'Student', email: user.email || '', role: 'student' } : undefined} />
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

        {/* Score Display */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your Score</p>
              <p className="text-4xl font-bold">{percentage}</p>
            </div>
            <div className="w-32 h-32 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-50">
              <span className="text-2xl font-bold text-green-700">{percentage}</span>
            </div>
          </div>
        </div>

        {/* Problem Boxes Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Problems</h2>
          <div className="grid grid-cols-5 gap-4">
            {problems.map((problem, index) => {
              const status = problemStatuses[index] || 'pending';
              const score = problemScores[index] || 0;
              const isCorrect = status === 'correct';
              
              return (
                <button
                  key={index}
                  onClick={() => setCurrentProblemIndex(index)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    ${currentProblemIndex === index ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                    ${isCorrect ? 'bg-green-50 border-green-300' : status === 'incorrect' ? 'bg-red-50 border-red-300' : 'bg-white'}
                    hover:shadow-md
                  `}
                >
                  {isCorrect && (
                    <div className="absolute top-1 left-1">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {String.fromCharCode(97 + index)} {/* a, b, c, etc. */}
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

        {/* Current Problem View */}
        {problems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Problem {currentProblemIndex + 1}</CardTitle>
              <CardDescription>
                {problems[currentProblemIndex].question}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Points: {problems[currentProblemIndex].points || 1}
                </p>
                {problemScores[currentProblemIndex] !== undefined && (
                  <div>
                    <Badge variant={problemStatuses[currentProblemIndex] === 'correct' ? 'default' : 'destructive'}>
                      Score: {problemScores[currentProblemIndex]}/{problems[currentProblemIndex].points || 1}
                    </Badge>
                  </div>
                )}
                <Button asChild>
                  <Link href={`/student/curriculum/${classId}?content=${contentId}&problem=${currentProblemIndex}`}>
                    View Problem
                  </Link>
                </Button>
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
