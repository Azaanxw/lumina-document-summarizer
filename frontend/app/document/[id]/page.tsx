"use client"

import { useParams, useRouter } from "next/navigation"
import { useRef } from "react"
import { type PdfViewerHandle } from "@/components/pdf-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SummaryView } from "@/components/summary-view"
import { FlashcardDeck } from "@/components/flashcard-deck"
import { QAChat } from "@/components/qa-chat"
import { PdfViewer } from "@/components/pdf-viewer"
import { DictionaryPopup } from "@/components/dictionary-popup"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export default function DocumentPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const pdfRef = useRef<PdfViewerHandle>(null)

  function onCitationClick(pageNumber: number, snippet: string) {
    pdfRef.current?.scrollToPage(pageNumber, snippet)
  }

  return (
    <div className="flex flex-col h-svh overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <ChevronLeft className="size-4" />
          Dashboard
        </Button>
      </header>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — PDF viewer */}
        <div className="w-1/2 shrink-0 border-r overflow-hidden h-full">
          <PdfViewer documentId={id} ref={pdfRef} />
        </div>

        {/* Right — study tools + ask */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Study tools (scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary &amp; Quiz</TabsTrigger>
                <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" keepMounted>
                <SummaryView documentId={id} />
              </TabsContent>

              <TabsContent value="flashcards" keepMounted>
                <FlashcardDeck documentId={id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Ask chatbox (pinned to bottom) */}
          <Separator />
          <div className="shrink-0 px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Ask</p>
            <QAChat documentId={id} compact onCitationClick={onCitationClick} />
          </div>

        </div>
      </div>

      <DictionaryPopup />
    </div>
  )
}
