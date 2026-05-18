"use client"

import { useEffect, useRef, useState } from "react"
import { lookupWord } from "@/lib/api"
import { ChevronLeft, Loader2, X } from "lucide-react"

interface Entry {
  word: string
  phonetic: string
  definition: string
  example: string
  synonyms: string[]
}

export function DictionaryPopup() {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [history, setHistory] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  function close() {
    setVisible(false)
    setHistory([])
  }

  async function lookupAndNavigate(word: string) {
    if (loading) return
    setLoading(true)
    try {
      const data = await lookupWord(word)
      setHistory((prev) => entry ? [...prev, entry] : prev)
      setEntry(data)
    } catch {}
    finally { setLoading(false) }
  }

  function goBack() {
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setEntry(prev)
    setLoading(false)
  }

  function handleDoubleClick() {
    const text = window.getSelection()?.toString().trim() ?? ""
    if (!text || /\s/.test(text)) return
    lookupAndNavigate(text.toLowerCase())
  }

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      if (popupRef.current?.contains(e.target as Node)) return

      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""

      if (!text || /\s/.test(text)) return

      const word = text.toLowerCase()
      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()

      if (!rect) return

      setVisible(false)
      setEntry(null)
      setHistory([])

      const POPUP_W = 288 // w-72
      const MARGIN = 8
      const center = rect.left + rect.width / 2
      const x = Math.min(
        Math.max(MARGIN, center - POPUP_W / 2),
        window.innerWidth - POPUP_W - MARGIN
      )
      const y = rect.bottom + 8
      setPos({ x, y })

      setLoading(true)
      lookupWord(word)
        .then((data) => {
          setEntry(data)
          setVisible(true)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }

    function onMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        close()
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }

    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  if (!visible && !loading) return null
  if (!visible) return null

  return (
    <div
      ref={popupRef}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-50 w-72 rounded-xl border bg-popover p-4 shadow-lg text-popover-foreground"
      onDoubleClick={handleDoubleClick}
    >
      <button
        onClick={close}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <div className="space-y-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          {history.length > 0 && (
            <button
              onClick={goBack}
              className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <span className="font-semibold text-base">{entry?.word}</span>
          {entry?.phonetic && (
            <span className="ml-1 text-sm text-muted-foreground">{entry.phonetic}</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : entry ? (
          <>
            <p className="text-sm text-foreground">{entry.definition}</p>

            {entry.example && (
              <p className="text-xs text-muted-foreground italic">&ldquo;{entry.example}&rdquo;</p>
            )}

            {entry.synonyms.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entry.synonyms.map((s) => (
                  <button
                    key={s}
                    onClick={() => lookupAndNavigate(s)}
                    className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium hover:bg-accent transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
