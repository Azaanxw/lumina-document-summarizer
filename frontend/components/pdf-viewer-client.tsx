"use client"

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { getPdfUrl } from "@/lib/api"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import { Skeleton } from "@/components/ui/skeleton"

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfViewerHandle {
  scrollToPage: (pageNumber: number, snippets?: string[]) => void
}

interface PdfViewerProps {
  documentId: string
  ref?: React.Ref<PdfViewerHandle>
}

const normWord = (w: string) =>
  w.normalize("NFKD").replace(/[^a-z0-9]/gi, "").toLowerCase()

// Returns the set of itemIndex values (matching react-pdf's customTextRenderer itemIndex)
// that correspond to the citation snippets on the page.
//
// Uses concatenated-string substring search rather than token-by-token matching so that
// words split across adjacent text items (e.g. "60" + "-65%" rendering as two items
// instead of one) still match a snippet that contains "60-65%" as a single word.
function findMatchedItemIndices(
  pageItems: Array<{ str: string; idx: number }>,
  snippetTexts: string[]
): Set<number> {
  // Build per-token metadata: normalised form, source itemIdx, and position range
  // inside the concatenated page string.
  const tokens: { norm: string; itemIdx: number; start: number; end: number }[] = []
  let concatPage = ""

  for (const { str, idx } of pageItems) {
    for (const raw of str.split(/\s+/)) {
      const n = normWord(raw)
      if (!n) continue
      tokens.push({ norm: n, itemIdx: idx, start: concatPage.length, end: concatPage.length + n.length })
      concatPage += n
    }
  }

  const matched = new Set<number>()

  for (const text of snippetTexts) {
    const snippetWords = text.split(/\s+/).map(normWord).filter(Boolean)
    if (snippetWords.length < 2) continue
    const snippetConcat = snippetWords.join("")

    // Primary: substring search on the concatenated string.
    // Immune to how the PDF renderer splits words across text items.
    const pos = concatPage.indexOf(snippetConcat)
    if (pos !== -1) {
      const end = pos + snippetConcat.length
      for (const tok of tokens) {
        if (tok.start < end && tok.end > pos) matched.add(tok.itemIdx)
      }
      continue
    }

    // Fallback: exact token-by-token sequential match.
    // Catches cases where normWord produces different results between snippet and page
    // (e.g. different Unicode normalisation applied by the backend extractor).
    outer: for (let i = 0; i <= tokens.length - snippetWords.length; i++) {
      for (let j = 0; j < snippetWords.length; j++) {
        if (tokens[i + j].norm !== snippetWords[j]) continue outer
      }
      for (let j = 0; j < snippetWords.length; j++) matched.add(tokens[i + j].itemIdx)
      break
    }
    // No fuzzy fallback — partial matches produce too many false positives.
  }

  // Fill in punctuation-only items that sit between matched items.
  // Characters like "–" and "-" normalize to "" so they never enter the token stream,
  // but they visually belong inside the highlighted run (e.g. "60–65%", "three-second").
  if (matched.size > 1) {
    const sorted = [...matched].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length - 1; i++) {
      const lo = sorted[i], hi = sorted[i + 1]
      for (const { str, idx } of pageItems) {
        if (idx > lo && idx < hi && !normWord(str)) matched.add(idx)
      }
    }
  }

  return matched
}

export function PdfViewer({ documentId, ref }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [highlight, setHighlight] = useState<{ page: number; texts: string[] } | null>(null)
  const [highlightedItems, setHighlightedItems] = useState<{ page: number; items: Set<number> } | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pageTextItems = useRef<Map<number, Array<{ str: string; idx: number }>>>(new Map())
  const highlightRef = useRef<{ page: number; texts: string[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPdfUrl(documentId)
      .then(({ url }) => { if (!cancelled) setPdfUrl(url) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [documentId])

  const pdfFile = useMemo(() => {
    if (!pdfUrl) return null
    return { url: pdfUrl }
  }, [pdfUrl])

  // Keep ref in sync on every render (no dependency array — runs every render)
  useEffect(() => { highlightRef.current = highlight })

  // Track container width for responsive page rendering
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Track which page is most visible to show in the fixed indicator
  useEffect(() => {
    if (numPages === 0) return
    const visibleRatios = new Map<number, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          visibleRatios.set(page, entry.intersectionRatio)
        }
        let best = 1, bestRatio = -1
        visibleRatios.forEach((ratio, page) => {
          if (ratio > bestRatio) { bestRatio = ratio; best = page }
        })
        setCurrentPage(best)
      },
      { root: containerRef.current, threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    )
    pageRefs.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [numPages])

  // Imperative handle for citation navigation
  useImperativeHandle(ref, () => ({
    scrollToPage(pageNumber: number, snippets?: string[]) {
      const el = pageRefs.current.get(pageNumber)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
      if (snippets?.length) setHighlight({ page: pageNumber, texts: snippets })
    },
  }))

  // When highlight changes, immediately match if the page's text is already cached
  useEffect(() => {
    if (!highlight) { setHighlightedItems(null); return }
    const items = pageTextItems.current.get(highlight.page)
    if (items) {
      setHighlightedItems({ page: highlight.page, items: findMatchedItemIndices(items, highlight.texts) })
    } else {
      setHighlightedItems(null) // Will be computed in handleTextSuccess once text loads
    }
  }, [highlight])

  // Cache text items per page; if this is the cited page, compute highlighted indices
  const handleTextSuccess = useCallback((pageNumber: number, textContent: { items: Array<Record<string, unknown>> }) => {
    const items = textContent.items
      .map((item, idx) => ({ str: item["str"], idx }))
      .filter((x): x is { str: string; idx: number } => typeof x.str === "string" && x.str.length > 0)
    pageTextItems.current.set(pageNumber, items)

    const hl = highlightRef.current
    if (hl?.page === pageNumber) {
      setHighlightedItems({ page: pageNumber, items: findMatchedItemIndices(items, hl.texts) })
    }
  }, [])

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="h-full overflow-y-auto bg-muted/30">
        {containerWidth > 0 && pdfFile && (
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<Skeleton className="w-full h-64 rounded-none" />}
            error={<p className="p-4 text-sm text-destructive">Failed to load PDF.</p>}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const page = i + 1
              return (
                <div
                  key={page}
                  data-page={page}
                  ref={(el) => {
                    if (el) pageRefs.current.set(page, el)
                    else pageRefs.current.delete(page)
                  }}
                  className="mb-1"
                >
                  <Page
                    key={page}
                    pageNumber={page}
                    width={containerWidth}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    onGetTextSuccess={(tc) => handleTextSuccess(page, tc as { items: Array<Record<string, unknown>> })}
                    customTextRenderer={
                      highlightedItems?.page === page && highlightedItems.items.size > 0
                        ? ({ str, itemIndex }) =>
                            highlightedItems.items.has(itemIndex)
                              // color:transparent hides the text-layer text so the PDF canvas
                              // text shows through — prevents the doubled-text visual artifact
                              ? `<mark style="background:rgba(250,204,21,0.45);border-radius:2px;padding:0 1px;color:transparent">${str}</mark>`
                              : str
                        : undefined
                    }
                  />
                </div>
              )
            })}
          </Document>
        )}
      </div>

      {numPages > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium pointer-events-none select-none backdrop-blur-sm">
          {currentPage} / {numPages}
        </div>
      )}
    </div>
  )
}
