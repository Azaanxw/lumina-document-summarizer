"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { listDocuments, deleteAccount, type DocumentMeta, type Quota } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { LuminaBrand } from "@/components/lumina-brand"
import { SiteFooter } from "@/components/site-footer"
import { DocumentCard } from "@/components/document-card"
import { UploadZone } from "@/components/upload-zone"
import { UserMenu } from "@/components/user-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText } from "lucide-react"

const MESSAGES: Record<string, { text: string; type: "success" | "error" | "default" }> = {
  signed_in:       { text: "Signed in successfully!", type: "success" },
  signed_out:      { text: "You've been signed out.", type: "default" },
  account_deleted: { text: "Your account and all documents have been deleted.", type: "error" },
  no_access:       { text: "You don't have access to view that document.", type: "error" },
}

function Notification() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const msg = searchParams.get("msg")

  useEffect(() => {
    if (!msg || !MESSAGES[msg]) return
    const { text, type } = MESSAGES[msg]
    router.replace("/dashboard", { scroll: false })
    if (type === "success") toast.success(text, { id: msg })
    else if (type === "error") toast.error(text, { id: msg })
    else toast(text, { id: msg })
  }, [msg, router])

  return null
}

export default function Dashboard() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocumentMeta[]>([])
  const [quota, setQuota] = useState<Quota | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    listDocuments()
      .then((data) => {
        if (cancelled) return
        setDocs(data.documents)
        setQuota(data.quota)
      })
      .catch((err) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : ""
        // 401 means the middleware redirect didn't fire (e.g. fresh navigation) — go home
        if (msg.includes("401") || msg.includes("Authentication")) {
          router.replace("/")
          return
        }
        setError(friendlyError(msg, "Failed to load your documents. Please refresh."))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace("/?msg=signed_out")
  }

  async function handleDeleteAccount() {
    await deleteAccount()
    await supabase.auth.signOut()
    router.replace("/?msg=account_deleted")
  }

  function onUploadSuccess(id: string) {
    router.push(`/document/${id}`)
  }

  return (
    <>
      <Suspense>
        <Notification />
      </Suspense>
    <main className="min-h-svh px-6 pt-10 pb-3 max-w-5xl mx-auto w-full flex flex-col space-y-8 select-none">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <LuminaBrand iconSize={52} textClassName="text-3xl font-bold tracking-tight" isAuthenticated={true} />
        {userEmail && (
          <UserMenu
            userEmail={userEmail}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </div>

      {quota && (
        <p className="text-sm text-muted-foreground -mt-4">
          {quota.used} of {quota.total} free documents used
        </p>
      )}

      {quota && quota.used >= quota.total ? (
        <div className="rounded-2xl border bg-muted/30 px-6 py-8 text-center space-y-2">
          <p className="font-medium">You&apos;ve reached your free document limit.</p>
          <p className="text-sm text-muted-foreground">Thank you for using Lumina.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6">
          <UploadZone onSuccess={onUploadSuccess} />
        </div>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-muted-foreground text-center py-4">{error}</p>}

      {!loading && !error && docs.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 flex flex-col items-center gap-3 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">No documents yet</p>
          <p className="text-sm text-muted-foreground">Upload a PDF above to get started.</p>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      <SiteFooter />
    </main>
    </>
  )
}
