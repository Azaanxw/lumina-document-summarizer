"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ensureAnonymousSession } from "@/lib/api"
import { UploadZone } from "@/components/upload-zone"
import { AuthModal } from "@/components/auth-modal"

const MESSAGES: Record<string, { text: string; type: "success" | "error" | "default" }> = {
  signed_out: { text: "You've been signed out.", type: "default" },
  account_deleted: { text: "Your account and all documents have been deleted.", type: "error" },
}

function Notification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const msg = searchParams.get("msg")

  useEffect(() => {
    if (!msg || !MESSAGES[msg]) return
    const { text, type } = MESSAGES[msg]
    router.replace("/", { scroll: false })
    if (type === "error") toast.error(text, { id: msg })
    else toast(text, { id: msg })
  }, [msg, router])

  return null
}

export default function Home() {
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    ensureAnonymousSession().then(() => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session)
        if (data.session?.user && !data.session.user.is_anonymous) {
          const fromOAuth = window.location.hash.includes("access_token")
          router.replace(fromOAuth ? "/dashboard?msg=signed_in" : "/dashboard")
        }
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === "SIGNED_IN" && session?.user && !session.user.is_anonymous) {
        router.push("/dashboard?msg=signed_in")
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <>
      <Suspense>
        <Notification />
      </Suspense>

      <main className="flex min-h-svh flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl space-y-10">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Image src="/icon.png" alt="Lumina" width={72} height={72} className="rounded-2xl" />
              <h1 className="text-5xl font-bold tracking-tight text-foreground">Lumina</h1>
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

        {showAuthModal && (
          <AuthModal
            onSuccess={() => setShowAuthModal(false)}
            onDismiss={() => setShowAuthModal(false)}
            subtitle="Sign in to access your documents and get 3 free document analyses."
          />
        )}

        <footer className="mt-auto pt-4 text-center text-xs text-muted-foreground space-x-4">
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
        </footer>
      </main>
    </>
  )
}
