"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  FileText,
  BookOpen,
  PenTool,
  ClipboardList,
  BookMarked,
  FileQuestion,
  X,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { generateId } from "@/lib/utils"
import { sessionManager } from "@/lib/session"
import { GraphEditor } from "@/components/graph-editor"

// Content types for curriculum
const contentTypes = [
  { id: "new-material", name: "New Material", icon: <BookOpen className="w-4 h-4 mr-2" /> },
  { id: "guided-practice", name: "Guided Practice", icon: <PenTool className="w-4 h-4 mr-2" /> },
  { id: "classwork", name: "Classwork", icon: <ClipboardList className="w-4 h-4 mr-2" /> },
  { id: "homework", name: "Homework", icon: <BookMarked className="w-4 h-4 mr-2" /> },
  { id: "quiz", name: "Quiz", icon: <FileQuestion className="w-4 h-4 mr-2" /> },
  { id: "test", name: "Test", icon: <FileText className="w-4 h-4 mr-2" /> },
]

// Problem types
const problemTypes = [
  { id: "multiple-choice", name: "Multiple Choice" },
  { id: "open-ended", name: "Open Ended" },
  { id: "math-expression", name: "Math Expression" },
  { id: "geometric", name: "Geometric/Graphing" },
]

export default function CurriculumEditor({ params }: { params: { classId: string } }) {
  const { classId } = params
  const router = useRouter()
  const { toast } = useToast()
  const [classData, setClassData] = useState<any>(null)
  const [curriculum, setCurriculum] = useState<any>({
    lessons: [],
  })
  const [activeLesson, setActiveLesson] = useState<string | null>(null)
  const [activeContent, setActiveContent] = useState<string | null>(null)
  const [activeProblem, setActiveProblem] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddingLesson, setIsAddingLesson] = useState(false)
  const [newLessonTitle, setNewLessonTitle] = useState("")
  const [newLessonDescription, setNewLessonDescription] = useState("")
  const [newLessonTopic, setNewLessonTopic] = useState("")
  const [isAddingContent, setIsAddingContent] = useState(false)
  const [newContentType, setNewContentType] = useState("new-material")
  const [newContentTitle, setNewContentTitle] = useState("")
  const [newContentDescription, setNewContentDescription] = useState("")
  const [newContentTeachersInstructions, setNewContentTeachersInstructions] = useState("")
  const [isAddingProblem, setIsAddingProblem] = useState(false)
  const [newProblemType, setNewProblemType] = useState("multiple-choice")
  const [newProblemQuestion, setNewProblemQuestion] = useState("")
  const [newProblemOptions, setNewProblemOptions] = useState(["", "", "", ""])
  const [newProblemCorrectAnswer, setNewProblemCorrectAnswer] = useState(0)
  const [newProblemCorrectAnswers, setNewProblemCorrectAnswers] = useState<string[]>([])
  const [newProblemExplanation, setNewProblemExplanation] = useState("")
  const [newProblemPoints, setNewProblemPoints] = useState(3)
  const [newProblemKeywords, setNewProblemKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState("")
  const [newProblemAllowPartialCredit, setNewProblemAllowPartialCredit] = useState(false)
  const [newProblemTolerance, setNewProblemTolerance] = useState(0.01)
  const [newProblemMaxAttempts, setNewProblemMaxAttempts] = useState<number | null>(null)
  const [newProblemGraphData, setNewProblemGraphData] = useState<{ points: Array<{ x: number; y: number }>; lines: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> }>({ points: [], lines: [] })
  const [deleteLessonDialogOpen, setDeleteLessonDialogOpen] = useState(false)
  const [deleteContentDialogOpen, setDeleteContentDialogOpen] = useState(false)
  const [deleteProblemDialogOpen, setDeleteProblemDialogOpen] = useState(false)
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null)
  const [contentToDelete, setContentToDelete] = useState<string | null>(null)
  const [problemToDelete, setProblemToDelete] = useState<string | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [availableClasses, setAvailableClasses] = useState<any[]>([])
  const [selectedSourceClassId, setSelectedSourceClassId] = useState<string>("")

  useEffect(() => {
    // Check if user is an admin
    const user = sessionManager.getCurrentUser()
    if (!user || user.role !== "admin") {
      toast({
        title: "Access denied",
        description: "You must be logged in as an admin to view this page",
        variant: "destructive",
      })
      router.push("/admin-portal")
      return
    }

    // Load class data
    const loadedClass = storage.getClassById(classId)
    if (!loadedClass) {
      toast({
        title: "Class not found",
        description: "The requested class could not be found",
        variant: "destructive",
      })
      router.push("/admin/dashboard")
      return
    }
    setClassData(loadedClass)

    // Load curriculum data
    const loadCurriculum = async () => {
      try {
        // First, try to load curriculum directly using dedicated API
        console.log("Attempting to load curriculum for class:", classId)
        const curriculumData = await storage.getCurriculum(classId)
        if (curriculumData) {
          console.log("Loaded curriculum data:", curriculumData)
          // Handle both formats - content field or direct structure
          const formattedCurriculum = curriculumData.content ? curriculumData.content : curriculumData
          setCurriculum(formattedCurriculum)
          
          if (formattedCurriculum.lessons && formattedCurriculum.lessons.length > 0) {
            setActiveLesson(formattedCurriculum.lessons[0].id)
  
            if (formattedCurriculum.lessons[0].contents && formattedCurriculum.lessons[0].contents.length > 0) {
              setActiveContent(formattedCurriculum.lessons[0].contents[0].id)
  
              if (
                formattedCurriculum.lessons[0].contents[0].problems &&
                formattedCurriculum.lessons[0].contents[0].problems.length > 0
              ) {
                setActiveProblem(formattedCurriculum.lessons[0].contents[0].problems[0].id)
              }
            }
          }
          setIsLoading(false)
          return
        }
      } catch (curriculumError) {
        console.error("Error loading curriculum directly:", curriculumError)
      }
      
      // Fall back to curriculum on class object
      if (loadedClass.curriculum) {
        console.log("Using curriculum from class object")
        setCurriculum(loadedClass.curriculum)
        
        if (loadedClass.curriculum.lessons && loadedClass.curriculum.lessons.length > 0) {
          setActiveLesson(loadedClass.curriculum.lessons[0].id)

          if (loadedClass.curriculum.lessons[0].contents && loadedClass.curriculum.lessons[0].contents.length > 0) {
            setActiveContent(loadedClass.curriculum.lessons[0].contents[0].id)

            if (
              loadedClass.curriculum.lessons[0].contents[0].problems &&
              loadedClass.curriculum.lessons[0].contents[0].problems.length > 0
            ) {
              setActiveProblem(loadedClass.curriculum.lessons[0].contents[0].problems[0].id)
            }
          }
        }
        setIsLoading(false)
        return
      }

      // If no curriculum exists, create empty one
      console.log("No curriculum found, creating empty structure")
      setCurriculum({ lessons: [] })
      setIsLoading(false)
    }

    loadCurriculum()

    // Load available classes for duplication
    const loadAvailableClasses = async () => {
      try {
        const allClasses = await storage.getClasses()
        // Filter out the current class
        const otherClasses = allClasses.filter((cls: any) => cls.id !== classId)
        setAvailableClasses(otherClasses)
      } catch (error) {
        console.error("Error loading classes:", error)
      }
    }
    loadAvailableClasses()
  }, [classId, router, toast])

  // Save curriculum
  const saveCurriculum = async () => {
    if (!classData) {
      console.error("Cannot save curriculum: classData is null or undefined");
      toast({
        title: "Save failed",
        description: "Missing class data. Please try reloading the page.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Saving curriculum for class:", classId);
      
      // Ensure curriculum has the correct structure with lessons array
      const structuredCurriculum = {
        ...curriculum,
        lessons: Array.isArray(curriculum.lessons) ? curriculum.lessons : []
      };
      
      // Format for better compatibility with teacher portal
      const curriculumData = {
        classId: classId,
        content: structuredCurriculum, 
        lastUpdated: new Date().toISOString()
      };
      
      console.log("Curriculum data being saved:", JSON.stringify(curriculumData).substring(0, 200) + "...");
      
      // Save to multiple storage locations for redundancy
      
      // 1. Save to localStorage directly as a backup
      try {
        console.log("Saving to localStorage");
        localStorage.setItem(`curriculum_${classId}`, JSON.stringify(curriculumData));
        // Also save directly to published curriculum for immediate access by students/teachers
        localStorage.setItem(`published-curriculum-${classId}`, JSON.stringify(curriculumData.content));
        console.log("Successfully saved to localStorage");
      } catch (localStorageError) {
        console.error("Error saving to localStorage:", localStorageError);
      }
      
      // 2. Save with dedicated curriculum API 
      let result = false;
      try {
        // Check authentication before saving
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          console.error("❌ CRITICAL: Admin user not authenticated with Firebase Auth!");
          toast({
            title: "Save Failed",
            description: "You must be authenticated with Firebase to save curriculum. Please log out and log back in.",
            variant: "destructive",
          });
          return; // Don't continue if not authenticated
        }
        
        console.log("✅ Admin authenticated:", {
          uid: currentUser.uid,
          email: currentUser.email
        });
        console.log("Attempting to save curriculum with dedicated API...");
        result = await storage.saveCurriculum(classId, curriculumData);
        console.log("Save curriculum result:", result);
        
        if (!result) {
          console.error("❌ Curriculum save returned false - Firestore write likely failed");
          toast({
            title: "Save Failed",
            description: "Failed to save curriculum to Firestore. Check console for details. The curriculum was saved to cache but won't be visible to teachers/students.",
            variant: "destructive",
          });
        } else {
          console.log("✅ Curriculum successfully saved to Firestore");
        }
        
        if (!result) {
          console.log("Trying updateCurriculum instead...");
          result = await storage.updateCurriculum(classId, curriculumData);
          console.log("Update curriculum result:", result);
        }
      } catch (apiError: any) {
        console.error("❌ Error with curriculum API methods:", apiError);
        console.error("Error details:", {
          code: apiError?.code,
          message: apiError?.message,
          stack: apiError?.stack
        });
        toast({
          title: "Save Error",
          description: `Failed to save curriculum: ${apiError?.message || 'Unknown error'}. Check console for details.`,
          variant: "destructive",
        });
      }
      
      // 3. ALWAYS update the class object with curriculum as well
      try {
        console.log("Also updating the class object with curriculum");
        const updatedClass = {
          ...classData,
          curriculum: structuredCurriculum,
          updatedAt: new Date().toISOString()
        };
        
        const classUpdateResult = await storage.updateClass(classId, updatedClass);
        console.log("Class update result:", classUpdateResult);
        result = result || classUpdateResult;
      } catch (classUpdateError) {
        console.error("Error updating class:", classUpdateError);
      }
      
      // 4. Create a special published version for teachers and students
      try {
        // Convert the curriculum format to a lesson-indexed form for the teacher/student portal
        const publishedFormat = {};
        
        if (structuredCurriculum.lessons && Array.isArray(structuredCurriculum.lessons)) {
          structuredCurriculum.lessons.forEach((lesson, lessonIndex) => {
            if (lesson.contents && Array.isArray(lesson.contents)) {
              publishedFormat[lessonIndex] = {};
              
              lesson.contents.forEach((content, contentIndex) => {
                if (content.isPublished) {
                  publishedFormat[lessonIndex][contentIndex] = content;
                }
              });
            }
          });
        }
        
        console.log("Saving published curriculum format");
        localStorage.setItem(`published-curriculum-${classId}`, JSON.stringify(publishedFormat));
      } catch (publishError) {
        console.error("Error creating published version:", publishError);
      }
      
      if (result) {
        console.log("Curriculum successfully saved");
        
        toast({
          title: "Curriculum saved",
          description: "The curriculum has been saved successfully",
        });

        // Add activity log
        await storage.addActivityLog({
          action: "Curriculum Updated",
          details: `Curriculum for ${classData.name} has been updated`,
          timestamp: new Date().toLocaleString(),
          category: "Curriculum Management",
        });
        
        // Update the local class data with the curriculum
        setClassData({
          ...classData,
          curriculum: structuredCurriculum
        });
      } else {
        throw new Error("Failed to save curriculum to any storage location");
      }
    } catch (error) {
      console.error("Error saving curriculum:", error);
      toast({
        title: "Save failed",
        description: "There was a problem saving the curriculum. Please try again.",
        variant: "destructive",
      });
    }
  }

  // Add a new lesson
  const handleAddLesson = () => {
    if (!newLessonTitle) {
      toast({
        title: "Missing title",
        description: "Please enter a title for the lesson",
        variant: "destructive",
      })
      return
    }

    // Generate a unique ID for the new lesson
    const newLessonId = generateId("lesson_")
    
    // Create the new lesson object
    const newLesson = {
      id: newLessonId,
      title: newLessonTitle,
      description: newLessonDescription,
      topic: newLessonTopic,
      contents: [],
    }
    
    // Ensure curriculum.lessons is properly initialized
    const currentLessons = curriculum.lessons && Array.isArray(curriculum.lessons) 
      ? curriculum.lessons 
      : [];
    
    console.log("Adding new lesson:", newLesson);
    console.log("Current lessons:", currentLessons);

    // Create the updated curriculum with the new lesson
    const updatedCurriculum = {
      ...curriculum,
      lessons: [...currentLessons, newLesson],
    }
    
    console.log("Updated curriculum:", updatedCurriculum);

    // Update state
    setCurriculum(updatedCurriculum)
    setActiveLesson(newLessonId)
    setActiveContent(null)
    setActiveProblem(null)
    setIsAddingLesson(false)
    setNewLessonTitle("")
    setNewLessonDescription("")
    setNewLessonTopic("")

    // Save to storage
    setTimeout(() => {
      saveCurriculum();
      
      toast({
        title: "Lesson added",
        description: "New lesson has been added to the curriculum",
      });
    }, 100);
  }

  // Add new content to a lesson
  const handleAddContent = () => {
    if (!activeLesson) return
    if (!newContentTitle) {
      toast({
        title: "Missing title",
        description: "Please enter a title for the content",
        variant: "destructive",
      })
      return
    }

    const newContentId = generateId("content_")
    const newContent = {
      id: newContentId,
      type: newContentType,
      title: newContentTitle,
      description: newContentDescription,
      teachersInstructions: newContentTeachersInstructions,
      problems: [],
      isPublished: false,
    }

    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === activeLesson) {
          return {
            ...lesson,
            contents: [...(lesson.contents || []), newContent],
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)
    setActiveContent(newContentId)
    setActiveProblem(null)
    setIsAddingContent(false)
    setNewContentTitle("")
    setNewContentDescription("")
    setNewContentTeachersInstructions("")

    // Save to storage
    saveCurriculum()

    toast({
      title: "Content added",
      description: `New ${contentTypes.find((ct) => ct.id === newContentType)?.name} has been added to the lesson`,
    })
  }

  // Add a new problem to content
  const handleAddProblem = () => {
    if (!activeLesson || !activeContent) return
    if (!newProblemQuestion) {
      toast({
        title: "Missing question",
        description: "Please enter a question for the problem",
        variant: "destructive",
      })
      return
    }

    // Get the current content to determine its type for default attempts
    const currentContent = curriculum.lessons
      .find((l: any) => l.id === activeLesson)
      ?.contents?.find((c: any) => c.id === activeContent)
    
    // Set default attempts based on content type if not already set
    if (newProblemMaxAttempts === null && currentContent) {
      const contentType = currentContent.type
      if (contentType === "test" || contentType === "quiz") {
        setNewProblemMaxAttempts(1)
      } else {
        setNewProblemMaxAttempts(5)
      }
    }

    // Validate based on problem type
    if (newProblemType === "multiple-choice") {
      if (newProblemOptions.some((opt) => !opt)) {
        toast({
          title: "Incomplete options",
          description: "Please fill in all options for the multiple choice problem",
          variant: "destructive",
        })
        return
      }
    } else if (newProblemType === "math-expression") {
      if (newProblemCorrectAnswers.length === 0) {
        toast({
          title: "Missing correct answer",
          description: "Please add at least one correct answer for the math expression problem",
          variant: "destructive",
        })
        return
      }
    } else if (newProblemType === "open-ended") {
      if (newProblemKeywords.length === 0) {
        toast({
          title: "Missing keywords",
          description: "Please add at least one keyword for auto-grading the open-ended problem",
          variant: "destructive",
        })
        return
      }
    } else if (newProblemType === "geometric") {
      if (!newProblemGraphData || (!newProblemGraphData.points?.length && !newProblemGraphData.lines?.length)) {
        toast({
          title: "Missing graph data",
          description: "Please add at least one point or line to the graph for the correct answer",
          variant: "destructive",
        })
        return
      }
    }

    const newProblemId = generateId("problem_")
    const newProblem: any = {
      id: newProblemId,
      type: newProblemType,
      question: newProblemQuestion,
      points: newProblemPoints,
      explanation: newProblemExplanation,
    }

    // Add type-specific properties
    if (newProblemType === "multiple-choice") {
      newProblem.options = newProblemOptions
      newProblem.correctAnswer = newProblemCorrectAnswer
    } else if (newProblemType === "math-expression") {
      newProblem.correctAnswers = newProblemCorrectAnswers
      newProblem.tolerance = newProblemTolerance
    } else if (newProblemType === "open-ended") {
      newProblem.keywords = newProblemKeywords
      newProblem.allowPartialCredit = newProblemAllowPartialCredit
    } else if (newProblemType === "geometric") {
      newProblem.graphData = newProblemGraphData
      // Graph data structure: { points: [{x, y}], lines: [{start: {x, y}, end: {x, y}}] }
    }

    // Add max attempts - use default if not specified
    // currentContent is already defined above
    if (newProblemMaxAttempts !== null && newProblemMaxAttempts > 0) {
      newProblem.maxAttempts = newProblemMaxAttempts
    } else if (currentContent) {
      // Set default based on content type
      const contentType = currentContent.type
      if (contentType === "test" || contentType === "quiz") {
        newProblem.maxAttempts = 1
      } else {
        newProblem.maxAttempts = 5
      }
    }

    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === activeLesson) {
          return {
            ...lesson,
            contents: lesson.contents.map((content) => {
              if (content.id === activeContent) {
                return {
                  ...content,
                  problems: [...(content.problems || []), newProblem],
                }
              }
              return content
            }),
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)
    setActiveProblem(newProblemId)
    setIsAddingProblem(false)
    resetProblemForm()

    // Save to storage
    saveCurriculum()

    toast({
      title: "Problem added",
      description: `New ${newProblemType} problem has been added to the content`,
    })
  }

  // Reset problem form
  const resetProblemForm = () => {
    setNewProblemType("multiple-choice")
    setNewProblemQuestion("")
    setNewProblemOptions(["", "", "", ""])
    setNewProblemCorrectAnswer(0)
    setNewProblemCorrectAnswers([])
    setNewProblemExplanation("")
    setNewProblemPoints(3) // Default points
    setNewProblemKeywords([])
    setNewKeyword("")
    setNewProblemAllowPartialCredit(false)
    setNewProblemTolerance(0.01)
    setNewProblemGraphData({ points: [], lines: [] })
    // Set default attempts based on content type
    const currentContent = curriculum.lessons
      .find((l: any) => l.id === activeLesson)
      ?.contents?.find((c: any) => c.id === activeContent)
    if (currentContent) {
      const contentType = currentContent.type
      setNewProblemMaxAttempts(contentType === "test" || contentType === "quiz" ? 1 : 5)
    } else {
      setNewProblemMaxAttempts(5)
    }
  }

  // Update lesson
  const updateLesson = (lessonId: string, field: string, value: any) => {
    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === lessonId) {
          return {
            ...lesson,
            [field]: value,
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)
    saveCurriculum()
  }

  // Update content
  const updateContent = (lessonId: string, contentId: string, field: string, value: any) => {
    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === lessonId) {
          return {
            ...lesson,
            contents: lesson.contents.map((content) => {
              if (content.id === contentId) {
                return {
                  ...content,
                  [field]: value,
                }
              }
              return content
            }),
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)
    saveCurriculum()
  }

  // Update problem
  const updateProblem = (lessonId: string, contentId: string, problemId: string, field: string, value: any) => {
    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === lessonId) {
          return {
            ...lesson,
            contents: lesson.contents.map((content) => {
              if (content.id === contentId) {
                return {
                  ...content,
                  problems: content.problems.map((problem) => {
                    if (problem.id === problemId) {
                      return {
                        ...problem,
                        [field]: value,
                      }
                    }
                    return problem
                  }),
                }
              }
              return content
            }),
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)
    saveCurriculum()
  }

  // Delete lesson
  const handleDeleteLesson = () => {
    if (!lessonToDelete) return

    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.filter((lesson) => lesson.id !== lessonToDelete),
    }

    setCurriculum(updatedCurriculum)

    // Update active lesson if the deleted lesson was active
    if (activeLesson === lessonToDelete) {
      setActiveLesson(updatedCurriculum.lessons.length > 0 ? updatedCurriculum.lessons[0].id : null)
      setActiveContent(null)
      setActiveProblem(null)
    }

    setDeleteLessonDialogOpen(false)
    setLessonToDelete(null)
    saveCurriculum()

    toast({
      title: "Lesson deleted",
      description: "The lesson has been removed from the curriculum",
    })
  }

  // Delete content
  const handleDeleteContent = () => {
    if (!activeLesson || !contentToDelete) return

    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === activeLesson) {
          return {
            ...lesson,
            contents: lesson.contents.filter((content) => content.id !== contentToDelete),
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)

    // Update active content if the deleted content was active
    if (activeContent === contentToDelete) {
      const currentLesson = updatedCurriculum.lessons.find((lesson) => lesson.id === activeLesson)
      setActiveContent(currentLesson && currentLesson.contents.length > 0 ? currentLesson.contents[0].id : null)
      setActiveProblem(null)
    }

    setDeleteContentDialogOpen(false)
    setContentToDelete(null)
    saveCurriculum()

    toast({
      title: "Content deleted",
      description: "The content has been removed from the lesson",
    })
  }

  // Delete problem
  const handleDeleteProblem = () => {
    if (!activeLesson || !activeContent || !problemToDelete) return

    const updatedCurriculum = {
      ...curriculum,
      lessons: curriculum.lessons.map((lesson) => {
        if (lesson.id === activeLesson) {
          return {
            ...lesson,
            contents: lesson.contents.map((content) => {
              if (content.id === activeContent) {
                return {
                  ...content,
                  problems: content.problems.filter((problem) => problem.id !== problemToDelete),
                }
              }
              return content
            }),
          }
        }
        return lesson
      }),
    }

    setCurriculum(updatedCurriculum)

    // Update active problem if the deleted problem was active
    if (activeProblem === problemToDelete) {
      const currentLesson = updatedCurriculum.lessons.find((lesson) => lesson.id === activeLesson)
      const currentContent = currentLesson?.contents.find((content) => content.id === activeContent)
      setActiveProblem(currentContent && currentContent.problems.length > 0 ? currentContent.problems[0].id : null)
    }

    setDeleteProblemDialogOpen(false)
    setProblemToDelete(null)
    saveCurriculum()

    toast({
      title: "Problem deleted",
      description: "The problem has been removed from the content",
    })
  }

  // Add a correct answer for math expression
  const addCorrectAnswer = () => {
    if (!newProblemCorrectAnswers.includes(newKeyword) && newKeyword) {
      setNewProblemCorrectAnswers([...newProblemCorrectAnswers, newKeyword])
      setNewKeyword("")
    }
  }

  // Remove a correct answer for math expression
  const removeCorrectAnswer = (answer: string) => {
    setNewProblemCorrectAnswers(newProblemCorrectAnswers.filter((a) => a !== answer))
  }

  // Add a keyword for open-ended
  const addKeyword = () => {
    if (!newProblemKeywords.includes(newKeyword) && newKeyword) {
      setNewProblemKeywords([...newProblemKeywords, newKeyword])
      setNewKeyword("")
    }
  }

  // Remove a keyword for open-ended
  const removeKeyword = (keyword: string) => {
    setNewProblemKeywords(newProblemKeywords.filter((k) => k !== keyword))
  }

  // Get content type icon
  const getContentTypeIcon = (type: string) => {
    const contentType = contentTypes.find((ct) => ct.id === type)
    return contentType ? contentType.icon : <FileText className="w-4 h-4 mr-2" />
  }

  // Handle duplicate curriculum
  const handleDuplicateCurriculum = async () => {
    if (!selectedSourceClassId) {
      toast({
        title: "No class selected",
        description: "Please select a class to duplicate from",
        variant: "destructive",
      })
      return
    }

    try {
      // Load source curriculum
      const sourceCurriculum = await storage.getCurriculum(selectedSourceClassId)
      if (!sourceCurriculum) {
        toast({
          title: "No curriculum found",
          description: "The selected class does not have a curriculum to duplicate",
          variant: "destructive",
        })
        return
      }

      // Deep clone the curriculum and regenerate all IDs
      const duplicateCurriculum = (curriculum: any): any => {
        if (!curriculum) return null
        
        const cloned: any = { ...curriculum }
        
        if (cloned.lessons && Array.isArray(cloned.lessons)) {
          cloned.lessons = cloned.lessons.map((lesson: any) => {
            const newLesson = {
              ...lesson,
              id: generateId("lesson_"),
              contents: lesson.contents && Array.isArray(lesson.contents)
                ? lesson.contents.map((content: any) => {
                    const newContent = {
                      ...content,
                      id: generateId("content_"),
                      problems: content.problems && Array.isArray(content.problems)
                        ? content.problems.map((problem: any) => ({
                            ...problem,
                            id: generateId("problem_"),
                          }))
                        : [],
                    }
                    return newContent
                  })
                : [],
            }
            return newLesson
          })
        }
        
        return cloned
      }

      const formattedSource = sourceCurriculum.content || sourceCurriculum
      const duplicated = duplicateCurriculum(formattedSource)
      
      // Set the duplicated curriculum
      setCurriculum(duplicated)
      
      // Save it
      await saveCurriculum()
      
      setDuplicateDialogOpen(false)
      setSelectedSourceClassId("")
      
      toast({
        title: "Curriculum duplicated",
        description: "The curriculum has been successfully duplicated from the selected class",
      })
    } catch (error: any) {
      console.error("Error duplicating curriculum:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate curriculum",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading curriculum...</div>
  }

  if (!classData) {
    return <div className="flex items-center justify-center min-h-screen">Class not found</div>
  }

  const currentLesson = activeLesson ? curriculum.lessons.find((lesson) => lesson.id === activeLesson) : null
  const currentContent =
    activeContent && currentLesson ? currentLesson.contents.find((content) => content.id === activeContent) : null
  const currentProblem =
    activeProblem && currentContent ? currentContent.problems.find((problem) => problem.id === activeProblem) : null

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex-1">
        <div className="container p-6 mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">{classData.name} Curriculum</h1>
              <p className="text-muted-foreground">Teacher: {classData.teacher}</p>
            </div>
            <div className="flex space-x-2">
              <Button onClick={saveCurriculum}>
                <Save className="w-4 h-4 mr-2" />
                Save Curriculum
              </Button>
              <Button variant="outline" onClick={() => setDuplicateDialogOpen(true)}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate from Another Class
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin/dashboard?tab=classes")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Classes
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {/* Lessons sidebar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Lessons</h2>
                <Button size="sm" onClick={() => setIsAddingLesson(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Lesson
                </Button>
              </div>
              <div className="space-y-2">
                {curriculum.lessons && Array.isArray(curriculum.lessons) && curriculum.lessons.length > 0 ? (
                  curriculum.lessons.map((lesson) => (
                    <Card
                      key={lesson.id}
                      className={`cursor-pointer ${activeLesson === lesson.id ? "border-primary" : ""}`}
                      onClick={() => {
                        setActiveLesson(lesson.id)
                        setActiveContent(lesson.contents && Array.isArray(lesson.contents) && lesson.contents.length > 0 ? lesson.contents[0].id : null)
                        setActiveProblem(null)
                      }}
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm">{lesson.title || `Lesson ${lesson.id}`}</CardTitle>
                        <CardDescription className="text-xs">
                          {lesson.contents && Array.isArray(lesson.contents) ? lesson.contents.length : 0} content items
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="p-4 text-center border rounded-lg">
                    <p className="text-sm text-muted-foreground">No lessons yet. Click "Add Lesson" to get started.</p>
                  </div>
                )}
              </div>

              {/* Add Lesson Form */}
              {isAddingLesson && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add New Lesson</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="lesson-title">Lesson Title</Label>
                      <Input
                        id="lesson-title"
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(e.target.value)}
                        placeholder="Enter lesson title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lesson-topic">Topic (Visible to Teachers)</Label>
                      <Input
                        id="lesson-topic"
                        value={newLessonTopic}
                        onChange={(e) => setNewLessonTopic(e.target.value)}
                        placeholder="Enter lesson topic (e.g., Linear Equations)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lesson-description">Description (Optional)</Label>
                      <Textarea
                        id="lesson-description"
                        value={newLessonDescription}
                        onChange={(e) => setNewLessonDescription(e.target.value)}
                        placeholder="Enter lesson description (supports basic formatting)"
                        rows={6}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tip: Use **bold**, *italic*, - bullets, $$LaTeX$$ for math
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => setIsAddingLesson(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddLesson}>Add Lesson</Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            {/* Main content area */}
            <div className="md:col-span-3">
              {activeLesson ? (
                <div className="space-y-6">
                  {/* Lesson details */}
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <Input
                            value={currentLesson?.title || ""}
                            onChange={(e) => updateLesson(activeLesson, "title", e.target.value)}
                            className="text-xl font-bold"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2"
                            onClick={() => {
                              setLessonToDelete(activeLesson)
                              setDeleteLessonDialogOpen(true)
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lesson-topic-edit">Topic (Visible to Teachers)</Label>
                          <Input
                            id="lesson-topic-edit"
                            value={currentLesson?.topic || ""}
                            onChange={(e) => updateLesson(activeLesson, "topic", e.target.value)}
                            placeholder="Enter lesson topic"
                            className="mb-2"
                          />
                          <Label htmlFor="lesson-description-edit">Description</Label>
                          <Textarea
                            id="lesson-description-edit"
                            value={currentLesson?.description || ""}
                            onChange={(e) => updateLesson(activeLesson, "description", e.target.value)}
                            placeholder="Enter lesson description (supports basic formatting)"
                            className="text-muted-foreground font-mono text-sm"
                            rows={6}
                          />
                          <p className="text-xs text-muted-foreground">
                            Tip: Use **bold**, *italic*, - bullets, $$LaTeX$$ for math
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="published">Published</Label>
                          <Switch
                            id="published"
                            checked={currentContent?.isPublished || false}
                            onCheckedChange={(checked) =>
                              updateContent(activeLesson, activeContent, "isPublished", checked)
                            }
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Content</h3>
                        <Button size="sm" onClick={() => setIsAddingContent(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Content
                        </Button>
                      </div>

                      {/* Content list */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {currentLesson?.contents && Array.isArray(currentLesson.contents) && currentLesson.contents.length > 0 ? (
                          currentLesson.contents.map((content) => (
                            <Card
                              key={content.id}
                              className={`cursor-pointer ${activeContent === content.id ? "border-primary" : ""}`}
                              onClick={() => {
                                setActiveContent(content.id)
                                setActiveProblem(
                                  content.problems && Array.isArray(content.problems) && content.problems.length > 0 
                                    ? content.problems[0].id 
                                    : null,
                                )
                              }}
                            >
                              <CardHeader className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    {getContentTypeIcon(content.type)}
                                    <CardTitle className="text-sm">{content.title || 'Untitled Content'}</CardTitle>
                                  </div>
                                  <Badge variant={content.isPublished ? "default" : "outline"}>
                                    {content.isPublished ? "Published" : "Draft"}
                                  </Badge>
                                </div>
                                <CardDescription className="text-xs">
                                  {content.problems && Array.isArray(content.problems) ? content.problems.length : 0} problems
                                </CardDescription>
                              </CardHeader>
                            </Card>
                          ))
                        ) : (
                          <div className="p-4 text-center border rounded-lg md:col-span-2 lg:col-span-3">
                            <p className="text-sm text-muted-foreground">
                              No content yet. Click "Add Content" to get started.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Add Content Form */}
                      {isAddingContent && (
                        <Card className="mt-4">
                          <CardHeader>
                            <CardTitle>Add New Content</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="content-type">Content Type</Label>
                              <Select value={newContentType} onValueChange={setNewContentType}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select content type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {contentTypes && Array.isArray(contentTypes) && contentTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                      <div className="flex items-center">
                                        {type.icon}
                                        {type.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="content-title">Title</Label>
                              <Input
                                id="content-title"
                                value={newContentTitle}
                                onChange={(e) => setNewContentTitle(e.target.value)}
                                placeholder="Enter content title"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="content-description">Description (Optional)</Label>
                              <Textarea
                                id="content-description"
                                value={newContentDescription}
                                onChange={(e) => setNewContentDescription(e.target.value)}
                                placeholder="Enter content description"
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="content-teachers-instructions">Teacher's Instructions (Visible to Teachers Only)</Label>
                              <Textarea
                                id="content-teachers-instructions"
                                value={newContentTeachersInstructions}
                                onChange={(e) => setNewContentTeachersInstructions(e.target.value)}
                                placeholder="Enter instructions for teachers (supports basic formatting)"
                                rows={8}
                                className="font-mono text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Tip: Use **bold**, *italic*, - bullets, $$LaTeX$$ for math
                              </p>
                            </div>
                          </CardContent>
                          <CardFooter className="flex justify-between">
                            <Button variant="outline" onClick={() => setIsAddingContent(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddContent}>Add Content</Button>
                          </CardFooter>
                        </Card>
                      )}
                    </CardContent>
                  </Card>

                  {/* Content details */}
                  {activeContent && currentContent && (
                    <Card>
                      <CardHeader className="flex flex-row items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            {getContentTypeIcon(currentContent.type)}
                            <Input
                              value={currentContent.title || ""}
                              onChange={(e) => updateContent(activeLesson, activeContent, "title", e.target.value)}
                              className="text-xl font-bold"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2"
                              onClick={() => {
                                setContentToDelete(activeContent)
                                setDeleteContentDialogOpen(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                          <Textarea
                            value={currentContent.description || ""}
                            onChange={(e) => updateContent(activeLesson, activeContent, "description", e.target.value)}
                            placeholder="Enter content description (supports basic formatting)"
                            className="text-muted-foreground font-mono text-sm"
                            rows={4}
                          />
                          <p className="text-xs text-muted-foreground">
                            Tip: Use **bold**, *italic*, - bullets, $$LaTeX$$ for math
                          </p>
                          <div className="mt-4 space-y-2">
                            <Label htmlFor="content-teachers-instructions-edit">Teacher's Instructions (Visible to Teachers Only)</Label>
                            <Textarea
                              id="content-teachers-instructions-edit"
                              value={currentContent.teachersInstructions || ""}
                              onChange={(e) => updateContent(activeLesson, activeContent, "teachersInstructions", e.target.value)}
                              placeholder="Enter instructions for teachers (supports basic formatting)"
                              className="font-mono text-sm"
                              rows={8}
                            />
                            <p className="text-xs text-muted-foreground">
                              Tip: Use **bold**, *italic*, - bullets, $$LaTeX$$ for math
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="published">Published</Label>
                            <Switch
                              id="published"
                              checked={currentContent.isPublished || false}
                              onCheckedChange={(checked) =>
                                updateContent(activeLesson, activeContent, "isPublished", checked)
                              }
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Problems</h3>
                          <Button size="sm" onClick={() => setIsAddingProblem(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Problem
                          </Button>
                        </div>

                        {/* Problems list */}
                        <div className="space-y-4">
                          {currentContent.problems && Array.isArray(currentContent.problems) && currentContent.problems.length > 0 ? (
                            currentContent.problems.map((problem, index) => (
                              <Card
                                key={problem.id}
                                className={`cursor-pointer ${activeProblem === problem.id ? "border-primary" : ""}`}
                                onClick={() => setActiveProblem(problem.id)}
                              >
                                <CardHeader className="p-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">Problem {index + 1}</CardTitle>
                                    <Badge variant="outline">
                                      {problemTypes.find((pt) => pt.id === problem.type)?.name || "Problem"}
                                    </Badge>
                                  </div>
                                  <CardDescription className="text-xs line-clamp-2">{problem.question}</CardDescription>
                                </CardHeader>
                              </Card>
                            ))
                          ) : (
                            <div className="p-4 text-center border rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                No problems yet. Click "Add Problem" to get started.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Add Problem Form */}
                        {isAddingProblem && (
                          <Card className="mt-4">
                            <CardHeader>
                              <CardTitle>Add New Problem</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="problem-type">Problem Type</Label>
                                <Select value={newProblemType} onValueChange={setNewProblemType}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select problem type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {problemTypes.map((type) => (
                                      <SelectItem key={type.id} value={type.id}>
                                        {type.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="problem-question">Question</Label>
                                <Textarea
                                  id="problem-question"
                                  value={newProblemQuestion}
                                  onChange={(e) => setNewProblemQuestion(e.target.value)}
                                  placeholder="Enter problem question (supports LaTeX with $$ delimiters)"
                                  rows={3}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Use $$....$$ to include LaTeX math expressions
                                </p>
                              </div>

                              {/* Multiple choice options */}
                              {newProblemType === "multiple-choice" && (
                                <div className="space-y-4">
                                  <Label>Options</Label>
                                  {newProblemOptions.map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <input
                                        type="radio"
                                        id={`option-${index}`}
                                        name="correct-option"
                                        checked={newProblemCorrectAnswer === index}
                                        onChange={() => setNewProblemCorrectAnswer(index)}
                                        className="w-4 h-4"
                                      />
                                      <Input
                                        value={option}
                                        onChange={(e) => {
                                          const newOptions = [...newProblemOptions]
                                          newOptions[index] = e.target.value
                                          setNewProblemOptions(newOptions)
                                        }}
                                        placeholder={`Option ${index + 1}`}
                                        className="flex-1"
                                      />
                                    </div>
                                  ))}
                                  <p className="text-xs text-muted-foreground">
                                    Select the radio button next to the correct answer
                                  </p>
                                </div>
                              )}

                              {/* Math expression options */}
                              {newProblemType === "math-expression" && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Correct Answers</Label>
                                    <div className="flex space-x-2">
                                      <Input
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        placeholder="Enter a correct answer"
                                        className="flex-1"
                                      />
                                      <Button type="button" onClick={addCorrectAnswer}>
                                        Add
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {newProblemCorrectAnswers.map((answer, index) => (
                                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                          {answer}
                                          <X
                                            className="w-3 h-3 cursor-pointer"
                                            onClick={() => removeCorrectAnswer(answer)}
                                          />
                                        </Badge>
                                      ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Add multiple correct answers for equivalent expressions
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="tolerance">Numerical Tolerance</Label>
                                    <Input
                                      id="tolerance"
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      value={newProblemTolerance}
                                      onChange={(e) => setNewProblemTolerance(Number(e.target.value))}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Acceptable margin of error for numerical answers
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Open-ended options */}
                              {newProblemType === "open-ended" && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Keywords for Auto-grading</Label>
                                    <div className="flex space-x-2">
                                      <Input
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        placeholder="Enter a keyword"
                                        className="flex-1"
                                      />
                                      <Button type="button" onClick={addKeyword}>
                                        Add
                                      </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {newProblemKeywords.map((keyword, index) => (
                                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                          {keyword}
                                          <X
                                            className="w-3 h-3 cursor-pointer"
                                            onClick={() => removeKeyword(keyword)}
                                          />
                                        </Badge>
                                      ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      Keywords will be used to auto-grade open-ended responses
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Switch
                                      id="partial-credit"
                                      checked={newProblemAllowPartialCredit}
                                      onCheckedChange={setNewProblemAllowPartialCredit}
                                    />
                                    <Label htmlFor="partial-credit">Allow partial credit</Label>
                                  </div>
                                </div>
                              )}

                              {/* Geometric/Graphing options */}
                              {newProblemType === "geometric" && (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label>Draw Correct Answer on Graph</Label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                      Use the buttons below to add points or draw lines. Click on the graph to place elements.
                                    </p>
                                    <GraphEditor
                                      value={newProblemGraphData}
                                      onChange={(data) => setNewProblemGraphData(data)}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label htmlFor="problem-points">Points (Default: 3)</Label>
                                <Input
                                  id="problem-points"
                                  type="number"
                                  min="1"
                                  value={newProblemPoints}
                                  onChange={(e) => setNewProblemPoints(Number(e.target.value))}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="problem-max-attempts">
                                  Max Attempts (Default: {(() => {
                                    const currentContent = curriculum.lessons
                                      .find((l: any) => l.id === activeLesson)
                                      ?.contents?.find((c: any) => c.id === activeContent)
                                    if (currentContent) {
                                      const contentType = currentContent.type
                                      return contentType === "test" || contentType === "quiz" ? "1" : "5"
                                    }
                                    return "5"
                                  })()})
                                </Label>
                                <Input
                                  id="problem-max-attempts"
                                  type="number"
                                  min="1"
                                  value={newProblemMaxAttempts === null ? "" : newProblemMaxAttempts}
                                  onChange={(e) => {
                                    const value = e.target.value === "" ? null : Number(e.target.value)
                                    setNewProblemMaxAttempts(value)
                                  }}
                                  placeholder="Auto-set based on content type if blank"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Default: 5 attempts for most content, 1 for tests/quizzes
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="problem-explanation">Explanation (Optional)</Label>
                                <Textarea
                                  id="problem-explanation"
                                  value={newProblemExplanation}
                                  onChange={(e) => setNewProblemExplanation(e.target.value)}
                                  placeholder="Explanation shown after submission"
                                  rows={3}
                                />
                              </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                              <Button variant="outline" onClick={() => setIsAddingProblem(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleAddProblem}>Add Problem</Button>
                            </CardFooter>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Problem details */}
                  {activeProblem && currentProblem && (
                    <Card>
                      <CardHeader className="flex flex-row items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <h3 className="text-xl font-bold">Problem Details</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2"
                              onClick={() => {
                                setProblemToDelete(activeProblem)
                                setDeleteProblemDialogOpen(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                          <p className="text-muted-foreground">
                            {problemTypes.find((pt) => pt.id === currentProblem.type)?.name || "Problem"} -
                            {currentProblem.points} points
                            {currentProblem.maxAttempts ? ` - Max ${currentProblem.maxAttempts} attempts` : ""}
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-2">
                          <Label>Question</Label>
                          <Textarea
                            value={currentProblem.question}
                            onChange={(e) =>
                              updateProblem(activeLesson, activeContent, activeProblem, "question", e.target.value)
                            }
                            rows={3}
                          />
                        </div>

                        {/* Multiple choice options */}
                        {currentProblem.type === "multiple-choice" && (
                          <div className="space-y-4">
                            <Label>Options</Label>
                            {currentProblem.options && Array.isArray(currentProblem.options) ? currentProblem.options.map((option, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id={`edit-option-${index}`}
                                  name="edit-correct-option"
                                  checked={currentProblem.correctAnswer === index}
                                  onChange={() =>
                                    updateProblem(activeLesson, activeContent, activeProblem, "correctAnswer", index)
                                  }
                                  className="w-4 h-4"
                                />
                                <Input
                                  value={option || ''}
                                  onChange={(e) => {
                                    const newOptions = currentProblem.options ? [...currentProblem.options] : ['', '', '', ''];
                                    newOptions[index] = e.target.value;
                                    updateProblem(activeLesson, activeContent, activeProblem, "options", newOptions);
                                  }}
                                  className="flex-1"
                                />
                              </div>
                            )) : (
                              <p className="text-sm text-muted-foreground">No options available</p>
                            )}
                          </div>
                        )}

                        {/* Math expression options */}
                        {currentProblem.type === "math-expression" && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Correct Answers</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {currentProblem.correctAnswers && Array.isArray(currentProblem.correctAnswers) 
                                  ? currentProblem.correctAnswers.map((answer, index) => (
                                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                        {answer}
                                        <X
                                          className="w-3 h-3 cursor-pointer"
                                          onClick={() => {
                                            if (currentProblem.correctAnswers) {
                                              const newAnswers = [...currentProblem.correctAnswers];
                                              newAnswers.splice(index, 1);
                                              updateProblem(
                                                activeLesson,
                                                activeContent,
                                                activeProblem,
                                                "correctAnswers",
                                                newAnswers,
                                              );
                                            }
                                          }}
                                        />
                                      </Badge>
                                    ))
                                  : null}
                              </div>
                              <div className="flex space-x-2 mt-2">
                                <Input
                                  value={newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  placeholder="Add another correct answer"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  onClick={() => {
                                    if (newKeyword) {
                                      const newAnswers = [...(currentProblem.correctAnswers || [])]
                                      newAnswers.push(newKeyword)
                                      updateProblem(
                                        activeLesson,
                                        activeContent,
                                        activeProblem,
                                        "correctAnswers",
                                        newAnswers,
                                      )
                                      setNewKeyword("")
                                    }
                                  }}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-tolerance">Numerical Tolerance</Label>
                              <Input
                                id="edit-tolerance"
                                type="number"
                                step="0.001"
                                min="0"
                                value={currentProblem.tolerance}
                                onChange={(e) =>
                                  updateProblem(
                                    activeLesson,
                                    activeContent,
                                    activeProblem,
                                    "tolerance",
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Open-ended options */}
                        {currentProblem.type === "open-ended" && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Keywords for Auto-grading</Label>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {currentProblem.keywords && Array.isArray(currentProblem.keywords) 
                                  ? currentProblem.keywords.map((keyword, index) => (
                                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                        {keyword}
                                        <X
                                          className="w-3 h-3 cursor-pointer"
                                          onClick={() => {
                                            if (currentProblem.keywords) {
                                              const newKeywords = [...currentProblem.keywords];
                                              newKeywords.splice(index, 1);
                                              updateProblem(
                                                activeLesson,
                                                activeContent,
                                                activeProblem,
                                                "keywords",
                                                newKeywords,
                                              );
                                            }
                                          }}
                                        />
                                      </Badge>
                                    ))
                                  : null}
                              </div>
                              <div className="flex space-x-2 mt-2">
                                <Input
                                  value={newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  placeholder="Add another keyword"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  onClick={() => {
                                    if (newKeyword) {
                                      const newKeywords = [...(currentProblem.keywords || [])]
                                      newKeywords.push(newKeyword)
                                      updateProblem(activeLesson, activeContent, activeProblem, "keywords", newKeywords)
                                      setNewKeyword("")
                                    }
                                  }}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="edit-partial-credit"
                                checked={currentProblem.allowPartialCredit || false}
                                onCheckedChange={(checked) =>
                                  updateProblem(
                                    activeLesson,
                                    activeContent,
                                    activeProblem,
                                    "allowPartialCredit",
                                    checked,
                                  )
                                }
                              />
                              <Label htmlFor="edit-partial-credit">Allow partial credit</Label>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="edit-points">Points</Label>
                          <Input
                            id="edit-points"
                            type="number"
                            min="1"
                            value={currentProblem.points}
                            onChange={(e) =>
                              updateProblem(
                                activeLesson,
                                activeContent,
                                activeProblem,
                                "points",
                                Number(e.target.value),
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-max-attempts">Max Attempts (Optional)</Label>
                          <Input
                            id="edit-max-attempts"
                            type="number"
                            min="1"
                            value={currentProblem.maxAttempts || ""}
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : Number(e.target.value)
                              updateProblem(activeLesson, activeContent, activeProblem, "maxAttempts", value)
                            }}
                            placeholder="Unlimited if blank"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="edit-explanation">Explanation (Optional)</Label>
                          <Textarea
                            id="edit-explanation"
                            value={currentProblem.explanation || ""}
                            onChange={(e) =>
                              updateProblem(activeLesson, activeContent, activeProblem, "explanation", e.target.value)
                            }
                            placeholder="Explanation shown after submission"
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 border rounded-lg">
                  <div className="text-center">
                    <h3 className="mb-2 text-lg font-semibold">No Lesson Selected</h3>
                    <p className="mb-4 text-muted-foreground">
                      Select a lesson from the sidebar or create a new one to get started.
                    </p>
                    <Button onClick={() => setIsAddingLesson(true)}>Create First Lesson</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Lesson Dialog */}
      <AlertDialog open={deleteLessonDialogOpen} onOpenChange={setDeleteLessonDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lesson? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteLessonDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLesson} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Content Dialog */}
      <AlertDialog open={deleteContentDialogOpen} onOpenChange={setDeleteContentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this content? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteContentDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContent} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Problem Dialog */}
      <AlertDialog open={deleteProblemDialogOpen} onOpenChange={setDeleteProblemDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Problem</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this problem? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteProblemDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProblem} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Curriculum Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Curriculum from Another Class</DialogTitle>
            <DialogDescription>
              Select a class to copy its curriculum. All lessons, content, and problems will be duplicated with new IDs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="source-class">Source Class</Label>
              <Select value={selectedSourceClassId} onValueChange={setSelectedSourceClassId}>
                <SelectTrigger id="source-class">
                  <SelectValue placeholder="Select a class to duplicate from" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} - {cls.teacher}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {availableClasses.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No other classes available to duplicate from.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDuplicateDialogOpen(false)
              setSelectedSourceClassId("")
            }}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateCurriculum} disabled={!selectedSourceClassId || availableClasses.length === 0}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicate Curriculum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
