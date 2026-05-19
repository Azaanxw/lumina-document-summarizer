"use client"

import { useEffect, useRef, useState } from "react"
import { askQuestion, RateLimitError, type Citation } from "@/lib/api"
import { friendlyError } from "@/lib/errors"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CitationBadge } from "@/components/citation-badge"
import { Send } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
  question: string
  answer?: string
  citations?: Citation[]
  error?: string
}

interface QAChatProps {
  documentId: string
  onCitationClick?: (pageNumber: number, snippets: string[]) => void
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function QAChat({ documentId, onCitationClick }: QAChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Countdown ticker
  useEffect(() => {
    if (!rateLimitedUntil) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((rateLimitedUntil - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) setRateLimitedUntil(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [rateLimitedUntil])

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading || rateLimitedUntil) return

    setInput("")
    setLoading(true)

    setMessages((prev) => [...prev, { question }])
    scrollToBottom()

    try {
      const result = await askQuestion(documentId, question)
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1
            ? { ...msg, answer: result.answer, citations: result.citations }
            : msg
        )
      )
      scrollToBottom()
    } catch (err) {
      if (err instanceof RateLimitError) {
        // Remove the pending message and return the question to the input
        setMessages((prev) => prev.slice(0, -1))
        setInput(question)
        setRateLimitedUntil(Date.now() + err.retryAfter * 1000)
      } else {
        const raw = err instanceof Error ? err.message : ""
        setMessages((prev) =>
          prev.map((msg, i) =>
            i === prev.length - 1
              ? { ...msg, error: friendlyError(raw, "Failed to get an answer. Please try again.") }
              : msg
          )
        )
        scrollToBottom()
      }
    } finally {
      setLoading(false)
    }
  }

  const isRateLimited = !!rateLimitedUntil

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {messages.length === 0 ? (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-sm text-foreground leading-relaxed">
            <GreetingText />
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0 rounded-xl border bg-muted/20 p-4">
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className="space-y-2">
                {/* User bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {msg.question}
                  </div>
                </div>

                {/* Bot bubble */}
                <div className="flex justify-start">
                  <div className="max-w-[90%] space-y-2">
                    {msg.error ? (
                      <div className="rounded-2xl rounded-tl-sm border border-dashed px-4 py-2.5 text-sm text-muted-foreground italic">
                        {msg.error}
                      </div>
                    ) : (
                      <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-sm text-foreground leading-relaxed">
                        {msg.answer === undefined ? <TypingIndicator /> : msg.answer}
                      </div>
                    )}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {Object.entries(
                          msg.citations.reduce<Record<number, string[]>>((acc, c) => {
                            ;(acc[c.page_number] ??= []).push(c.snippet)
                            return acc
                          }, {})
                        ).map(([page, snippets]) => (
                          <CitationBadge
                            key={page}
                            pageNumber={Number(page)}
                            snippets={snippets}
                            onClick={onCitationClick ? () => onCitationClick(Number(page), snippets) : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRateLimited ? "Rate limit reached…" : "Ask a question…"}
          disabled={loading || isRateLimited}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || isRateLimited || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>

      {isRateLimited && (
        <p className="text-xs text-muted-foreground text-center">
          You&apos;ve asked 20 questions this hour. Come back in{" "}
          <span className="font-medium tabular-nums">{formatCountdown(secondsLeft)}</span> to continue.
        </p>
      )}
    </div>
  )
}

function GreetingText() {
  const full = "Ask me anything about this document."
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(interval)
        setTimeout(() => setDone(true), 800)
      }
    }, 75)
    return () => clearInterval(interval)
  }, [])

  return (
    <span>
      {displayed}
      {!done && (
        <span className="ml-0.5 inline-block w-0.5 h-3.5 align-middle bg-foreground/60 animate-pulse" />
      )}
    </span>
  )
}

function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </span>
  )
}
