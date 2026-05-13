"use client"

import { useEffect, useState } from "react"
import { processDocument, type QuizQuestion } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SummaryViewProps {
  documentId: string
}

export function SummaryView({ documentId }: SummaryViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState("")
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])

  useEffect(() => {
    let cancelled = false
    processDocument(documentId)
      .then((data) => {
        if (cancelled) return
        setSummary(data.summary)
        setQuiz(data.quiz)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [documentId])

  if (loading) {
    return (
      <div className="space-y-4 py-6">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  if (error) {
    return <p className="py-6 text-sm text-destructive">{error}</p>
  }

  if (!summary && quiz.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No content could be generated for this document.</p>
  }

  return (
    <div className="space-y-10 py-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Summary</h2>
        <div className="space-y-3 text-sm text-foreground leading-relaxed">
          {summary.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {quiz.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Quiz</h2>
          <div className="space-y-4">
            {quiz.map((q, i) => (
              <QuizCard key={i} index={i} question={q} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function QuizCard({ index, question }: { index: number; question: QuizQuestion }) {
  const [selected, setSelected] = useState<string | null>(null)

  function choose(opt: string) {
    if (selected) return
    setSelected(opt)
  }

  const letter = (opt: string) => opt.split(")")[0]?.trim() ?? opt

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <p className="text-sm font-medium">
          {index + 1}. {question.question}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {question.options.map((opt) => {
            const isSelected = selected === opt
            const isCorrect = letter(opt) === letter(question.answer)
            const revealed = selected !== null

            return (
              <button
                key={opt}
                onClick={() => choose(opt)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  !revealed && "border-border hover:bg-muted cursor-pointer",
                  revealed && isCorrect && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                  revealed && isSelected && !isCorrect && "border-destructive bg-destructive/10 text-destructive",
                  revealed && !isSelected && !isCorrect && "border-border text-muted-foreground cursor-default"
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>
        {selected && letter(selected) !== letter(question.answer) && (
          <p className="text-xs text-muted-foreground">
            Correct answer: <span className="font-medium text-foreground">{question.answer}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
