"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface UserMenuProps {
  userEmail: string
  onSignOut: () => void
  onDeleteAccount: () => void
}

export function UserMenu({ userEmail, onSignOut, onDeleteAccount }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  const initial = userEmail[0]?.toUpperCase() ?? "?"

  async function handleDeleteConfirm() {
    setDeleting(true)
    try {
      await onDeleteAccount()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold select-none hover:opacity-90 transition-opacity"
          aria-label="User menu"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border bg-card shadow-lg py-1 text-sm">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b">{userEmail}</div>
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmDelete(true) }}
              className="w-full text-left px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors"
            >
              Delete account
            </button>
          </div>
        )}
      </div>

      {/* Centered delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl border bg-card p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Delete account</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This will permanently delete all your documents and cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete everything"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
