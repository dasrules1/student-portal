"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileText,
  Upload,
  CheckCircle2,
  BookOpen,
  PenTool,
  ClipboardList,
  BookMarked,
  FileQuestion,
  X,
  Users,
  BarChart,
  Clock,
  AlertCircle,
  Edit,
  Save,
  Check,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { storage } from "@/lib/storage"
import { sessionManager } from "@/lib/session"
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { RealTimeMonitor } from "@/components/teacher/real-time-monitor"

// Add interface definitions for types
interface Class {
  id: string;
  name: string;
  teacher: string;
  teacher_id?: string;
  enrolledStudents?: string[];
  curriculum?: {
    lessons: {
      id: string;
      title: string;
      description?: string;
      resources?: {
        id: string;
        title: string;
        type: string;
        url?: string;
        content?: string;
      }[];
    }[];
    assignments?: {
      id: string;
      title: string;
      description?: string;
      dueDate?: string;
      points?: number;
    }[];
  };
}

interface SessionUser {
  user: {
    uid?: string;
    id?: string;
    displayName?: string;
    name?: string;
    [key: string]: any;
  } | null;
  role: string | null;
  [key: string]: any;
}

interface User {
  id: string;
  name: string;
  role: string;
  classes: string[];
  [key: string]: any; // For other properties
}

interface Curriculum {
  lessons: {
    id: string;
    title: string;
    description?: string;
    contents: {
      id: string;
      title: string;
      type: string;
      content?: string;
      problems?: {
        id: string;
        question: string;
        type: string;
        points: number;
        options?: string[];
        correctAnswer?: string;
      }[];
      studentProgress?: {
        submissions: {
          studentId: string;
          problemResults: {
            type: string;
            correct: boolean;
            points: number;
            maxPoints: number;
            studentAnswer: string;
            timestamp: Date;
          }[];
          score: number;
          status: string;
          submittedAt: Date;
          lastUpdated: Date;
        }[];
      };
    }[];
  }[];
}

interface StudentAnswer {
  id: string;
  answer: string;
  score: number;
  correct: boolean;
  timestamp: Date;
  studentId: string;
  contentId: string;
  problemIndex: string;
}

interface StudentAnswers {
  [key: string]: StudentAnswer;
}

interface RealTimeUpdates {
  [studentId: string]: StudentAnswers;
}

// Content types for curriculum
const contentTypes = [
  { id: "new-material", name: "New Material", icon: <BookOpen className="w-4 h-4 mr-2" /> },
  { id: "guided-practice", name: "Guided Practice", icon: <PenTool className="w-4 h-4 mr-2" /> },
  { id: "classwork", name: "Classwork", icon: <ClipboardList className="w-4 h-4 mr-2" /> },
  { id: "homework", name: "Homework", icon: <BookMarked className="w-4 h-4 mr-2" /> },
  { id: "quiz", name: "Quiz", icon: <FileQuestion className="w-4 h-4 mr-2" /> },
  { id: "test", name: "Test", icon: <FileText className="w-4 h-4 mr-2" /> },
]

export default function TeacherCurriculum() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string

  const [currentClass, setCurrentClass] = useState<Class | null>(null)
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [activeLesson, setActiveLesson] = useState(1)
  const [activeContent, setActiveContent] = useState<any>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [contentToPublish, setContentToPublish] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("content")
  const [studentFeedback, setStudentFeedback] = useState<Record<string, any>>({})
  const [gradeOverrideDialogOpen, setGradeOverrideDialogOpen] = useState(false)
  const [studentToGrade, setStudentToGrade] = useState<any>(null)
  const [overrideScore, setOverrideScore] = useState("")
  const [overrideFeedback, setOverrideFeedback] = useState("")
  const [halfCredit, setHalfCredit] = useState(false)
  const [manualGradingDialogOpen, setManualGradingDialogOpen] = useState(false)
  const [studentSubmission, setStudentSubmission] = useState<any>(null)
  const [problemGrades, setProblemGrades] = useState<Record<string, any>>({})
  const [students, setStudents] = useState<User[]>([])
  const [studentProgress, setStudentProgress] = useState<Record<string, any>>({})
  const [realTimeUpdates, setRealTimeUpdates] = useState<Record<string, any>>({})

  // Load class and curriculum data
  useEffect(() => {
    // Check if user is a teacher
    const user = sessionManager.getCurrentUser() as SessionUser;
    if (!user || user.role !== "teacher") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a teacher to view this page",
        variant: "destructive",
      })
      router.push("/staff-portal")
      return
    }

    const loadData = async () => {
      try {
        // Get class data
        const foundClass = await storage.getClassById(classId)
        if (!foundClass) {
          toast({
            title: "Class not found",
            description: "The requested class could not be found.",
            variant: "destructive",
          })
          router.push("/teacher/dashboard")
          return
        }

        setCurrentClass(foundClass as Class)

        // Check if this teacher is assigned to this class
        const teacherName = user.user?.displayName || user.user?.name || "";
        const teacherId = user.user?.uid || user.user?.id || "";
        
        if (foundClass.teacher !== teacherName && foundClass.teacher_id !== teacherId) {
          toast({
            title: "Access denied",
            description: "You are not assigned to this class",
            variant: "destructive",
          })
          router.push("/teacher/dashboard")
          return
        }

        // Get curriculum data
        const curriculumData = await storage.getCurriculum(classId)
        if (curriculumData) {
          setCurriculum(curriculumData.content as Curriculum)
        }

        // Get enrolled students
        const allUsers = await storage.getUsers()
        const enrolledStudents = allUsers.filter(
          (user) => user.role === "student" && 
          (user.classes.includes(classId) || 
           (foundClass.enrolledStudents && foundClass.enrolledStudents.includes(user.id)))
        )
        setStudents(enrolledStudents)

        // Set up real-time listener for student answers
        const answersRef = collection(db, 'student-answers', classId, 'answers');
        const q = query(answersRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const newAnswers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as StudentAnswer[];
          
          // Update student progress with new answers
          const updatedProgress = { ...studentProgress };
          newAnswers.forEach((answer: StudentAnswer) => {
            const [studentId, contentId, problemIndex] = answer.id.split('_');
            if (!updatedProgress[studentId]) {
              updatedProgress[studentId] = {};
            }
            if (!updatedProgress[studentId][contentId]) {
              updatedProgress[studentId][contentId] = {};
            }
            updatedProgress[studentId][contentId][problemIndex] = answer;
          });
          setStudentProgress(updatedProgress);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load class data. Please try again.",
          variant: "destructive",
        });
      }
    };

    loadData()
  }, [classId, router, toast])

  // Update the real-time listener for submissions
  useEffect(() => {
    if (!classId) return;

    // Create a query for submissions in this class
    const submissionsQuery = query(
      collection(db, 'student-answers'),
      where('classId', '==', classId)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      try {
        const submissions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Update the curriculum state with the new submissions
        setCurriculum((prevCurriculum: Curriculum | null) => {
          if (!prevCurriculum) return prevCurriculum;
          
          const updatedCurriculum = { ...prevCurriculum };
          submissions.forEach(submission => {
            const lessonIndex = updatedCurriculum.lessons.findIndex(
              lesson => lesson.id === submission.lessonId
            );
            
            if (lessonIndex !== -1) {
              const contentIndex = updatedCurriculum.lessons[lessonIndex].contents.findIndex(
                content => content.id === submission.contentId
              );
              
              if (contentIndex !== -1) {
                const content = updatedCurriculum.lessons[lessonIndex].contents[contentIndex];
                const existingSubmissions = content.studentProgress?.submissions || [];
                const submissionIndex = existingSubmissions.findIndex(
                  sub => sub.studentId === submission.studentId
                );
                
                if (submissionIndex !== -1) {
                  existingSubmissions[submissionIndex] = submission;
                } else {
                  existingSubmissions.push(submission);
                }
                
                updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.submissions = existingSubmissions;
                
                // Show notification for new submissions
                const student = students.find(s => s.id === submission.studentId);
                if (student) {
                  toast({
                    title: "New Submission",
                    description: `${student.name} has submitted their work for ${content.title}`,
                    duration: 5000,
                  });
                }
              }
            }
          });
          
          return updatedCurriculum;
        });
      } catch (error) {
        console.error("Error processing real-time data:", error);
      }
    });

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
    };
  }, [classId, students]);

  // Update the real-time listener for student answers
  useEffect(() => {
    if (!activeContent?.id || !classId) return;

    console.log("Setting up real-time listener for content:", activeContent.id);

    // Create a query for student answers using the new nested path structure
    const answersQuery = query(
      collection(db, `student-answers/${classId}/answers`),
      where('contentId', '==', activeContent.id)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(answersQuery, (snapshot) => {
      try {
        const transformedData = snapshot.docs.reduce((acc: Record<string, any>, doc) => {
          const data = doc.data();
          const studentId = data.studentId;
          
          if (!acc[studentId]) {
            acc[studentId] = {};
          }
          
          acc[studentId][`problem-${data.problemIndex}`] = {
            answer: data.answer || 'No answer provided',
            score: data.score || 0,
            correct: data.correct || false,
            timestamp: data.timestamp?.toDate() || new Date()
          };
          
          return acc;
        }, {});

        console.log("Transformed data:", transformedData);
        setRealTimeUpdates(transformedData);
      } catch (error) {
        console.error("Error processing real-time data:", error);
      }
    });

    return () => unsubscribe();
  }, [activeContent?.id, classId]);

  // Function to render LaTeX in the UI
  const renderLatex = (text) => {
    if (!text) return ""

    // Simple regex to identify LaTeX-like content between $$ delimiters
    const parts = text.split(/(\$\$.*?\$\$)/g)

    if (parts.length === 1) return text

    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith("$$") && part.endsWith("$$")) {
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

  // Handle publishing content
  const handlePublishContent = (content, lessonIndex, contentIndex) => {
    setContentToPublish({ content, lessonIndex, contentIndex })
    setPublishDialogOpen(true)
  }

  // Confirm publishing content
  const confirmPublish = async () => {
    if (!contentToPublish) return

    const { content, lessonIndex, contentIndex } = contentToPublish
    const updatedCurriculum = { ...curriculum }

    // Toggle published status
    const newPublishedStatus = !content.isPublished
    updatedCurriculum.lessons[lessonIndex].contents[contentIndex].isPublished = newPublishedStatus

    // Ensure we're explicitly preserving problem data with correct answers
    if (updatedCurriculum.lessons[lessonIndex].contents[contentIndex].problems) {
      // Make sure we keep a deep copy of problems with correctAnswer fields intact
      const problems = updatedCurriculum.lessons[lessonIndex].contents[contentIndex].problems;
      if (Array.isArray(problems)) {
        updatedCurriculum.lessons[lessonIndex].contents[contentIndex].problems = problems.map(problem => {
          // Ensure we preserve the correctAnswer field
          const preservedProblem = { ...problem };
          console.log(`Preserving problem with ${preservedProblem.correctAnswer ? 'correct answer' : 'no correct answer'}`);
          return preservedProblem;
        });
      }
    }

    // Add explicit debugging
    console.log(`Publishing status for ${content.title}: ${newPublishedStatus}`);
    console.log(`Content after toggle:`, JSON.stringify(updatedCurriculum.lessons[lessonIndex].contents[contentIndex]).substring(0, 200));

    // Get the current lesson
    const currentLesson = updatedCurriculum.lessons[lessonIndex];
    
    // 1. Save to Firebase/Firestore directly using the curriculum API
    try {
      // Structure for saving to curriculum
      const curriculumData = {
        classId,
        content: updatedCurriculum,
        lastUpdated: new Date().toISOString()
      };
      
      // Save the entire curriculum to ensure it's properly stored
      console.log("Saving curriculum to storage...");
      const saveCurriculumResult = await storage.saveCurriculum(classId, curriculumData);
      
      if (!saveCurriculumResult) {
        console.error("Failed to save curriculum to primary storage");
        toast({
          title: "Save Error", 
          description: "There was a problem saving the curriculum changes. Please try again.",
          variant: "destructive"
        });
        setPublishDialogOpen(false);
        return;
      }
      
      // ENHANCED: Save the specific content as a separate published item for easier discovery
      if (newPublishedStatus) {
        try {
          // Create a special collection for easily finding all published assignments
          // This makes it easier for students to find published assignments
          const publishedAssignmentRef = doc(db, 'published_assignments', `${classId}_${content.id}`);
          
          await setDoc(publishedAssignmentRef, {
            contentId: content.id,
            classId: classId,
            className: currentClass?.name || 'Class',
            lessonId: currentLesson.id,
            lessonTitle: currentLesson.title,
            title: content.title,
            description: content.description || '',
            type: content.type || 'assignment',
            dueDate: content.dueDate || null,
            points: content.points || 0,
            problems: content.problems || [],
            isPublished: true,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          console.log("Successfully saved to published_assignments collection for easier discovery");
        } catch (assignmentPublishError) {
          console.error("Error saving to published_assignments collection:", assignmentPublishError);
        }
        
        // Use the imported db directly to save to the published_curricula collection
        try {
          const publishedRef = doc(db, 'published_curricula', classId);
          
          // Create a direct published format with the explicit published flag for each item
          const publishedContent = {
            classId,
            content: {
              lessons: updatedCurriculum.lessons.map(lesson => ({
                ...lesson,
                contents: lesson.contents.map(item => ({
                  ...item,
                  isPublished: !!item.isPublished // Ensure boolean true/false
                }))
              }))
            },
            lastUpdated: new Date().toISOString()
          };
          
          await setDoc(publishedRef, publishedContent);
          console.log("Successfully saved to published_curricula collection");
        } catch (publishError) {
          console.error("Error saving to published curricula collection:", publishError);
        }
      } else {
        // If we're unpublishing, delete from the published_assignments collection
        try {
          const publishedAssignmentRef = doc(db, 'published_assignments', `${classId}_${content.id}`);
          await deleteDoc(publishedAssignmentRef);
          console.log("Removed from published_assignments collection");
        } catch (unpublishError) {
          console.error("Error removing from published_assignments collection:", unpublishError);
        }
      }
    } catch (saveError) {
      console.error("Error saving curriculum:", saveError);
    }

    // 2. Save to localStorage as backup using multiple formats to ensure compatibility
    if (typeof window !== "undefined") {
      try {
        // Save the complete curriculum with published state
        localStorage.setItem(`curriculum_${classId}`, JSON.stringify(updatedCurriculum));
        console.log("Saved complete curriculum to localStorage");
        
        // Create and save a dedicated published version that only includes published content
        const publishedLessons = updatedCurriculum.lessons.map(lesson => {
          // Create a copy of the lesson with only published contents
          return {
            ...lesson,
            contents: lesson.contents
              .filter(item => item.isPublished === true)
              .map(item => ({...item, isPublished: true})) // Explicitly set flag
          };
        }).filter(lesson => lesson.contents && lesson.contents.length > 0);
        
        // 2a. Save as a standard curriculum structure
        const publishedCurriculum = {
          lessons: publishedLessons
        };
        
        localStorage.setItem(`published-curriculum-${classId}`, JSON.stringify(publishedCurriculum));
        console.log(`Saved published curriculum to localStorage for class ${classId}`);
        
        // 2b. Also save as a direct published content array for simpler consumption
        const publishedContents = [];
        publishedLessons.forEach(lesson => {
          lesson.contents.forEach(content => {
            publishedContents.push({
              ...content,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              classId: classId,
              className: currentClass?.name || 'Class'
            });
          });
        });
        
        localStorage.setItem(`published-contents-${classId}`, JSON.stringify(publishedContents));
        console.log(`Saved ${publishedContents.length} flattened published contents to localStorage`);
        
        // ENHANCED: Save individual content directly with improved naming
        // This makes it much easier for students to find it
        if (content.type === 'assignment' || content.type === 'quiz') {
          const assignmentKey = `assignment-${classId}-${content.id}`;
          
          const assignmentData = {
            ...content,
            isPublished: newPublishedStatus,
            classId: classId,
            className: currentClass?.name || 'Class',
            lessonId: currentLesson.id,
            lessonTitle: currentLesson.title,
            updatedAt: new Date().toISOString()
          };
          
          if (newPublishedStatus) {
            localStorage.setItem(assignmentKey, JSON.stringify(assignmentData));
            console.log(`Saved individual assignment to localStorage with key ${assignmentKey}`);
          } else {
            localStorage.removeItem(assignmentKey);
            console.log(`Removed unpublished assignment from localStorage with key ${assignmentKey}`);
          }
        }
        
        // 2c. For backwards compatibility, also save in the legacy indexed format
        let legacyFormat = {};
        
        updatedCurriculum.lessons.forEach((lesson, lIdx) => {
          lesson.contents.forEach((item, cIdx) => {
            if (item.isPublished) {
              if (!legacyFormat[lIdx]) {
                legacyFormat[lIdx] = {};
              }
              
              legacyFormat[lIdx][cIdx] = {
                ...item,
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                isPublished: true,
                classId: classId,
                className: currentClass?.name || 'Class'
              };
            }
          });
        });
        
        localStorage.setItem(`published-curriculum-${classId}-legacy`, JSON.stringify(legacyFormat));
        console.log(`Saved legacy format to localStorage`);
      } catch (error) {
        console.error("Error saving published curriculum to localStorage:", error);
      }
    }

    // 3. Update the curriculum in the component state
    setCurriculum(updatedCurriculum);
    setPublishDialogOpen(false);

    // 4. Update the class in storage to maintain consistency
    if (currentClass) {
      try {
        const updatedClass = {
          ...currentClass,
          curriculum: updatedCurriculum,
        };
        await storage.updateClass(classId, updatedClass);
      } catch (updateError) {
        console.error("Error updating class with curriculum:", updateError);
      }
    }

    toast({
      title: newPublishedStatus ? "Content published" : "Content unpublished",
      description: newPublishedStatus
        ? `${content.title} is now visible to students.`
        : `${content.title} is now hidden from students.`,
    });

    // Add activity log
    storage.addActivityLog({
      action: newPublishedStatus ? "Content Published" : "Content Unpublished",
      details: `${content.title} for ${currentClass?.name}`,
      timestamp: new Date().toLocaleString(),
      category: "Class Management",
    });
  }

  // Handle grade override
  const handleGradeOverride = (student, content) => {
    setStudentToGrade(student)

    // Find the student's current score if available
    const studentSubmission = content.studentProgress?.submissions?.find((sub) => sub.studentId === student.id)

    if (studentSubmission && studentSubmission.score !== undefined) {
      setOverrideScore(studentSubmission.score.toString())
    } else {
      setOverrideScore("")
    }

    // Set feedback if available
    setOverrideFeedback(studentSubmission?.feedback || "")

    setGradeOverrideDialogOpen(true)
    setHalfCredit(false) // Reset half credit state when opening the dialog
  }

  // Save grade override
  const saveGradeOverride = () => {
    if (!studentToGrade || !activeContent) return

    let score = Number.parseInt(overrideScore)
    if (isNaN(score) || score < 0 || score > 100) {
      toast({
        title: "Invalid score",
        description: "Please enter a valid score between 0 and 100.",
        variant: "destructive",
      })
      return
    }

    // If half credit is selected, divide the score by 2
    if (halfCredit) {
      score = score / 2
    }

    const updatedCurriculum = { ...curriculum }
    const lessonIndex = activeLesson - 1
    const contentIndex = updatedCurriculum.lessons[lessonIndex].contents.findIndex((c) => c.id === activeContent.id)

    if (contentIndex === -1) return

    // Initialize studentProgress if it doesn't exist
    if (!updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress) {
      updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress = {
        status: "in-progress",
        submissions: [],
      }
    }

    // Find the student's submission
    const submissions = updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.submissions || []
    const studentSubmissionIndex = submissions.findIndex((sub) => sub.studentId === studentToGrade.id)

    if (studentSubmissionIndex >= 0) {
      // Update existing submission
      submissions[studentSubmissionIndex] = {
        ...submissions[studentSubmissionIndex],
        status: "completed",
        score,
        feedback: overrideFeedback,
        gradedBy: "teacher",
        gradedAt: new Date().toISOString(),
      }
    } else {
      // Add new submission
      submissions.push({
        studentId: studentToGrade.id,
        status: "completed",
        score,
        feedback: overrideFeedback,
        gradedBy: "teacher",
        gradedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      })
    }

    updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.submissions = submissions

    // Update the status based on submissions
    const allCompleted = submissions.every((sub) => sub.status === "completed")
    updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.status = allCompleted
      ? "completed"
      : "in-progress"

    // Save the updated curriculum with grades to localStorage
    if (typeof window !== "undefined") {
      try {
        // Save the graded content for this student
        const gradedContentKey = `graded-content-${classId}-${activeContent.id}`
        localStorage.setItem(gradedContentKey, JSON.stringify(submissions))
      } catch (error) {
        console.error("Error saving graded content:", error)
      }
    }

    setCurriculum(updatedCurriculum)
    setGradeOverrideDialogOpen(false)
    setHalfCredit(false)

    // Update the class in storage
    if (currentClass) {
      const updatedClass = {
        ...currentClass,
        curriculum: updatedCurriculum,
      }
      storage.updateClass(classId, updatedClass)
    }

    toast({
      title: "Grade updated",
      description: `${studentToGrade.name}'s grade has been updated to ${score}%.`,
    })

    // Add activity log
    storage.addActivityLog({
      action: "Student Work Graded",
      details: `${studentToGrade.name}'s work on ${activeContent.title} has been graded`,
      timestamp: new Date().toLocaleString(),
      category: "Grading",
    })
  }

  // Open manual grading dialog
  const openManualGrading = (student, content) => {
    setStudentToGrade(student)

    // Find the student's submission
    const submission = content.studentProgress?.submissions?.find((sub) => sub.studentId === student.id)
    setStudentSubmission(submission)

    // Initialize problem grades
    const initialGrades = {}
    if (content.problems && content.problems.length > 0) {
      content.problems.forEach((problem, index) => {
        const problemResult = submission?.problemResults?.[index]
        initialGrades[index] = {
          correct: problemResult?.correct || false,
          points: problemResult?.points || 0,
          maxPoints: problem.points || 10,
          feedback: problemResult?.feedback || "",
        }
      })
    }

    setProblemGrades(initialGrades)
    setManualGradingDialogOpen(true)
  }

  // Save manual grading
  const saveManualGrading = () => {
    if (!studentToGrade || !activeContent) return

    const updatedCurriculum = { ...curriculum }
    const lessonIndex = activeLesson - 1
    const contentIndex = updatedCurriculum.lessons[lessonIndex].contents.findIndex((c) => c.id === activeContent.id)

    if (contentIndex === -1) return

    // Calculate total score based on problem grades
    let totalPoints = 0
    let earnedPoints = 0
    const problemResults = []

    Object.entries(problemGrades).forEach(([index, grade]) => {
      const problem = activeContent.problems[Number.parseInt(index)]
      totalPoints += grade.maxPoints
      earnedPoints += grade.points

      problemResults[Number.parseInt(index)] = {
        type: problem.type,
        correct: grade.correct,
        points: grade.points,
        maxPoints: grade.maxPoints,
        feedback: grade.feedback,
        studentAnswer: studentSubmission?.answers?.[problem.type]?.[index] || "",
        correctAnswer: problem.correctAnswer,
        gradedBy: "teacher",
      }
    })

    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    // Initialize studentProgress if it doesn't exist
    if (!updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress) {
      updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress = {
        status: "in-progress",
        submissions: [],
      }
    }

    // Find the student's submission
    const submissions = updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.submissions || []
    const studentSubmissionIndex = submissions.findIndex((sub) => sub.studentId === studentToGrade.id)

    if (studentSubmissionIndex >= 0) {
      // Update existing submission
      submissions[studentSubmissionIndex] = {
        ...submissions[studentSubmissionIndex],
        status: "completed",
        score,
        problemResults,
        gradedBy: "teacher",
        gradedAt: new Date().toISOString(),
      }
    } else {
      // Add new submission
      submissions.push({
        studentId: studentToGrade.id,
        status: "completed",
        score,
        problemResults,
        gradedBy: "teacher",
        gradedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      })
    }

    updatedCurriculum.lessons[lessonIndex].contents[contentIndex].studentProgress.submissions = submissions

    // Save the updated curriculum with grades to localStorage
    if (typeof window !== "undefined") {
      try {
        // Save the graded content for this student
        const gradedContentKey = `graded-content-${classId}-${activeContent.id}`
        localStorage.setItem(gradedContentKey, JSON.stringify(submissions))
      } catch (error) {
        console.error("Error saving graded content:", error)
      }
    }

    setCurriculum(updatedCurriculum)
    setManualGradingDialogOpen(false)

    // Update the class in storage
    if (currentClass) {
      const updatedClass = {
        ...currentClass,
        curriculum: updatedCurriculum,
      }
      storage.updateClass(classId, updatedClass)
    }

    toast({
      title: "Manual grading saved",
      description: `${studentToGrade.name}'s work has been graded with a score of ${score}%.`,
    })

    // Add activity log
    storage.addActivityLog({
      action: "Manual Grading Completed",
      details: `${studentToGrade.name}'s work on ${activeContent.title} has been manually graded`,
      timestamp: new Date().toLocaleString(),
      category: "Grading",
    })
  }

  // Render content type icon
  const renderContentTypeIcon = (type: string | undefined) => {
    // Always return a valid React element
    if (!type) return <FileText className="w-4 h-4 mr-2" />;
    
    const contentType = contentTypes.find((ct) => ct.id === type);
    if (!contentType || !contentType.icon) return <FileText className="w-4 h-4 mr-2" />;
    
    return contentType.icon;
  }

  // Get student status badge
  const getStudentStatusBadge = (status, score) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="success" className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            {score !== undefined ? `${score}%` : "Completed"}
          </Badge>
        )
      case "in-progress":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case "not-started":
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Started
          </Badge>
        )
    }
  }

  // Calculate class average for a content item
  const calculateClassAverage = (content) => {
    if (!content.studentProgress?.submissions) return null

    const completedSubmissions = content.studentProgress.submissions.filter(
      (sub) => sub.status === "completed" && sub.score !== undefined,
    )

    if (completedSubmissions.length === 0) return null

    const totalScore = completedSubmissions.reduce((sum, sub) => sum + sub.score, 0)
    return Math.round(totalScore / completedSubmissions.length)
  }

  // Add this function near the other rendering functions if it doesn't exist
  const renderProblemWithAnswer = (problem, index) => {
    // Normalize the problem type for consistent checking
    const problemType = problem.type?.toLowerCase();
    
    return (
      <div key={index} className="p-4 mb-4 border rounded-md">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">Question {index + 1}</h4>
          <Badge variant={problemType === 'multiple-choice' ? 'secondary' : 'outline'}>
            {problemType === 'multiple-choice' ? 'Multiple Choice' : 
             problemType === 'short-answer' ? 'Short Answer' : 
             problemType === 'open-ended' ? 'Open Ended' :
             problemType === 'math-expression' ? 'Math Expression' : 'Essay'}
          </Badge>
        </div>
        <p className="mb-2">{problem.question}</p>
        
        {problemType === 'multiple-choice' && problem.options && (
          <div className="mb-2">
            <div className="font-medium text-sm text-gray-500 mb-1">Options:</div>
            <ul className="space-y-1">
              {problem.options.map((option, optIndex) => (
                <li key={optIndex} className="flex items-center">
                  {optIndex === parseInt(problem.correctAnswer) && (
                    <Check className="w-4 h-4 text-green-500 mr-1" />
                  )}
                  <span className={optIndex === parseInt(problem.correctAnswer) ? "font-medium text-green-600" : ""}>
                    {option}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {(problemType === 'short-answer' || problemType === 'essay' || problemType === 'open-ended' || problemType === 'math-expression') && (
          <div className="mb-2">
            <div className="font-medium text-sm text-gray-500 mb-1">Correct Answer:</div>
            <div className="p-2 bg-gray-50 rounded">
              {problem.correctAnswers && problem.correctAnswers.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {problem.correctAnswers.map((answer, i) => (
                    <div key={i}>{answer}</div>
                  ))}
                </div>
              ) : problem.correctAnswer ? (
                problemType === 'math-expression' ? (
                  <span className="font-mono">{problem.correctAnswer}</span>
                ) : (
                  problem.correctAnswer
                )
              ) : (
                'No answer provided'
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Update the StudentProgressTable component
  const StudentProgressTable = () => {
    if (!activeContent?.problems || !Array.isArray(activeContent.problems)) return null;

    console.log("Rendering progress table with data:", {
      students: students.length,
      realTimeUpdates: Object.keys(realTimeUpdates).length,
      problems: activeContent.problems.length
    });

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">Student Progress</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="p-2 text-left">Student</th>
                {activeContent.problems.map((problem, index) => (
                  <th key={index} className="p-2 text-left">
                    Problem {index + 1}
                  </th>
                ))}
                <th className="p-2 text-left">Total Score</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const studentAnswers = realTimeUpdates[student.id] || {};
                const studentProgress = activeContent.studentProgress?.submissions?.find(
                  sub => sub.studentId === student.id
                );
                
                const totalScore = activeContent.problems.reduce((sum, problem, index) => {
                  const answer = studentAnswers[`problem-${index}`];
                  return sum + (answer?.score || 0);
                }, 0);

                return (
                  <tr key={student.id} className="border-b">
                    <td className="p-2">{student.name}</td>
                    {activeContent.problems.map((problem, index) => {
                      const answer = studentAnswers[`problem-${index}`];
                      const problemResult = studentProgress?.problemResults?.[index];
                      
                      return (
                        <td key={index} className="p-2">
                          <div className="flex flex-col">
                            <div className="text-sm">
                              {answer ? (
                                <>
                                  <span className={answer.correct ? "text-green-600" : "text-red-600"}>
                                    {answer.answer || 'No answer'}
                                  </span>
                                  <span className="ml-2">
                                    ({answer.score || 0}/{problem.points || 1})
                                  </span>
                                </>
                              ) : problemResult ? (
                                <>
                                  <span className={problemResult.correct ? "text-green-600" : "text-red-600"}>
                                    {problemResult.studentAnswer || 'No answer'}
                                  </span>
                                  <span className="ml-2">
                                    ({problemResult.points || 0}/{problemResult.maxPoints || 1})
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-500">Not attempted</span>
                              )}
                            </div>
                            {(answer || problemResult) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1"
                                onClick={() => {
                                  setStudentToGrade(student);
                                  setStudentSubmission({
                                    problemIndex: index,
                                    answer: answer?.answer || problemResult?.studentAnswer || '',
                                    currentScore: answer?.score || problemResult?.points || 0,
                                    maxPoints: problem.points || 1
                                  });
                                  setManualGradingDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Grade
                              </Button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 font-semibold">
                      {totalScore}/{activeContent.problems.reduce((sum, p) => sum + (p.points || 1), 0)}
                    </td>
                    <td className="p-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStudentToGrade(student);
                          setGradeOverrideDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Override
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Main render function
  if (!currentClass || !curriculum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading curriculum...</p>
      </div>
    )
  }

  // Ensure curriculum.lessons exists and is an array
  const lessons = curriculum.lessons || [];
  const currentLesson = lessons[activeLesson - 1] || null;
  const lessonContents = currentLesson?.contents || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container py-6">
        {/* Header */}
        <div className="flex flex-col items-start justify-between mb-6 space-y-4 md:flex-row md:items-center md:space-y-0">
          <div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/teacher/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-bold md:text-3xl">{currentClass.name} Curriculum</h1>
            <p className="text-muted-foreground">View and manage the curriculum for this class</p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 md:grid-cols-12">
          {/* Lesson sidebar */}
          <div className="md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Lessons</CardTitle>
                <CardDescription>Curriculum structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {lessons.map((lesson, index) => {
                    if (!lesson) return null;
                    const hasContent = lesson.contents && Array.isArray(lesson.contents) && lesson.contents.length > 0;
                    if (!hasContent) return null;

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
                        {hasContent && (
                          <Badge variant="secondary" className="ml-auto">
                            {lesson.contents.length}
                          </Badge>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content area */}
          <div className="md:col-span-9">
            {!activeContent && currentLesson ? (
              // Lesson overview
              <Card>
                <CardHeader>
                  <CardTitle>
                    Lesson {activeLesson}: {currentLesson.title || `Lesson ${activeLesson}`}
                  </CardTitle>
                  <CardDescription>
                    {currentLesson.description
                      ? renderLatex(currentLesson.description)
                      : "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lessonContents.length > 0 ? (
                      lessonContents.map((content) => {
                        if (!content) return null;
                        return (
                          <Card key={content.id || `content-${Math.random()}`} className="overflow-hidden">
                            <div
                              className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                              onClick={() => setActiveContent(content)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  {renderContentTypeIcon(content.type)}
                                  <div>
                                    <CardTitle className="text-base">{content.title || 'Untitled Content'}</CardTitle>
                                    <p className="text-sm text-muted-foreground">{renderLatex(content.description || '')}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge
                                    variant={content.isPublished ? "success" : "outline"}
                                    className={content.isPublished ? "bg-green-500" : ""}
                                  >
                                    {content.isPublished ? "Published" : "Draft"}
                                  </Badge>
                                  <Button
                                    variant={content.isPublished ? "destructive" : "default"}
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handlePublishContent(
                                        content,
                                        activeLesson - 1,
                                        lessonContents.indexOf(content),
                                      )
                                    }}
                                  >
                                    {content.isPublished ? (
                                      <>
                                        <X className="w-4 h-4 mr-2" />
                                        Unpublish
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Publish
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>

                              {/* Show progress summary if available */}
                              {content.studentProgress && (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="flex justify-between items-center">
                                    <div className="text-sm">
                                      <span className="font-medium">Student Progress:</span>{" "}
                                      {content.studentProgress.submissions?.filter((s) => s.status === "completed")
                                        .length || 0}
                                      {" / "}
                                      {content.studentProgress.submissions?.length || 0}
                                      {" completed"}
                                    </div>

                                    {calculateClassAverage(content) !== null && (
                                      <div className="text-sm">
                                        <span className="font-medium">Class Average:</span>{" "}
                                        {calculateClassAverage(content)}%
                                      </div>
                                    )}
                                  </div>

                                  <Progress
                                    value={
                                      content.studentProgress.submissions?.length
                                        ? (content.studentProgress.submissions.filter((s) => s.status === "completed")
                                            .length /
                                            content.studentProgress.submissions.length) *
                                          100
                                        : 0
                                    }
                                    className="h-2 mt-2"
                                  />
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
                        <FileText className="w-12 h-12 mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium">No content available</h3>
                        <p className="text-sm text-muted-foreground">
                          This lesson doesn't have any content yet. Contact an administrator to add curriculum
                          materials.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : activeContent ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle>{activeContent.title}</CardTitle>
                      <CardDescription>{activeContent.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList>
                          <TabsTrigger value="content">Content</TabsTrigger>
                          <TabsTrigger value="progress">Student Progress</TabsTrigger>
                        </TabsList>
                        <TabsContent value="content">
                          {activeContent.problems && activeContent.problems.length > 0 ? (
                            <div className="space-y-4">
                              <h3 className="text-lg font-medium">Problems</h3>
                              {activeContent.problems.map((problem, index) => renderProblemWithAnswer(problem, index))}
                            </div>
                          ) : (
                            <div className="p-4 border rounded-lg">
                              <p>{renderLatex(activeContent.description)}</p>
                              <p className="mt-4 text-sm text-muted-foreground">
                                This content doesn't have any problems to solve.
                              </p>
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="progress">
                          <StudentProgressTable />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
                <FileText className="w-12 h-12 mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium">No curriculum available</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  This class doesn't have any curriculum content yet. Contact an administrator to add curriculum
                  materials.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Publish confirmation dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {contentToPublish?.content.isPublished ? "Unpublish Content" : "Publish Content"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {contentToPublish?.content.isPublished
                ? "Are you sure you want to unpublish this content? Students will no longer be able to access it."
                : "Are you sure you want to publish this content? It will be visible to all students in this class."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPublish}>
              {contentToPublish?.content.isPublished ? "Unpublish" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Grade override dialog */}
      <AlertDialog open={gradeOverrideDialogOpen} onOpenChange={setGradeOverrideDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{studentToGrade ? `Grade ${studentToGrade.name}` : "Grade Student"}</AlertDialogTitle>
            <AlertDialogDescription>Manually update the student's grade and provide feedback</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="override-score">Score (%)</Label>
              <Input
                id="override-score"
                type="number"
                min="0"
                max="100"
                value={overrideScore}
                onChange={(e) => setOverrideScore(e.target.value)}
                placeholder="Enter score (0-100)"
              />
            </div>

            <div>
              <Label htmlFor="override-feedback">Feedback (Optional)</Label>
              <Textarea
                id="override-feedback"
                value={overrideFeedback}
                onChange={(e) => setOverrideFeedback(e.target.value)}
                placeholder="Provide feedback to the student"
                rows={3}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="half-credit">Half Credit</Label>
            <Switch id="half-credit" checked={halfCredit} onCheckedChange={setHalfCredit} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveGradeOverride}>Save Grade</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual grading dialog */}
      <AlertDialog open={manualGradingDialogOpen} onOpenChange={setManualGradingDialogOpen} className="max-w-4xl">
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Manual Grading: {studentToGrade?.name}</AlertDialogTitle>
            <AlertDialogDescription>Grade each problem individually and provide feedback</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {activeContent?.problems?.map((problem, index) => (
              <div key={index} className="mb-6 p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium">Problem {index + 1}</h3>
                    <p className="text-sm text-muted-foreground">{renderLatex(problem.question)}</p>
                  </div>
                  <Badge variant="outline">
                    {problem.type === "multiple-choice"
                      ? "Multiple Choice"
                      : problem.type === "open-ended"
                        ? "Open Ended"
                        : "Math Expression"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">Student Answer</h4>
                    <p className="text-sm">
                      {problem.type === "multiple-choice" &&
                      studentSubmission?.answers?.multipleChoice?.[index] !== undefined
                        ? `Option ${Number.parseInt(studentSubmission.answers.multipleChoice[index]) + 1}: ${problem.options[studentSubmission.answers.multipleChoice[index]]}`
                        : problem.type === "math-expression" && studentSubmission?.answers?.mathExpression?.[index]
                          ? renderLatex(`$$${studentSubmission.answers.mathExpression[index]}$$`)
                          : problem.type === "open-ended" && studentSubmission?.answers?.openEnded?.[index]
                            ? studentSubmission.answers.openEnded[index]
                            : "No answer provided"}
                    </p>
                  </div>

                  <div className="border rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">Correct Answer</h4>
                    <p className="text-sm">
                      {problem.type === "multiple-choice"
                        ? `Option ${Number.parseInt(problem.correctAnswer) + 1}: ${problem.options[problem.correctAnswer]}`
                        : problem.type === "math-expression"
                          ? renderLatex(`$$${problem.correctAnswer}$$`)
                          : problem.correctAnswer}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor={`problem-${index}-correct`}>Mark as Correct</Label>
                      <Switch
                        id={`problem-${index}-correct`}
                        checked={problemGrades[index]?.correct || false}
                        onCheckedChange={(checked) => {
                          setProblemGrades({
                            ...problemGrades,
                            [index]: {
                              ...problemGrades[index],
                              correct: checked,
                              points: checked ? problem.points : 0,
                            },
                          })
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`problem-${index}-points`}>
                      Points ({problemGrades[index]?.points || 0}/{problem.points})
                    </Label>
                    <Slider
                      id={`problem-${index}-points`}
                      min={0}
                      max={problem.points}
                      step={1}
                      value={[problemGrades[index]?.points || 0]}
                      onValueChange={(value) => {
                        setProblemGrades({
                          ...problemGrades,
                          [index]: {
                            ...problemGrades[index],
                            points: value[0],
                            correct: value[0] === problem.points,
                          },
                        })
                      }}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`problem-${index}-feedback`}>Problem-specific Feedback</Label>
                    <Textarea
                      id={`problem-${index}-feedback`}
                      value={problemGrades[index]?.feedback || ""}
                      onChange={(e) => {
                        setProblemGrades({
                          ...problemGrades,
                          [index]: {
                            ...problemGrades[index],
                            feedback: e.target.value,
                          },
                        })
                      }}
                      placeholder="Provide feedback for this problem"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveManualGrading}>
              <Save className="w-4 h-4 mr-2" />
              Save Grading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
