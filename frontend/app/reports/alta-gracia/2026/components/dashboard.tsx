"use client"

import { useState } from "react"
import { segments, getTotals } from "../lib/data"
import { SegmentView } from "./segment-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs"
import { ScrollArea, ScrollBar } from "../../../../../components/ui/scroll-area"
import {
  Trees, Wrench, Trophy, Heart, Building,
  Stethoscope, Shield, Briefcase,
  LayoutDashboard, TrendingUp, Calendar, CheckCircle2,
} from "lucide-react"

const iconMap: Record<string, typeof Building> = {
  Trees, Wrench, Trophy, Heart, Building, Stethoscope, Shield, Briefcase,
}

const SEGMENT_COLORS: Record<string, string> = {
  "espacios-publicos":         "#10b981",
  "servicios-publicos":        "#f97316",
  "deportes-cultura-turismo":  "#8b5cf6",
  "ayuda-social":              "#f59e0b",
  "obras":                     "#ec4899",
  "salud":                     "#ef4444",
  "seguridad":                 "#0ea5e9",
  "otras-acciones":            "#6366f1",
}

export function Dashboard() {
  const [selectedSegment, setSelectedSegment] = useState(segments[0].id)
  const totals = getTotals()

  const stats = [
    { label: "Categorías",  value: String(segments.length),        Icon: LayoutDashboard, color: "#0ea5e9" },
    { label: "Año Fiscal",  value: "2026",                         Icon: Calendar,        color: "#10b981" },
    { label: "Acciones",    value: `${totals.totalProjects}`,       Icon: TrendingUp,      color: "#8b5cf6" },
    { label: "Completados", value: String(totals.completados),      Icon: CheckCircle2,    color: "#f59e0b" },
  ]

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero ── */}
      <header className="bg-[#0f1923] text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-white/80">
              <Building className="h-4 w-4" />
              Gestión Municipal 2026
            </div>
            <h1 className="font-montserrat text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl text-balance">
              Acciones 2026
              <br />
              <span className="text-[#0ea5e9]">Alta Gracia</span>
            </h1>
            <p className="mx-auto max-w-xl font-sans text-base text-white/60 leading-relaxed">
              Detalle de acciones, inversiones y proyectos planificados por la Municipalidad de Alta Gracia
              para el ejercicio fiscal 2026, organizados por área de gestión.
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map(({ label, value, Icon, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur"
              >
                <Icon className="h-7 w-7" style={{ color }} />
                <p className="font-montserrat text-4xl font-extrabold text-white">{value}</p>
                <p className="font-sans text-xs font-semibold uppercase tracking-widest text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Tabs + Content ── */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-montserrat text-xl font-bold text-foreground">Áreas de Gestión</h2>
          <span className="font-sans text-sm text-muted-foreground">{segments.length} categorías</span>
        </div>

        <Tabs value={selectedSegment} onValueChange={setSelectedSegment}>

          {/* Horizontal scrollable tab list */}
          <ScrollArea className="w-full pb-1">
            <TabsList className="inline-flex h-auto w-max gap-2 bg-transparent p-0 mb-6">
              {segments.map(segment => {
                const Icon = iconMap[segment.icon] || Building
                const color = SEGMENT_COLORS[segment.id] ?? "#0ea5e9"
                const isActive = selectedSegment === segment.id
                return (
                  <TabsTrigger
                    key={segment.id}
                    value={segment.id}
                    className="flex items-center gap-2 rounded-xl border px-4 py-2.5 font-montserrat text-sm font-semibold transition-all duration-200 data-[state=inactive]:border-border data-[state=inactive]:bg-card data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                    style={
                      isActive
                        ? { borderColor: color, background: `${color}15`, color }
                        : {}
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{segment.name}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {segments.map(segment => (
            <TabsContent key={segment.id} value={segment.id} className="mt-0">
              <SegmentView segment={segment} />
            </TabsContent>
          ))}

        </Tabs>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border bg-card py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="font-sans text-sm text-muted-foreground">
            P.A.D. — Participación Activa Digital | Municipalidad de Alta Gracia 2026
          </p>
        </div>
      </footer>

    </div>
  )
}
