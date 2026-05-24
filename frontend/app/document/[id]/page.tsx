"use client"

import { useParams, useRouter } from "next/navigation"
import { useRef, useState, useEffect } from "react"
import { type PdfViewerHandle } from "@/components/pdf-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SummaryView } from "@/components/summary-view"
import { FlashcardDeck } from "@/components/flashcard-deck"
import { QAChat } from "@/components/qa-chat"
import { PdfViewer } from "@/components/pdf-viewer"
import { DictionaryPopup } from "@/components/dictionary-popup"
import { NudgeBanner } from "@/components/nudge-banner"
import { getCacheStatus, generateCards, deleteAccount, type Flashcard, AuthError } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { LuminaBrand } from "@/components/lumina-brand"
import { ChevronLeft, GripHorizontal, Layers, Loader2, Lock, LogIn, User } from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { toast } from "sonner"

export default function DocumentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const pdfRef = useRef<PdfViewerHandle>(null)
  const [tab, setTab] = useState("summary")
  const [flashcardsUnlocked, setFlashcardsUnlocked] = useState(false)
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false)
  const [preloadedCards, setPreloadedCards] = useState<Flashcard[] | null>(null)
  const [askHeight, setAskHeight] = useState(280)
  const [summaryLoaded, setSummaryLoaded] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showGuestModal, setShowGuestModal] = useState(false)
  const [accessError, setAccessError] = useState<"unauthenticated" | "forbidden" | null>(null)
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user
      if (user && !user.is_anonymous) {
        setUserEmail(user.email ?? null)
        setIsAnonymous(false)
      } else if (user?.is_anonymous) {
        setIsAnonymous(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const user = session?.user
      if (user && !user.is_anonymous) {
        setUserEmail(user.email ?? null)
        setIsAnonymous(false)
        setShowGuestModal(false)
      } else {
        setUserEmail(null)
        setIsAnonymous(user?.is_anonymous ?? false)
      }
    })

    return () => subscription.unsubscribe()
  }, [id])

  async function handleDeleteAccount() {
    await deleteAccount()
    // User was deleted server-side; calling signOut would 403. Clear local session directly.
    await (supabase.auth as any)._removeSession()
    router.replace("/?msg=account_deleted")
  }

  useEffect(() => {
    setChecking(true)
    getCacheStatus(id)
      .then((s) => { if (s.has_flashcards) setFlashcardsUnlocked(true) })
      .catch((err) => {
        if (err instanceof AuthError) {
          setAccessError(err.status === 401 ? "unauthenticated" : "forbidden")
        }
      })
      .finally(() => setChecking(false))
  }, [id])

  function onCitationClick(pageNumber: number, snippets: string[]) {
    pdfRef.current?.scrollToPage(pageNumber, snippets)
  }

  function handleAskDragStart(e: React.MouseEvent) {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = askHeight

    document.body.style.cursor = "ns-resize"
    document.body.style.userSelect = "none"

    function onMove(e: MouseEvent) {
      const newHeight = Math.min(Math.max(startHeight + (startY - e.clientY), 120), 640)
      setAskHeight(newHeight)
    }

    function onUp() {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }

  async function handleGenerateFlashcards() {
    setGeneratingFlashcards(true)
    try {
      const result = await generateCards(id)
      setPreloadedCards(result.flashcards)
      setFlashcardsUnlocked(true)
      setTab("flashcards")
      toast.success("Flashcards generated!")
    } catch {
      // generation failed — silently reset so user can retry
    } finally {
      setGeneratingFlashcards(false)
    }
  }

  return (
    <div className="relative flex flex-col h-svh overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <ChevronLeft className="size-4" />
          Dashboard
        </Button>

        <div className="flex-1 flex items-center justify-center">
          <LuminaBrand iconSize={36} textClassName="font-bold text-base" isAuthenticated={!isAnonymous} />
        </div>

        <div className="shrink-0">
          {userEmail ? (
            <UserMenu
              userEmail={userEmail}
              onSignOut={async () => { await supabase.auth.signOut(); router.replace("/?msg=signed_out") }}
              onDeleteAccount={handleDeleteAccount}
            />
          ) : isAnonymous ? (
            <button
              onClick={() => setShowGuestModal(true)}
              className="size-8 rounded-full bg-muted border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              aria-label="Sign in"
            >
              <User className="size-4" />
            </button>
          ) : null}
        </div>

        {showGuestModal && (
          <AuthModal
            mode="upgrade"
            subtitle="Create an account to unlock 3 more documents and keep this one."
            onSuccess={() => router.push("/dashboard?msg=signed_in")}
            onDismiss={() => setShowGuestModal(false)}
          />
        )}
      </header>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — PDF viewer */}
        <div className="w-2/5 shrink-0 border-r overflow-hidden h-full">
          {!checking && !accessError && <PdfViewer documentId={id} ref={pdfRef} />}
        </div>

        {/* Right — study tools + ask */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Study tools (scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <NudgeBanner analysisComplete={summaryLoaded} />

            <Tabs value={tab} onValueChange={setTab}>
              <div className="flex items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="summary">Summary &amp; Quiz</TabsTrigger>
                  {flashcardsUnlocked && (
                    <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
                  )}
                </TabsList>
                {!flashcardsUnlocked && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleGenerateFlashcards} disabled={generatingFlashcards}>
                    {generatingFlashcards
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Layers className="size-3.5" />
                    }
                    {generatingFlashcards ? "Generating…" : "Generate Flashcards"}
                  </Button>
                )}
              </div>

              <TabsContent value="summary" keepMounted>
                <SummaryView documentId={id} onLoaded={() => { setSummaryLoaded(true); toast.success("Summary & quiz are ready!") }} />
              </TabsContent>

              {flashcardsUnlocked && (
                <TabsContent value="flashcards">
                  <FlashcardDeck documentId={id} initialCards={preloadedCards ?? undefined} />
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={handleAskDragStart}
            className="shrink-0 border-t h-3 flex items-center justify-center cursor-ns-resize hover:bg-accent/60 group transition-colors"
          >
            <GripHorizontal className="size-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </div>

          {/* Ask chatbox (pinned to bottom) */}
          <div className="shrink-0 flex flex-col gap-2 px-5 pt-3 pb-4" style={{ height: askHeight }}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">Ask</p>
            <QAChat documentId={id} onCitationClick={onCitationClick} />
          </div>

        </div>
      </div>

      <DictionaryPopup />

      {/* Access denied overlay */}
      {accessError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 flex flex-col items-center gap-4 text-center">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center">
              {accessError === "forbidden" && !isAnonymous
                ? <Lock className="size-7 text-muted-foreground" />
                : <LogIn className="size-7 text-muted-foreground" />
              }
            </div>

            <h2 className="text-xl font-semibold">Private document</h2>

            {accessError === "forbidden" && !isAnonymous ? (
              <>
                <p className="text-sm text-muted-foreground">
                  You can only view documents you've uploaded. This one belongs to a different account.
                </p>
                <Button className="w-full" onClick={() => router.push("/dashboard")}>
                  View your documents
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {accessError === "forbidden"
                    ? "You're browsing as a guest. Sign in to check if this document belongs to your account."
                    : "You can only view documents you've uploaded. Sign in to access your documents."
                  }
                </p>
                <Button className="w-full" onClick={() => setShowSignInModal(true)}>
                  Sign In
                </Button>
              </>
            )}

            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              Go back home
            </Button>
          </div>
        </div>
      )}

      {/* Sign-in modal — check document access after auth to decide where to navigate */}
      {showSignInModal && (
        <AuthModal
          mode="signin"
          onSuccess={async () => {
            setShowSignInModal(false)
            try {
              const s = await getCacheStatus(id)
              setAccessError(null)
              if (s.has_flashcards) setFlashcardsUnlocked(true)
            } catch {
              router.push("/dashboard?msg=no_access")
            }
          }}
          onDismiss={() => setShowSignInModal(false)}
        />
      )}
    </div>
  )
}
