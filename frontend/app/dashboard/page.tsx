"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { listDocuments, type DocumentMeta } from "@/lib/api"
import { DocumentCard } from "@/components/document-card"
import { UploadZone } from "@/components/upload-zone"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Plus, X } from "lucide-react"

export default function Dashboard() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocumentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    let cancelled = false
    listDocuments()
      .then((data) => { if (!cancelled) setDocs(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load documents") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function onUploadSuccess(id: string) {
    setShowUpload(false)
    router.push(`/document/${id}`)
  }

  return (
    <main className="min-h-svh px-6 py-10 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">My Documents</h1>
        <Button onClick={() => setShowUpload((v) => !v)}>
          {showUpload ? <X className="size-4" /> : <Plus className="size-4" />}
          {showUpload ? "Cancel" : "Upload"}
        </Button>
      </div>

      {showUpload && (
        <div className="rounded-2xl border bg-card p-6">
          <UploadZone onSuccess={onUploadSuccess} />
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <FileText className="size-12 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No documents yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Upload your first PDF to get started.</p>
          </div>
          <Button onClick={() => setShowUpload(true)}>
            <Plus className="size-4" />
            Upload PDF
          </Button>
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </main>
  )
}
