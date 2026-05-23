"use client"

import { useState } from "react"

export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <a
      href={`mailto:${email}`}
      onClick={handleClick}
      className="text-foreground underline"
    >
      {copied ? "Copied!" : email}
    </a>
  )
}
