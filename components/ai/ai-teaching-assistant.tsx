"use client"

import { useState } from "react"
import { Sparkles, Loader2, Lightbulb, AlertTriangle, Users, ClipboardCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { aiService } from "@/lib/ai-service"
import { Badge } from "@/components/ui/badge"

interface AITeachingAssistantProps {
  contentTitle?: string
  contentDescription?: string
  lessonTitle?: string
}

export function AITeachingAssistant({
  contentTitle,
  contentDescription,
  lessonTitle,
}: AITeachingAssistantProps) {
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [assistantData, setAssistantData] = useState<any>(null)
  const { toast } = useToast()

  const handleGetAssistance = async () => {
    if (!prompt.trim() && !contentTitle) {
      toast({
        title: "Error",
        description: "Please enter a question or select content",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const context = [
        lessonTitle && `Lesson: ${lessonTitle}`,
        contentTitle && `Content: ${contentTitle}`,
        contentDescription && `Description: ${contentDescription}`,
      ]
        .filter(Boolean)
        .join("\n")

      const fullPrompt = prompt || `Help me teach: ${contentTitle || lessonTitle || "this content"}`

      const result = await aiService.getTeachingAssistant(fullPrompt, context)
      setAssistantData(result)
      
      toast({
        title: "Success",
        description: "Teaching assistance generated!",
      })
    } catch (error: any) {
      console.error("AI teaching assistant error:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to get teaching assistance. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt)
    handleGetAssistance()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Teaching Assistant
        </CardTitle>
        <CardDescription>
          Get AI-powered teaching strategies, common misconceptions, and engagement tips
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assistant-prompt">What do you need help with?</Label>
          <Textarea
            id="assistant-prompt"
            placeholder={
              contentTitle
                ? `Ask about teaching "${contentTitle}"...`
                : "Ask a question about teaching this content..."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt("What are common student misconceptions?")}
            disabled={isLoading}
          >
            Common Misconceptions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt("How can I engage students?")}
            disabled={isLoading}
          >
            Engagement Tips
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt("What teaching strategies work best?")}
            disabled={isLoading}
          >
            Teaching Strategies
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt("How should I assess understanding?")}
            disabled={isLoading}
          >
            Assessment Ideas
          </Button>
        </div>

        <Button
          onClick={handleGetAssistance}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting Assistance...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Get AI Assistance
            </>
          )}
        </Button>

        {assistantData && (
          <div className="space-y-4 mt-4 pt-4 border-t">
            {assistantData.suggestions && assistantData.suggestions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h4 className="font-semibold">Teaching Suggestions</h4>
                </div>
                <ul className="space-y-1 text-sm">
                  {assistantData.suggestions.map((suggestion: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assistantData.misconceptions && assistantData.misconceptions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h4 className="font-semibold">Common Misconceptions</h4>
                </div>
                <ul className="space-y-1 text-sm">
                  {assistantData.misconceptions.map((misconception: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{misconception}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assistantData.engagementTips && assistantData.engagementTips.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <h4 className="font-semibold">Engagement Tips</h4>
                </div>
                <ul className="space-y-1 text-sm">
                  {assistantData.engagementTips.map((tip: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {assistantData.assessmentIdeas && assistantData.assessmentIdeas.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardCheck className="h-4 w-4 text-green-500" />
                  <h4 className="font-semibold">Assessment Ideas</h4>
                </div>
                <ul className="space-y-1 text-sm">
                  {assistantData.assessmentIdeas.map((idea: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

