"use client"

import { useEffect, useRef, useState } from "react"
import { lookupWord } from "@/lib/api"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Entry {
  word: string
  phonetic: string
  definition: string
  example: string
  synonyms: string[]
}

export function DictionaryPopup() {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""

      if (!text || /\s/.test(text)) return

      const word = text.toLowerCase()
      const range = selection?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()

      if (!rect) return

      setVisible(false)
      setEntry(null)

      const x = rect.left + rect.width / 2
      const y = rect.bottom + 8
      setPos({ x, y })

      lookupWord(word)
        .then((data) => {
          setEntry(data)
          setVisible(true)
        })
        .catch(() => {})
    }

    function onMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setVisible(false)
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

  if (!visible || !entry) return null

  return (
    <div
      ref={popupRef}
      style={{ left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
      className="fixed z-50 w-72 rounded-xl border bg-popover p-4 shadow-lg text-popover-foreground"
    >
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <div className="space-y-2.5">
        <div>
          <span className="font-semibold text-base">{entry.word}</span>
          {entry.phonetic && (
            <span className="ml-2 text-sm text-muted-foreground">{entry.phonetic}</span>
          )}
        </div>

        <p className="text-sm text-foreground">{entry.definition}</p>

        {entry.example && (
          <p className="text-xs text-muted-foreground italic">&ldquo;{entry.example}&rdquo;</p>
        )}

        {entry.synonyms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.synonyms.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
