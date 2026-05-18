"use client"

import { useEffect, useState } from "react"
import { generateCards, clearFlashcardsCache, type Flashcard } from "@/lib/api"
import { friendlyError } from "@/lib/errors"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface FlashcardDeckProps {
  documentId: string
  initialCards?: Flashcard[]
}

export function FlashcardDeck({ documentId, initialCards }: FlashcardDeckProps) {
  const [loading, setLoading] = useState(!initialCards)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState("")
  const [cards, setCards] = useState<Flashcard[]>(initialCards ?? [])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  function load() {
    let cancelled = false
    setLoading(true)
    setError("")
    generateCards(documentId)
      .then((data) => { if (!cancelled) setCards(data.flashcards) })
      .catch((err) => { if (!cancelled) setError(friendlyError(err instanceof Error ? err.message : "", "Failed to load flashcards. Please try again.")) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => {
    if (!initialCards) return load()
  }, [documentId])

  async function handleClearCache() {
    setClearing(true)
    try {
      await clearFlashcardsCache(documentId)
      setIndex(0)
      setFlipped(false)
      load()
    } catch {
      // silently ignore
    } finally {
      setClearing(false)
    }
  }

  function go(dir: -1 | 1) {
    setFlipped(false)
    setIndex((i) => Math.max(0, Math.min(cards.length - 1, i + dir)))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <Skeleton className="h-52 w-full max-w-lg rounded-2xl" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
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

  if (cards.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No flashcards generated.</p>
  }

  const card = cards[index]

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex w-full items-center justify-between">
        <p className="text-sm text-muted-foreground">{index + 1} / {cards.length}</p>
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

      <div
        className="relative w-full max-w-lg cursor-pointer"
        style={{ perspective: "1000px", height: "220px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="absolute inset-0 transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-8 py-6 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Question</p>
            <p className="text-base font-medium text-foreground">{card.question}</p>
            <p className="text-xs text-muted-foreground mt-2">Click to reveal answer</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border bg-primary/5 px-8 py-6 text-center shadow-sm"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Answer</p>
            <p className="text-base text-foreground">{card.answer}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={index === 0}>
          <ChevronLeft className="size-4" />
          Prev
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setFlipped(false); setIndex(0) }}
          className={cn("text-muted-foreground", index === 0 && !flipped && "invisible")}
        >
          <RotateCcw className="size-3.5" />
          Restart
        </Button>

        <Button variant="outline" size="sm" onClick={() => go(1)} disabled={index === cards.length - 1}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
