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

// Content types for curriculum
const contentTypes = [
  { id: "new-material", name: "New Material", icon: <BookOpen className="w-4 h-4 mr-2" /> },
  { id: "guided-practice", name: "Guided Practice", icon: <PenTool className="w-4 h-4 mr-2" /> },
  { id: "classwork", name: "Classwork", icon: <ClipboardList className="w-4 h-4 mr-2" /> },
  { id: "homework", name: "Homework", icon: <BookMarked className="w-4 h-4 mr-2" /> },
  { id: "quiz", name: "Quiz", icon: <FileQuestion className="w-4 h-4 mr-2" /> },
  { id: "test", name: "Test", icon: <FileText className="w-4 h-4 mr-2" /> },
]

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

export default function StudentCurriculum() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const classId = params.classId as string

  const [currentClass, setCurrentClass] = useState(null)
  const [curriculum, setCurriculum] = useState(null)
  const [activeLesson, setActiveLesson] = useState(1)
  const [activeContent, setActiveContent] = useState(null)
  const [userAnswers, setUserAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  const [mathExpressionInputs, setMathExpressionInputs] = useState({})
  const [openEndedAnswers, setOpenEndedAnswers] = useState({})
  const [attemptCounts, setAttemptCounts] = useState({})
  const [currentUser, setCurrentUser] = useState(null)

  // Load class and curriculum data
  useEffect(() => {
    // Check if user is a student
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "student") {
      toast({
        title: "Access denied",
        description: "You must be logged in as a student to view this page",
        variant: "destructive",
      })
      router.push("/student-portal")
      return
    }

    setCurrentUser(user)

    // Try to get class from storage
    const classes = storage.getClasses()
    const foundClass = classes.find((c) => c.id === classId)

    if (foundClass) {
      setCurrentClass(foundClass)

      // Try to load published curriculum data
      if (typeof window !== "undefined") {
        const publishedCurriculumKey = `published-curriculum-${classId}`
        const publishedData = localStorage.getItem(publishedCurriculumKey)

        if (publishedData) {
          try {
            const publishedCurriculum = JSON.parse(publishedData)

            // Get the full curriculum from the class
            const fullCurriculum = foundClass.curriculum || { lessons: [] }

            // Create a new curriculum with only published content
            const studentCurriculum = { lessons: [...fullCurriculum.lessons] }

            // For each lesson with published content
            Object.keys(publishedCurriculum).forEach((lessonIndex) => {
              const lessonContents = publishedCurriculum[lessonIndex]

              // Make sure this lesson exists in our curriculum
              if (studentCurriculum.lessons[lessonIndex]) {
                // Initialize contents array if it doesn't exist
                if (!studentCurriculum.lessons[lessonIndex].contents) {
                  studentCurriculum.lessons[lessonIndex].contents = []
                }

                // For each published content in this lesson
                Object.keys(lessonContents).forEach((contentIndex) => {
                  const publishedContent = lessonContents[contentIndex]

                  // Add the published content
                  studentCurriculum.lessons[lessonIndex].contents[contentIndex] = {
                    ...publishedContent,
                    isPublished: true,
                  }
                })

                // Filter out any unpublished content
                studentCurriculum.lessons[lessonIndex].contents = studentCurriculum.lessons[
                  lessonIndex
                ].contents.filter((content) => content && content.isPublished)
              }
            })

            setCurriculum(studentCurriculum)
          } catch (error) {
            console.error("Error loading published curriculum:", error)
            setCurriculum({ lessons: [] })
          }
        } else {
          // If no published curriculum, check if there's one in the class
          if (foundClass.curriculum) {
            // Filter to only include published content
            const studentCurriculum = {
              lessons: foundClass.curriculum.lessons
                .map((lesson) => ({
                  ...lesson,
                  contents: (lesson.contents || []).filter((content) => content.isPublished),
                }))
                .filter((lesson) => lesson.contents.length > 0),
            }
            setCurriculum(studentCurriculum)
          } else {
            setCurriculum({ lessons: [] })
          }
        }

        // Load any previously graded content
        if (user) {
          // Load attempt counts
          const attemptCountsKey = `attempt-counts-${classId}-${user.id}`
          const attemptCountsData = localStorage.getItem(attemptCountsKey)
          if (attemptCountsData) {
            try {
              setAttemptCounts(JSON.parse(attemptCountsData))
            } catch (error) {
              console.error("Error loading attempt counts:", error)
            }
          }
        }
      } else {
        setCurriculum({ lessons: [] })
      }
    } else {
      toast({
        title: "Class not found",
        description: "The requested class could not be found.",
        variant: "destructive",
      })
      router.push("/student/dashboard")
    }
  }, [classId, router, toast])

  // Handle selecting a content item
  const handleSelectContent = (content) => {
    setActiveContent(content)

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
      }
    }
  }

  // Handle multiple choice answer selection
  const handleMultipleChoiceSelect = (problemIndex, optionIndex) => {
    if (!activeContent) return

    setUserAnswers({
      ...userAnswers,
      [activeContent.id]: {
        ...(userAnswers[activeContent.id] || {}),
        [problemIndex]: optionIndex,
      },
    })
  }

  // Handle math expression input
  const handleMathExpressionInput = (problemIndex, value) => {
    if (!activeContent) return

    setMathExpressionInputs({
      ...mathExpressionInputs,
      [activeContent.id]: {
        ...(mathExpressionInputs[activeContent.id] || {}),
        [problemIndex]: value,
      },
    })
  }

  // Handle open ended answer input
  const handleOpenEndedInput = (problemIndex, value) => {
    if (!activeContent) return

    setOpenEndedAnswers({
      ...openEndedAnswers,
      [activeContent.id]: {
        ...(openEndedAnswers[activeContent.id] || {}),
        [problemIndex]: value,
      },
    })
  }

  // Auto-grade a math expression answer
  const gradeMathExpression = (problem, studentAnswer) => {
    if (!studentAnswer) return { correct: false, score: 0 }

    // Clean up the student answer
    const cleanStudentAnswer = studentAnswer.replace(/\s+/g, "").toLowerCase()

    // Check if problem has multiple correct answers
    if (problem.correctAnswers && problem.correctAnswers.length > 0) {
      // Try each correct answer
      for (const correctAnswer of problem.correctAnswers) {
        // Clean up the correct answer
        const cleanCorrectAnswer = correctAnswer.replace(/\s+/g, "").toLowerCase()

        // Check for exact match
        if (cleanStudentAnswer === cleanCorrectAnswer) {
          return { correct: true, score: problem.points }
        }

        // Try numerical comparison if possible
        const correctNum = Number.parseFloat(cleanCorrectAnswer)
        const studentNum = Number.parseFloat(cleanStudentAnswer)

        if (!isNaN(correctNum) && !isNaN(studentNum)) {
          // Check if within tolerance
          if (Math.abs(correctNum - studentNum) <= problem.tolerance) {
            return { correct: true, score: problem.points }
          }
        }
      }

      return { correct: false, score: 0 }
    } else {
      // Legacy support for single correct answer
      const cleanCorrectAnswer = problem.correctAnswer.replace(/\s+/g, "").toLowerCase()

      // Check for exact match first
      if (cleanStudentAnswer === cleanCorrectAnswer) {
        return { correct: true, score: problem.points }
      }

      // Try to parse as numbers for numerical comparison
      const correctNum = Number.parseFloat(cleanCorrectAnswer)
      const studentNum = Number.parseFloat(cleanStudentAnswer)

      if (!isNaN(correctNum) && !isNaN(studentNum)) {
        // Check if within tolerance
        if (Math.abs(correctNum - studentNum) <= problem.tolerance) {
          return { correct: true, score: problem.points }
        }
      }

      return { correct: false, score: 0 }
    }
  }

  // Auto-grade an open ended answer
  const gradeOpenEnded = (problem, studentAnswer) => {
    if (!studentAnswer) return { correct: false, score: 0 }

    // Count how many keywords are present in the student's answer
    const lowerStudentAnswer = studentAnswer.toLowerCase()
    const matchedKeywords = problem.keywords.filter((keyword) => lowerStudentAnswer.includes(keyword.toLowerCase()))

    // Calculate score based on keyword matches
    let score = 0
    if (matchedKeywords.length > 0) {
      if (problem.allowPartialCredit) {
        // Award partial credit based on keyword matches
        score = Math.round((matchedKeywords.length / problem.keywords.length) * problem.points)
      } else if (matchedKeywords.length === problem.keywords.length) {
        // All keywords must be present for full credit
        score = problem.points
      }
    }

    return {
      correct: score === problem.points,
      score,
      matchedKeywords,
    }
  }

  // Handle submitting answers
  const handleSubmitAnswers = () => {
    if (!activeContent || !currentUser) return

    // Check if all questions are answered
    const allAnswered = activeContent.problems.every((problem, index) => {
      if (problem.type === "multiple-choice") {
        return userAnswers[activeContent.id]?.[index] !== undefined && userAnswers[activeContent.id]?.[index] !== -1
      } else if (problem.type === "math-expression") {
        return (
          mathExpressionInputs[activeContent.id]?.[index] !== undefined &&
          mathExpressionInputs[activeContent.id]?.[index] !== ""
        )
      } else if (problem.type === "open-ended") {
        return (
          openEndedAnswers[activeContent.id]?.[index] !== undefined &&
          openEndedAnswers[activeContent.id]?.[index] !== ""
        )
      }
      return false
    })

    if (!allAnswered) {
      toast({
        title: "Incomplete submission",
        description: `Please answer all questions before submitting.`,
        variant: "destructive",
      })
      return
    }

    // Check if any problems have exceeded max attempts
    const attemptKey = `${activeContent.id}`
    const currentAttempts = attemptCounts[attemptKey] || {}

    const exceededAttempts = activeContent.problems.some((problem, index) => {
      const problemKey = `problem-${index}`
      const attempts = currentAttempts[problemKey] || 0
      return problem.maxAttempts && attempts >= problem.maxAttempts
    })

    if (exceededAttempts) {
      toast({
        title: "Maximum attempts reached",
        description: "You have reached the maximum number of attempts for one or more problems.",
        variant: "destructive",
      })
      return
    }

    // Update attempt counts
    const newAttempts = { ...currentAttempts }
    activeContent.problems.forEach((problem, index) => {
      const problemKey = `problem-${index}`
      newAttempts[problemKey] = (newAttempts[problemKey] || 0) + 1
    })

    const newAttemptCounts = {
      ...attemptCounts,
      [attemptKey]: newAttempts,
    }

    setAttemptCounts(newAttemptCounts)

    // Save attempt counts to localStorage
    if (typeof window !== "undefined") {
      const attemptCountsKey = `attempt-counts-${classId}-${currentUser.id}`
      localStorage.setItem(attemptCountsKey, JSON.stringify(newAttemptCounts))
    }

    // Calculate score
    let totalPoints = 0
    let earnedPoints = 0
    const problemResults = []

    activeContent.problems.forEach((problem, index) => {
      totalPoints += problem.points

      if (problem.type === "multiple-choice") {
        const isCorrect = userAnswers[activeContent.id][index] === problem.correctAnswer
        const pointsEarned = isCorrect ? problem.points : 0
        earnedPoints += pointsEarned
        problemResults.push({
          type: problem.type,
          correct: isCorrect,
          points: pointsEarned,
          maxPoints: problem.points,
          studentAnswer: userAnswers[activeContent.id][index],
          correctAnswer: problem.correctAnswer,
        })
      } else if (problem.type === "math-expression") {
        const result = gradeMathExpression(problem, mathExpressionInputs[activeContent.id][index])
        earnedPoints += result.score
        problemResults.push({
          type: problem.type,
          correct: result.correct,
          points: result.score,
          maxPoints: problem.points,
          studentAnswer: mathExpressionInputs[activeContent.id][index],
          correctAnswer:
            problem.correctAnswers && problem.correctAnswers.length > 0
              ? problem.correctAnswers
              : problem.correctAnswer,
        })
      } else if (problem.type === "open-ended") {
        const result = gradeOpenEnded(problem, openEndedAnswers[activeContent.id][index])
        earnedPoints += result.score
        problemResults.push({
          type: problem.type,
          correct: result.correct,
          points: result.score,
          maxPoints: problem.points,
          studentAnswer: openEndedAnswers[activeContent.id][index],
          correctAnswer:
            problem.correctAnswers && problem.correctAnswers.length > 0
              ? problem.correctAnswers
              : problem.correctAnswer,
          matchedKeywords: result.matchedKeywords,
        })
      }
    })

    const score = Math.round((earnedPoints / totalPoints) * 100)

    // Save the submission to localStorage for teachers to access
    if (typeof window !== "undefined") {
      try {
        // Create a submission record
        const submission = {
          studentId: currentUser.id,
          status: "completed",
          score,
          submittedAt: new Date().toISOString(),
          answers: {
            multipleChoice: userAnswers[activeContent.id] || {},
            mathExpression: mathExpressionInputs[activeContent.id] || {},
            openEnded: openEndedAnswers[activeContent.id] || {},
          },
          problemResults,
          gradedBy: "auto",
          gradedAt: new Date().toISOString(),
        }

        // Get existing submissions for this content
        const gradedContentKey = `graded-content-${classId}-${activeContent.id}`
        let submissions = []

        const existingData = localStorage.getItem(gradedContentKey)
        if (existingData) {
          submissions = JSON.parse(existingData)

          // Update or add this student's submission
          const existingIndex = submissions.findIndex((sub) => sub.studentId === currentUser.id)
          if (existingIndex >= 0) {
            submissions[existingIndex] = submission
          } else {
            submissions.push(submission)
          }
        } else {
          submissions.push(submission)
        }

        // Save back to localStorage
        localStorage.setItem(gradedContentKey, JSON.stringify(submissions))
      } catch (error) {
        console.error("Error saving submission:", error)
      }
    }

    setShowResults(true)

    toast({
      title: "Submission successful",
      description: `Your answers have been submitted. Score: ${score}%`,
    })
  }

  // Get remaining attempts for a problem
  const getRemainingAttempts = (problemIndex) => {
    if (!activeContent) return null

    const problem = activeContent.problems[problemIndex]
    if (!problem.maxAttempts) return null

    const attemptKey = `${activeContent.id}`
    const currentAttempts = attemptCounts[attemptKey] || {}
    const problemKey = `problem-${problemIndex}`
    const attempts = currentAttempts[problemKey] || 0

    return Math.max(0, problem.maxAttempts - attempts)
  }

  // Render content type icon
  const renderContentTypeIcon = (type) => {
    const contentType = contentTypes.find((ct) => ct.id === type)
    return contentType ? contentType.icon : <FileText className="w-4 h-4 mr-2" />
  }

  // Get status badge for content
  const getStatusBadge = (content) => {
    if (currentUser) {
      const gradedContentKey = `graded-content-${classId}-${content.id}`
      const gradedData = localStorage.getItem(gradedContentKey)

      if (gradedData) {
        try {
          const submissions = JSON.parse(gradedData)
          const userSubmission = submissions.find((sub) => sub.studentId === currentUser.id)

          if (userSubmission) {
            if (userSubmission.status === "completed") {
              return (
                <Badge variant="success" className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed ({userSubmission.score}%)
                </Badge>
              )
            } else {
              return (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  In Progress
                </Badge>
              )
            }
          }
        } catch (error) {
          console.error("Error loading graded content:", error)
        }
      }
    }

    return <Badge variant="outline">Not Started</Badge>
  }

  if (!currentClass || !curriculum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading curriculum...</p>
      </div>
    )
  }

  // Filter to only show lessons with published content
  const lessonsWithContent = curriculum.lessons.filter(
    (lesson) => lesson.contents && lesson.contents.some((content) => content.isPublished),
  )

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
        </div>

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
                <div className="space-y-1">
                  {lessonsWithContent.map((lesson, index) => {
                    const publishedContents = lesson.contents ? lesson.contents.filter((c) => c.isPublished) : []
                    if (publishedContents.length === 0) return null

                    return (
                      <Button
                        key={lesson.id}
                        variant={activeLesson === index + 1 ? "default" : "ghost"}
                        className="justify-start w-full"
                        onClick={() => {
                          setActiveLesson(index + 1)
                          setActiveContent(null)
                        }}
                      >
                        <span className="mr-2">{index + 1}.</span>
                        {lesson.title}
                        {publishedContents.length > 0 && (
                          <Badge variant="secondary" className="ml-auto">
                            {publishedContents.length}
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
            {!activeContent ? (
              // Lesson overview
              <Card>
                <CardHeader>
                  <CardTitle>
                    Lesson {activeLesson}: {curriculum.lessons[activeLesson - 1].title}
                  </CardTitle>
                  <CardDescription>
                    {renderLatex(curriculum.lessons[activeLesson - 1].description) || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {curriculum.lessons[activeLesson - 1].contents
                      .filter((content) => content.isPublished)
                      .map((content) => (
                        <Card key={content.id} className="overflow-hidden">
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
              // Content detail view
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {renderContentTypeIcon(activeContent.type)}
                      <div>
                        <CardTitle>{activeContent.title}</CardTitle>
                        <CardDescription>{renderLatex(activeContent.description)}</CardDescription>
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
                  {activeContent.problems && activeContent.problems.length > 0 ? (
                    <div className="space-y-8">
                      {activeContent.problems.map((problem, problemIndex) => (
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
                                {problem.maxAttempts && (
                                  <Badge variant="outline" className="ml-2">
                                    Attempts: {getRemainingAttempts(problemIndex)} of {problem.maxAttempts} remaining
                                  </Badge>
                                )}
                              </div>

                              <p className="mt-2 mb-4">{renderLatex(problem.question)}</p>

                              {problem.type === "multiple-choice" && (
                                <RadioGroup
                                  value={userAnswers[activeContent.id]?.[problemIndex]?.toString() || "-1"}
                                  onValueChange={(value) =>
                                    handleMultipleChoiceSelect(problemIndex, Number.parseInt(value))
                                  }
                                  disabled={showResults}
                                  className="space-y-3"
                                >
                                  {problem.options.map((option, optionIndex) => (
                                    <div
                                      key={optionIndex}
                                      className={`flex items-center space-x-2 p-2 rounded-md ${
                                        showResults && optionIndex === problem.correctAnswer
                                          ? "bg-green-50 dark:bg-green-900/20"
                                          : showResults &&
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
                                        {renderLatex(option)}
                                      </Label>

                                      {showResults && optionIndex === problem.correctAnswer && (
                                        <CheckCircle2 className="w-4 h-4 ml-auto text-green-500" />
                                      )}
                                      {showResults &&
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
                                        disabled={showResults}
                                        className="flex-1"
                                      />
                                    </div>

                                    {showResults && (
                                      <div
                                        className={`p-2 mt-2 rounded-md ${
                                          gradeMathExpression(
                                            problem,
                                            mathExpressionInputs[activeContent.id]?.[problemIndex],
                                          ).correct
                                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                                        }`}
                                      >
                                        {gradeMathExpression(
                                          problem,
                                          mathExpressionInputs[activeContent.id]?.[problemIndex],
                                        ).correct
                                          ? "Correct!"
                                          : "Incorrect. The correct answer is:"}
                                        {!gradeMathExpression(
                                          problem,
                                          mathExpressionInputs[activeContent.id]?.[problemIndex],
                                        ).correct && (
                                          <div className="font-medium mt-1">
                                            {problem.correctAnswers && problem.correctAnswers.length > 0 ? (
                                              <div className="flex flex-col gap-1">
                                                {problem.correctAnswers.map((answer, i) => (
                                                  <div key={i}>{renderLatex(`$$${answer}$$`)}</div>
                                                ))}
                                              </div>
                                            ) : (
                                              renderLatex(`$$${problem.correctAnswer}$$`)
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
                                      disabled={showResults}
                                      rows={4}
                                    />

                                    {showResults && (
                                      <div className="p-3 mt-2 bg-slate-50 dark:bg-slate-800 rounded-md">
                                        <p className="font-medium text-sm">Sample Correct Answer:</p>
                                        {problem.correctAnswers && problem.correctAnswers.length > 0 ? (
                                          <div className="flex flex-col gap-2 mt-1">
                                            {problem.correctAnswers.map((answer, i) => (
                                              <p key={i}>{answer}</p>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="mt-1">{problem.correctAnswer}</p>
                                        )}

                                        {problem.keywords.length > 0 && (
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

                              {showResults && problem.explanation && (
                                <div className="p-3 mt-4 bg-slate-50 dark:bg-slate-800 rounded-md">
                                  <p className="font-medium text-sm">Explanation:</p>
                                  <p className="text-sm">{renderLatex(problem.explanation)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {!showResults && (
                        <Button
                          className="w-full"
                          onClick={handleSubmitAnswers}
                          disabled={
                            !activeContent.problems.every((problem, index) => {
                              if (problem.type === "multiple-choice") {
                                return (
                                  userAnswers[activeContent.id]?.[index] !== undefined &&
                                  userAnswers[activeContent.id]?.[index] !== -1
                                )
                              } else if (problem.type === "math-expression") {
                                return (
                                  mathExpressionInputs[activeContent.id]?.[index] !== undefined &&
                                  mathExpressionInputs[activeContent.id]?.[index] !== ""
                                )
                              } else if (problem.type === "open-ended") {
                                return (
                                  openEndedAnswers[activeContent.id]?.[index] !== undefined &&
                                  openEndedAnswers[activeContent.id]?.[index] !== ""
                                )
                              }
                              return false
                            })
                          }
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Submit Answers
                        </Button>
                      )}

                      {showResults && activeContent.studentProgress?.score !== undefined && (
                        <div className="p-4 border rounded-lg">
                          <p className="font-medium">Your Score</p>
                          <div className="flex items-center mt-2 space-x-4">
                            <Progress value={activeContent.studentProgress.score} className="flex-1" />
                            <span className="font-bold">{activeContent.studentProgress.score}%</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Submitted on {new Date(activeContent.studentProgress.submittedAt).toLocaleDateString()} at{" "}
                            {new Date(activeContent.studentProgress.submittedAt).toLocaleTimeString()}
                          </p>

                          {activeContent.studentProgress.feedback && (
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-md">
                              <p className="font-medium text-sm">Teacher Feedback:</p>
                              <p className="mt-1">{activeContent.studentProgress.feedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 border rounded-lg">
                      <p>{renderLatex(activeContent.description)}</p>
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
