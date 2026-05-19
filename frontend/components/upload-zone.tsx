"use client"

import { useRef, useState } from "react"
import { Upload, Loader2, CheckCircle2, AlertCircle, LogIn } from "lucide-react"
import { uploadDocument } from "@/lib/api"
import { friendlyError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth-modal"

type State = "idle" | "dragging" | "uploading" | "success" | "error" | "guest_limit"

interface UploadZoneProps {
  onSuccess: (documentId: string) => void
}

export function UploadZone({ onSuccess }: UploadZoneProps) {
  const [state, setState] = useState<State>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setErrorMsg("Only PDF files are supported.")
      setState("error")
      return
    }

    setState("uploading")
    try {
      const { document_id } = await uploadDocument(file)
      setState("success")
      onSuccess(document_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      if (msg.includes("quota_exceeded")) {
        setState("guest_limit")
      } else {
        setErrorMsg(friendlyError(msg, "Upload failed. Please try again."))
        setState("error")
      }
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setState("idle")
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setState("dragging")
  }

  function onDragLeave() {
    setState("idle")
  }

  const isUploading = state === "uploading"
  const isGuestLimit = state === "guest_limit"

  return (
    <>
      <div
        onClick={() => !isUploading && !isGuestLimit && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors select-none",
          !isGuestLimit && "cursor-pointer",
          state === "dragging" && "border-primary bg-primary/5",
          !isGuestLimit && state !== "dragging" && "border-border hover:border-primary/60 hover:bg-muted/40",
          isGuestLimit && "border-border bg-muted/20",
          isUploading && "pointer-events-none opacity-80"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onFileChange}
        />

        {state === "uploading" && (
          <>
            <Loader2 className="size-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading and processing…</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="text-sm text-muted-foreground">Upload complete!</p>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-sm text-destructive">{errorMsg}</p>
            <p className="text-xs text-muted-foreground">Click to try again</p>
          </>
        )}

        {(state === "idle" || state === "dragging") && (
          <>
            <Upload className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Drag &amp; drop a PDF or click to browse</p>
              <p className="mt-1 text-sm text-muted-foreground">PDF files only</p>
            </div>
          </>
        )}

        {isGuestLimit && (
          <>
            <LogIn className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">You&apos;ve used your free document</p>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to unlock 3 more and save your work.</p>
            </div>
            <Button
              onClick={(e) => { e.stopPropagation(); setShowAuthModal(true) }}
            >
              Sign in to continue
            </Button>
          </>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          onSuccess={() => { setShowAuthModal(false); setState("idle") }}
          onDismiss={() => setShowAuthModal(false)}
        />
      )}
    </>
  )
}
