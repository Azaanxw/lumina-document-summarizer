"use client"

import { useEffect, useImperativeHandle, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import { Skeleton } from "@/components/ui/skeleton"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfViewerHandle {
  scrollToPage: (pageNumber: number, snippet?: string) => void
}

interface PdfViewerProps {
  documentId: string
  ref?: React.Ref<PdfViewerHandle>
}

export function PdfViewer({ documentId, ref }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [highlight, setHighlight] = useState<{ page: number; text: string } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/pdf`

  // Track container width for responsive page rendering
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Imperative handle for citation navigation
  useImperativeHandle(ref, () => ({
    scrollToPage(pageNumber: number, snippet?: string) {
      const el = pageRefs.current.get(pageNumber)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      if (snippet) {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
        setHighlight({ page: pageNumber, text: snippet })
        highlightTimerRef.current = setTimeout(() => setHighlight(null), 4000)
      }
    },
  }))

  function makeTextRenderer(pageNumber: number) {
    return ({ str }: { str: string }) => {
      if (!highlight || highlight.page !== pageNumber || !str) return str
      const escaped = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return str.replace(
        new RegExp(escaped, "gi"),
        (m) => `<mark style="background:#fef08a;color:inherit;border-radius:2px;padding:0 1px">${m}</mark>`
      )
    }
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-muted/30">
      {containerWidth > 0 && (
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<Skeleton className="w-full h-64 rounded-none" />}
          error={<p className="p-4 text-sm text-destructive">Failed to load PDF.</p>}
        >
          {Array.from({ length: numPages }, (_, i) => {
            const page = i + 1
            return (
              <div
                key={page}
                ref={(el) => {
                  if (el) pageRefs.current.set(page, el)
                  else pageRefs.current.delete(page)
                }}
                className="mb-1"
              >
                <Page
                  pageNumber={page}
                  width={containerWidth}
                  renderTextLayer
                  renderAnnotationLayer={false}
                  customTextRenderer={makeTextRenderer(page)}
                />
              </div>
            )
          })}
        </Document>
      )}
    </div>
  )
}
