"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { FileText, MessageSquare, ClipboardList, Layers, BookOpen, X } from "lucide-react"

const FEATURES = [
  { icon: FileText, label: "Summarize", desc: "AI-generated summary of any PDF in seconds" },
  { icon: MessageSquare, label: "Ask questions", desc: "Cited answers with page references" },
  { icon: ClipboardList, label: "Quiz yourself", desc: "Auto-generated multiple-choice questions" },
  { icon: Layers, label: "Flashcards", desc: "Flip-card deck for spaced repetition" },
  { icon: BookOpen, label: "Dictionary", desc: "Double-click any word for an instant definition" },
] as const

interface LuminaBrandProps {
  iconSize?: number
  textClassName?: string
  isAuthenticated: boolean
}

export function LuminaBrand({ iconSize = 44, textClassName = "font-bold", isAuthenticated }: LuminaBrandProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showFeatures, setShowFeatures] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3 select-none">
        <button
          onClick={() => setShowFeatures(true)}
          className="shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          title="What can Lumina do?"
          aria-label="Show Lumina features"
        >
          <Image
            src="/icon.png"
            alt="Lumina"
            width={iconSize}
            height={iconSize}
            className="rounded-xl block"
          />
        </button>

        <div className="flex flex-col gap-0.5">
          {pathname === "/dashboard" ? (
            <span className={`${textClassName} leading-none`}>LUMINA</span>
          ) : (
            <button
              onClick={() => router.push(isAuthenticated ? "/dashboard" : "/")}
              className={`${textClassName} cursor-pointer focus:outline-none leading-none text-left`}
            >
              LUMINA
            </button>
          )}
          <span className="text-[13px] tracking-widest uppercase text-muted-foreground/60 leading-none">
            pdf summarizer
          </span>
        </div>
      </div>

      {showFeatures && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowFeatures(false)}
        >
          <div
            className="bg-card rounded-2xl border p-6 w-full max-w-sm mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">What you can do</p>
              <button
                onClick={() => setShowFeatures(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl border bg-background p-3 space-y-1 w-[calc(50%-0.25rem)]">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {label}
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
