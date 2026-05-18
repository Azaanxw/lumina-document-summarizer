"use client"

import { useEffect, useState } from "react"
import { processDocument, clearSummaryCache, type QuizQuestion } from "@/lib/api"
import { friendlyError } from "@/lib/errors"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"

interface SummaryViewProps {
  documentId: string
}

export function SummaryView({ documentId }: SummaryViewProps) {
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState("")
  const [quiz, setQuiz] = useState<QuizQuestion[]>([])

  function load() {
    let cancelled = false
    setLoading(true)
    setError("")
    processDocument(documentId)
      .then((data) => {
        if (cancelled) return
        setSummary(data.summary)
        setQuiz(data.quiz)
      })
      .catch((err) => {
        if (cancelled) return
        setError(friendlyError(err instanceof Error ? err.message : "", "Failed to load the summary. Please try again."))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(load, [documentId])

  async function handleClearCache() {
    setClearing(true)
    try {
      await clearSummaryCache(documentId)
      load()
    } catch {
      // silently ignore — next load will retry
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
        <div className="relative flex items-center justify-center">
          <div className="size-14 rounded-full border-4 border-muted" />
          <div className="absolute size-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Analysing your document…</p>
          <p className="text-xs text-muted-foreground">Generating summary and quiz questions</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!summary && quiz.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No content could be generated for this document.</p>
  }

  return (
    <div className="space-y-10 py-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Summary</h2>
          {process.env.NODE_ENV === "development" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCache}
              disabled={clearing}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className={`size-3 ${clearing ? "animate-spin" : ""}`} />
              Clear cache
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <StructuredSummary text={summary} />
        </div>
      </section>

      {quiz.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Quiz</h2>
          <QuizCarousel questions={quiz} />
        </section>
      )}
    </div>
  )
}

function StructuredSummary({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "")
  const elements: React.ReactNode[] = []
  let bullets: string[] = []
  let key = 0

  function flushBullets() {
    if (bullets.length === 0) return
    elements.push(
      <ul key={key++} className="space-y-1.5 ml-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="text-foreground">{b}</span>
          </li>
        ))}
      </ul>
    )
    bullets = []
  }

  for (const line of lines) {
    const header = line.match(/^\*\*(.+)\*\*$/)
    if (header) {
      flushBullets()
      elements.push(
        <h3 key={key++} className="pt-3 text-sm font-semibold text-foreground first:pt-0">
          {header[1]}
        </h3>
      )
    } else if (line.startsWith("- ")) {
      bullets.push(line.slice(2))
    } else {
      flushBullets()
      elements.push(
        <p key={key++} className="text-sm text-foreground leading-relaxed">
          {line}
        </p>
      )
    }
  }
  flushBullets()

  return <>{elements}</>
}

function QuizCarousel({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const question = questions[index]
  const selected = answers[index] ?? null
  const total = questions.length

  function choose(opt: string) {
    if (answers[index]) return
    setAnswers((prev) => ({ ...prev, [index]: opt }))
  }

  const letter = (opt: string) => opt.split(")")[0]?.trim() ?? opt

  const score = Object.entries(answers).filter(
    ([i, ans]) => letter(ans) === letter(questions[Number(i)].answer)
  ).length

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            {index + 1} / {total}
          </span>
          <span className="text-xs text-muted-foreground">
            {Object.keys(answers).length} answered · {score} correct
          </span>
        </div>

        {/* Question */}
        <p className="text-sm font-medium leading-snug">{question.question}</p>

        {/* Options */}
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
                  revealed && "select-text cursor-text",
                  revealed && isCorrect && "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
                  revealed && isSelected && !isCorrect && "border-destructive bg-destructive/10 text-destructive",
                  revealed && !isSelected && !isCorrect && "border-border text-muted-foreground"
                )}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Correct answer hint */}
        {selected && letter(selected) !== letter(question.answer) && (
          <p className="text-xs text-muted-foreground">
            Correct answer: <span className="font-medium text-foreground">{question.answer}</span>
          </p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => i - 1)}
            disabled={index === 0}
          >
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIndex((i) => i + 1)}
            disabled={index === total - 1}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
