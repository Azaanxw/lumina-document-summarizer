"use client"

import { useState, useRef } from "react"

export function CopyEmail({ email, label }: { email: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const isHovering = useRef(false)
  const pendingClear = useRef(false)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function doClear() {
    setCopied(false)
    pendingClear.current = false
    clearTimer.current = null
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    navigator.clipboard.writeText(email)
    setCopied(true)
    pendingClear.current = false
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => {
      if (isHovering.current) {
        pendingClear.current = true
        clearTimer.current = null
      } else {
        doClear()
      }
    }, 5000)
  }

  function handleMouseEnter() {
    isHovering.current = true
    if (pendingClear.current && clearTimer.current) {
      clearTimeout(clearTimer.current)
      clearTimer.current = null
    }
  }

  function handleMouseLeave() {
    isHovering.current = false
    if (pendingClear.current) {
      clearTimer.current = setTimeout(doClear, 1000)
    }
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={label ? "hover:text-foreground transition-colors" : "text-foreground underline"}
    >
      {copied ? `Email copied! (${email})` : (label ?? email)}
    </a>
  )
}
