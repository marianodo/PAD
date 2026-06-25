"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Report } from "../../_components/Report"
import { ReportDocument } from "../../_components/types"
import { API_URL } from "@/lib/config"

export default function ReportPage() {
  const params = useParams<{ city: string; year: string }>()
  const slug = `${params.city}-${params.year}`

  const [doc, setDoc] = useState<ReportDocument | null>(null)
  const [state, setState] = useState<"loading" | "error" | "ok">("loading")

  useEffect(() => {
    fetch(`${API_URL}/api/v1/reports/${slug}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: ReportDocument) => { setDoc(d); setState("ok") })
      .catch(() => setState("error"))
  }, [slug])

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#0ea5e9] border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  if (state === "error" || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
          <h1 className="font-montserrat text-2xl font-bold text-foreground mb-2">Reporte no encontrado</h1>
          <p className="text-muted-foreground">No existe un reporte para esta dirección.</p>
        </div>
      </div>
    )
  }

  return <Report config={doc.config} segments={doc.segments} />
}
