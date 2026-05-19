"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { AuthModal } from "@/components/auth-modal"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

interface NudgeBannerProps {
  analysisComplete: boolean
}

export function NudgeBanner({ analysisComplete }: NudgeBannerProps) {
  const router = useRouter()
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAnonymous(data.session?.user?.is_anonymous ?? false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const anonymous = session?.user?.is_anonymous ?? false
      setIsAnonymous(anonymous)
      if (!anonymous) setShowModal(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Appear 15 seconds after analysis completes — only for anonymous users
  useEffect(() => {
    if (!analysisComplete || !isAnonymous) return
    const id = setTimeout(() => setVisible(true), 15_000)
    return () => clearTimeout(id)
  }, [analysisComplete, isAnonymous])

  if (!analysisComplete || !visible || !isAnonymous) return null

  return (
    <>
      <div className="rounded-xl border bg-card px-4 py-3.5 mb-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium leading-snug">Enjoying Lumina?</p>
            <p className="text-xs text-muted-foreground leading-snug">
              Sign in to get <span className="font-medium text-foreground">3 more free documents</span> and keep access to this one.
            </p>
          </div>
        </div>
        <Button size="sm" className="h-7 text-xs px-3" onClick={() => setShowModal(true)}>
          Login / Sign Up
        </Button>
      </div>

      {showModal && (
        <AuthModal
          mode="upgrade"
          onSuccess={() => router.push("/dashboard?msg=signed_in")}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </>
  )
}
