"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Re-export the handle type — `export type` is erased at runtime, so pdfjs never loads here
export type { PdfViewerHandle } from "./pdf-viewer-client"

const PdfViewerClient = dynamic(
  () => import("./pdf-viewer-client").then((m) => ({ default: m.PdfViewer })),
  { ssr: false, loading: () => <Skeleton className="w-full h-full rounded-none" /> }
)

export function PdfViewer(props: { documentId: string; ref?: React.Ref<import("./pdf-viewer-client").PdfViewerHandle> }) {
  return <PdfViewerClient {...props} />
}
