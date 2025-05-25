"use client"

import React from 'react'
import { useState, useEffect } from "react"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { realtimeDb } from "@/lib/firebase"
import { ref, onValue, off } from "firebase/database"
import { formatDistance } from "date-fns"
import {
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Activity,
  Users
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

interface Answer {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatar: string;
  questionId: string;
  questionText: string;
  answer: string;
  answerType: string;
  timestamp: number;
  correct: boolean;
  partialCredit: number;
  problemType: string;
  problemPoints: number;
  classId: string;
  contentId: string;
  contentTitle: string;
  status: string;
  score: number;
  problemIndex: number;
}

interface RealTimeMonitorProps {
  classId: string
  contentId?: string
  recentOnly?: boolean
  limitEntries?: number
  showAllStudents?: boolean
}

// Add error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('RealTimeMonitor error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Real-Time Monitoring
            </CardTitle>
            <CardDescription>
              Error loading real-time data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center text-center py-6">
              <AlertCircle className="w-10 h-10 mb-2 text-destructive" />
              <p>Unable to load real-time data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please try refreshing the page
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Wrap the RealTimeMonitor component with the error boundary
export function RealTimeMonitor(props: RealTimeMonitorProps) {
  return (
    <ErrorBoundary>
      <RealTimeMonitorContent {...props} />
    </ErrorBoundary>
  );
}

// Rename the original component to RealTimeMonitorContent
function RealTimeMonitorContent({
  classId,
  contentId,
  recentOnly = false,
  limitEntries = 20,
  showAllStudents = false
}: RealTimeMonitorProps) {
  const [realtimeAnswers, setRealtimeAnswers] = useState<Answer[]>([]);
  const [activeStudents, setActiveStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId || !contentId) {
      console.error('Missing required IDs for real-time monitoring');
      return;
    }

    console.log('Setting up real-time listener for:', { classId, contentId });

    // Set up real-time listener for student answers
    const answersRef = ref(realtimeDb, `student-answers/${classId}/${contentId}`);
    const progressRef = ref(realtimeDb, `student-progress/${classId}/${contentId}`);
    
    console.log('Listening to paths:', {
      answers: `student-answers/${classId}/${contentId}`,
      progress: `student-progress/${classId}/${contentId}`
    });

    // Listen to both paths
    const unsubscribeAnswers = onValue(answersRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log('Received real-time answers data:', data);

        if (!data) {
          console.log('No student answers found');
          return;
        }

        processStudentData(data);
      } catch (error) {
        console.error('Error processing real-time answers:', error);
      }
    });

    const unsubscribeProgress = onValue(progressRef, (snapshot) => {
      try {
        const data = snapshot.val();
        console.log('Received real-time progress data:', data);

        if (!data) {
          console.log('No student progress found');
          return;
        }

        processStudentData(data);
      } catch (error) {
        console.error('Error processing real-time progress:', error);
      }
    });

    // Helper function to process student data
    const processStudentData = (data: any) => {
      try {
        // Process student answers
        const processedAnswers: Answer[] = [];
        const studentSet = new Set<string>();

        // Iterate through each student's answers
        Object.entries(data).forEach(([studentId, studentData]: [string, any]) => {
          console.log('Processing student data:', { studentId, studentData });
          
          if (!studentData?.problems) {
            console.warn(`No problems found for student ${studentId}`);
            return;
          }

          // Process each problem answer
          Object.entries(studentData.problems).forEach(([problemKey, problemData]: [string, any]) => {
            if (!problemData) {
              console.warn(`No data found for problem ${problemKey}`);
              return;
            }

            // Extract problem index from the key (e.g., "problem-0" -> 0)
            const problemIndex = parseInt(problemKey.replace('problem-', ''), 10);
            if (isNaN(problemIndex)) {
              console.warn(`Invalid problem index in key ${problemKey}`);
              return;
            }

            // Create answer object
            const answer: Answer = {
              id: `${studentId}-${problemKey}`,
              studentId: studentId,
              studentName: problemData.studentName || 'Unknown Student',
              studentEmail: problemData.studentEmail || '',
              studentAvatar: problemData.studentAvatar || '',
              questionId: problemData.questionId || problemKey,
              questionText: problemData.questionText || 'Question not available',
              answer: problemData.answer || '',
              answerType: problemData.answerType || 'unknown',
              timestamp: problemData.timestamp || Date.now(),
              correct: problemData.correct || false,
              partialCredit: problemData.partialCredit || 0,
              problemType: problemData.problemType || 'unknown',
              problemPoints: problemData.problemPoints || 1,
              classId: classId,
              contentId: contentId,
              contentTitle: problemData.contentTitle || 'Untitled Content',
              status: problemData.status || 'in-progress',
              score: problemData.score || 0,
              problemIndex: problemIndex
            };

            processedAnswers.push(answer);
            studentSet.add(studentId);
          });
        });

        // Filter and sort answers
        let filteredAnswers = processedAnswers.filter(answer => {
          const matchesSearch = searchTerm === '' || 
            answer.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            answer.answer.toLowerCase().includes(searchTerm.toLowerCase());
          
          const matchesFilter = filter === 'all' ||
            (filter === 'correct' && answer.correct) ||
            (filter === 'incorrect' && !answer.correct) ||
            (filter === 'pending' && answer.status === 'in-progress');
          
          return matchesSearch && matchesFilter;
        });

        // Sort by timestamp (newest first)
        filteredAnswers.sort((a, b) => b.timestamp - a.timestamp);

        // Limit to maxAnswers
        const maxAnswers = limitEntries > 0 ? filteredAnswers.slice(0, limitEntries) : filteredAnswers;

        setRealtimeAnswers(maxAnswers);
        setActiveStudents(new Set(Array.from(studentSet)));
        setLoading(false);
        console.log('Processed answers:', maxAnswers);
      } catch (error) {
        console.error('Error processing student data:', error);
        setError('Error processing student data');
        setLoading(false);
        toast({
          title: "Error",
          description: "There was a problem processing student answers.",
          variant: "destructive",
        });
      }
    };

    return () => {
      console.log('Cleaning up real-time listeners');
      unsubscribeAnswers();
      unsubscribeProgress();
    };
  }, [classId, contentId, searchTerm, filter, limitEntries]);

  // Helper function to format answer display based on type
  const formatAnswer = (answer: Answer) => {
    if (!answer) return 'No answer provided';
    
    switch (answer.answerType) {
      case 'multiple-choice':
        return `Option: ${answer.answer || 'No option selected'}`;
      case 'math-expression':
        return `Expression: ${answer.answer || 'No expression entered'}`;
      case 'open-ended':
        return (answer.answer || 'No answer provided').length > 100 
          ? `${(answer.answer || 'No answer provided').substring(0, 100)}...` 
          : (answer.answer || 'No answer provided');
      default:
        return answer.answer || 'No answer provided';
    }
  };

  // Render a status badge based on correctness
  const getStatusBadge = (answer: Answer) => {
    if (!answer) return null;
    
    if (answer.correct === true) {
      return <Badge variant="default" className="flex items-center"><CheckCircle className="w-3 h-3 mr-1" /> Correct</Badge>;
    } else if (answer.correct === false) {
      if (answer.partialCredit && answer.partialCredit > 0) {
        return <Badge variant="secondary" className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Partial Credit</Badge>;
      } else {
        return <Badge variant="destructive" className="flex items-center"><XCircle className="w-3 h-3 mr-1" /> Incorrect</Badge>;
      }
    } else {
      return <Badge variant="outline" className="flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-Time Monitoring
          </CardTitle>
          <CardDescription>
            Loading student activity...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <div className="animate-pulse w-full max-w-md">
              <div className="h-4 bg-slate-200 rounded mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded mb-3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-Time Monitoring
          </CardTitle>
          <CardDescription>
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center py-6">
            <AlertCircle className="w-10 h-10 mb-2 text-destructive" />
            <p>Unable to load real-time data</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try refreshing the page
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Activity className="w-5 h-5 mr-2" />
          Real-Time Student Activity
        </CardTitle>
        <CardDescription className="flex items-center">
          <Users className="w-4 h-4 mr-1" />
          {activeStudents.size} active students | {realtimeAnswers.length} responses
        </CardDescription>
        <div className="flex items-center space-x-4 mt-4">
          <Input
            placeholder="Search students or answers..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter answers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Answers</SelectItem>
              <SelectItem value="correct">Correct Answers</SelectItem>
              <SelectItem value="incorrect">Incorrect Answers</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {realtimeAnswers.length > 0 ? (
          <div className="space-y-4">
            {realtimeAnswers.map((answer, index) => (
              <div key={`${answer.studentId}-${answer.questionId}-${index}`} className="flex items-start space-x-3 p-3 border rounded-lg">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={answer.studentAvatar || ""} />
                  <AvatarFallback>
                    {answer.studentName ? answer.studentName.charAt(0).toUpperCase() : "S"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{answer.studentName || 'Unknown Student'}</p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDistance(answer.timestamp || Date.now(), Date.now(), { addSuffix: true })}
                      </span>
                      {getStatusBadge(answer)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{answer.questionText || 'Question not available'}</p>
                  <p className="text-sm">{formatAnswer(answer)}</p>
                  {answer.partialCredit !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Partial Credit: {answer.partialCredit}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <Activity className="w-10 h-10 mb-2 text-muted-foreground" />
            <p>No student activity recorded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Student answers will appear here in real-time as they work on assignments
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 