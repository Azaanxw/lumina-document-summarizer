"use client"

import { useRef, useState } from "react"
import { askQuestion, type Citation } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CitationBadge } from "@/components/citation-badge"
import { Loader2, Send } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Message {
  question: string
  answer: string
  citations: Citation[]
}

interface QAChatProps {
  documentId: string
  compact?: boolean
  onCitationClick?: (pageNumber: number, snippet: string) => void
}

export function QAChat({ documentId, compact, onCitationClick }: QAChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return
    setInput("")
    setError("")
    setLoading(true)
    try {
      const result = await askQuestion(documentId, question)
      setMessages((prev) => [...prev, { question, answer: result.answer, citations: result.citations }])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <ScrollArea className={compact ? "h-44 rounded-xl border bg-muted/20 p-4" : "h-[420px] rounded-xl border bg-muted/20 p-4"}>
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground text-center py-16">
            Ask anything about this document.
          </p>
        )}

        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {msg.question}
                </div>
              </div>

              <div className="flex justify-start">
                <div className="max-w-[90%] space-y-2">
                  <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-sm text-foreground leading-relaxed">
                    {msg.answer}
                  </div>
                  {msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {msg.citations.map((c, j) => (
                        <CitationBadge
                          key={j}
                          pageNumber={c.page_number}
                          snippet={c.snippet}
                          onClick={onCitationClick ? () => onCitationClick(c.page_number, c.snippet) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
