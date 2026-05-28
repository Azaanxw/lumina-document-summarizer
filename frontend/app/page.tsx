"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ensureAnonymousSession } from "@/lib/api"
import { FileText, MessageSquare, ClipboardList, Layers, BookOpen } from "lucide-react"
import { UploadZone } from "@/components/upload-zone"
import { AuthModal } from "@/components/auth-modal"
import { SiteFooter } from "@/components/site-footer"

const MESSAGES: Record<string, { text: string; type: "success" | "error" | "default" }> = {
  signed_out: { text: "You've been signed out.", type: "default" },
  account_deleted: { text: "Your account and all documents have been deleted.", type: "error" },
}

const OAUTH_ERRORS: Record<string, string> = {
  identity_already_exists: "This Google account is already linked to another account. Sign in instead of upgrading.",
}

function Notification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const msg = searchParams.get("msg")
  const errorCode = searchParams.get("error_code")

  useEffect(() => {
    if (errorCode) {
      router.replace("/", { scroll: false })
      toast.error(OAUTH_ERRORS[errorCode] ?? "Authentication failed. Please try again.", { id: errorCode })
      return
    }
    if (!msg || !MESSAGES[msg]) return
    const { text, type } = MESSAGES[msg]
    router.replace("/", { scroll: false })
    if (type === "error") toast.error(text, { id: msg })
    else toast(text, { id: msg })
  }, [msg, errorCode, router])

  return null
}

export default function Home() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const navigated = useRef(false)

  useEffect(() => {
    // Capture at effect-start so it reads the real landing URL before any client-side navigation
    const isOAuthCallback = window.location.hash.includes("access_token")
      || window.location.search.includes("code=")

    ensureAnonymousSession().then(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (navigated.current) return
        setSession(data.session)
        if (data.session?.user && !data.session.user.is_anonymous) {
          navigated.current = true
          router.replace(isOAuthCallback ? "/dashboard?msg=signed_in" : "/dashboard")
        }
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === "SIGNED_IN" && session?.user && !session.user.is_anonymous) {
        if (!navigated.current) {
          navigated.current = true
          router.push("/dashboard?msg=signed_in")
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <>
      <Suspense>
        <Notification />
      </Suspense>

      <main className="flex min-h-svh flex-col items-center justify-center px-4 pt-8 pb-3 select-none">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <Image src="/icon.png" alt="Lumina" width={60} height={60} className="rounded-2xl" />
              <h1 className="text-5xl font-bold tracking-tight text-foreground">LUMINA</h1>
            </div>
            <p className="text-lg text-muted-foreground">Upload a PDF. Study smarter.</p>
          </div>

          <UploadZone onSuccess={(id) => router.push(`/document/${id}`)} />

          {session === undefined ? null : session && !session.user.is_anonymous ? (
            <p className="text-center text-xs text-muted-foreground">
              <a href="/dashboard" className="underline underline-offset-4 hover:text-foreground transition-colors">
                Go to dashboard
              </a>
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => setShowAuthModal(true)}
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        <section className="w-full max-w-xl mt-20">
          <p className="text-xs text-center text-muted-foreground mb-2 uppercase tracking-widest">What you can do</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {([
              { icon: FileText, label: "Summarize", desc: "AI-generated summary of any PDF in seconds" },
              { icon: MessageSquare, label: "Ask questions", desc: "Cited answers with page references" },
              { icon: ClipboardList, label: "Quiz yourself", desc: "Auto-generated multiple-choice questions" },
              { icon: Layers, label: "Flashcards", desc: "Flip-card deck for spaced repetition" },
              { icon: BookOpen, label: "Dictionary", desc: "Double-click any word for an instant definition" },
            ] as const).map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl border bg-card p-3 space-y-1 w-[calc(50%-0.25rem)]">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {label}
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {showAuthModal && (
          <AuthModal
            onSuccess={() => setShowAuthModal(false)}
            onDismiss={() => setShowAuthModal(false)}
            subtitle="Sign in to access your documents and get 3 free document analyses."
          />
        )}

        <SiteFooter />
      </main>
    </>
  )
}
