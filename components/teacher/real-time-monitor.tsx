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
import { ref, onValue, off, get } from "firebase/database"
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
import { useToast } from "@/hooks/use-toast"
import { Progress } from "@/components/ui/progress"

interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'not-started' | 'in-progress' | 'completed';
}

interface RealTimeUpdate {
  studentId: string;
  studentName: string;
  problemId: string;
  answer: string;
  timestamp: number;
  status: 'in-progress' | 'completed';
  score?: number;
}

interface Problem {
  id: string;
  type: string;
  question: string;
  points: number;
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
export function RealTimeMonitor({ classId, contentId }: RealTimeMonitorProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [realTimeUpdates, setRealTimeUpdates] = useState<RealTimeUpdate[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!classId) {
      setError("Missing class ID for real-time monitoring");
      setIsLoading(false);
      return;
    }

    if (!contentId) {
      setError("Missing content ID for real-time monitoring");
      setIsLoading(false);
      return;
    }

    console.log('Setting up real-time monitoring with:', { classId, contentId });

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load students
        const studentsRef = ref(realtimeDb, `users`);
        const studentsSnapshot = await get(studentsRef);
        const studentsData = studentsSnapshot.val() || {};
        const enrolledStudents = Object.entries(studentsData)
          .filter(([_, user]: [string, any]) => user.role === 'student')
          .map(([id, user]: [string, any]) => ({
            id,
            name: user.name || 'Unknown Student',
            email: user.email || '',
            avatar: user.avatar || '',
            status: 'not-started' as const
          }));
        setStudents(enrolledStudents);

        // Load problems
        const contentRef = ref(realtimeDb, `curriculum/${classId}/content/${contentId}`);
        const contentSnapshot = await get(contentRef);
        const contentData = contentSnapshot.val();
        if (contentData && contentData.problems) {
          setProblems(contentData.problems);
        }

        // Set up real-time listeners
        const progressRef = ref(realtimeDb, `student-progress/${classId}/${contentId}`);
        console.log('Setting up real-time listener at:', `student-progress/${classId}/${contentId}`);
        
        onValue(progressRef, (snapshot) => {
          const progressData = snapshot.val() || {};
          console.log('Received progress data:', progressData);
          
          const updates: RealTimeUpdate[] = [];

          Object.entries(progressData).forEach(([studentId, data]: [string, any]) => {
            if (data.problems) {
              Object.entries(data.problems).forEach(([problemId, problemData]: [string, any]) => {
                updates.push({
                  studentId,
                  studentName: students.find(s => s.id === studentId)?.name || 'Unknown Student',
                  problemId,
                  answer: problemData.answer || '',
                  timestamp: problemData.timestamp || Date.now(),
                  status: problemData.status || 'in-progress',
                  score: problemData.score || 0
                });
              });
            }
          });

          console.log('Processed updates:', updates);
          setRealTimeUpdates(updates);
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading real-time monitor data:', error);
        setError('Failed to load real-time monitoring data');
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Failed to load real-time monitoring data. Please try again.",
          variant: "destructive",
        });
      }
    };

    loadInitialData();

    // Cleanup function
    return () => {
      const progressRef = ref(realtimeDb, `student-progress/${classId}/${contentId}`);
      off(progressRef);
    };
  }, [classId, contentId, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <p>Loading real-time monitoring data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <CardDescription>Total enrolled students</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{students.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Real-time Updates</CardTitle>
            <CardDescription>Latest student responses</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{realTimeUpdates.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Problems</CardTitle>
            <CardDescription>Total problems in this content</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{problems.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Progress</CardTitle>
          <CardDescription>Real-time updates from students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {students.map((student) => {
              const studentUpdates = realTimeUpdates.filter(update => update.studentId === student.id);
              const completedProblems = studentUpdates.filter(update => update.status === 'completed').length;
              const progress = (completedProblems / problems.length) * 100;

              return (
                <div key={student.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {student.avatar ? (
                        <img
                          src={student.avatar}
                          alt={student.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {student.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <Badge variant={progress === 100 ? "default" : progress > 0 ? "secondary" : "outline"}>
                      {progress === 100 ? "Completed" : progress > 0 ? "In Progress" : "Not Started"}
                    </Badge>
                  </div>
                  <Progress value={progress} className="mt-2" />
                  <div className="mt-2 text-sm text-muted-foreground">
                    {completedProblems} of {problems.length} problems completed
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Updates</CardTitle>
          <CardDescription>Most recent student responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {realTimeUpdates
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 10)
              .map((update, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{update.studentName}</p>
                      <p className="text-sm text-muted-foreground">
                        Problem {update.problemId.replace('problem-', '')}
                      </p>
                    </div>
                    <Badge variant={update.status === 'completed' ? "default" : "secondary"}>
                      {update.status === 'completed' ? "Completed" : "In Progress"}
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm">Answer: {update.answer}</p>
                    {update.score !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Score: {update.score}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(update.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 