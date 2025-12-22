"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { aiService, type AIGenerateOptions } from "@/lib/ai-service"

interface AIGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "lesson" | "content" | "problem"
  onGenerate: (data: any) => void
  context?: string
  contentType?: string
  problemType?: string
}

export function AIGenerateDialog({
  open,
  onOpenChange,
  type,
  onGenerate,
  context,
  contentType,
  problemType,
}: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [additionalContext, setAdditionalContext] = useState("")
  const [gradeLevel, setGradeLevel] = useState("")
  const [subject, setSubject] = useState("")
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    try {
      const options: AIGenerateOptions = {
        contentType,
        problemType,
        gradeLevel: gradeLevel || undefined,
        subject: subject || undefined,
      }

      const fullContext = context
        ? `${context}\n\n${additionalContext}`
        : additionalContext || undefined

      let result
      switch (type) {
        case "lesson":
          result = await aiService.generateLesson(prompt, fullContext, options)
          break
        case "content":
          result = await aiService.generateContent(prompt, fullContext, options)
          break
        case "problem":
          result = await aiService.generateProblem(prompt, fullContext, options)
          break
      }

      onGenerate(result)
      setPrompt("")
      setAdditionalContext("")
      onOpenChange(false)
      
      toast({
        title: "Success",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} generated successfully!`,
      })
    } catch (error: any) {
      console.error("AI generation error:", error)
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getTitle = () => {
    switch (type) {
      case "lesson":
        return "Generate Lesson with AI"
      case "content":
        return "Generate Content with AI"
      case "problem":
        return "Generate Problem with AI"
    }
  }

  const getDescription = () => {
    switch (type) {
      case "lesson":
        return "Describe what you want to teach, and AI will generate a complete lesson plan."
      case "content":
        return "Describe the content you need, and AI will generate educational content with problems."
      case "problem":
        return "Describe the problem you need, and AI will generate a question with answer and explanation."
    }
  }

  const getPlaceholder = () => {
    switch (type) {
      case "lesson":
        return "e.g., Introduction to Algebra for 8th grade students"
      case "content":
        return "e.g., Practice problems for solving quadratic equations"
      case "problem":
        return "e.g., A multiple choice question about the Pythagorean theorem"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">What would you like to generate?</Label>
            <Textarea
              id="prompt"
              placeholder={getPlaceholder()}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {(type === "content" || type === "problem") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gradeLevel">Grade Level (Optional)</Label>
                <Input
                  id="gradeLevel"
                  placeholder="e.g., 8th grade"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject (Optional)</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Mathematics"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              placeholder="Any additional information that might help..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
              disabled={isGenerating}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

