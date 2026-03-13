"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { Badge } from "../../../../../components/ui/badge"
import { Segment, ProjectStatus } from "../lib/data"
import {
  Trees, Wrench, Trophy, Heart, Building,
  Stethoscope, Shield, Briefcase,
  CheckCircle2, Clock, Calendar, RefreshCw,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts"

const iconMap: Record<string, typeof Building> = {
  Trees, Wrench, Trophy, Heart, Building, Stethoscope, Shield, Briefcase,
}

const SEGMENT_COLORS: Record<string, string> = {
  "espacios-publicos":  "#10b981",
  "servicios-publicos": "#f97316",
  "deportes-cultura-turismo": "#8b5cf6",
  "ayuda-social":       "#f59e0b",
  "obras":              "#ec4899",
  "salud":              "#ef4444",
  "seguridad":          "#0ea5e9",
  "otras-acciones":     "#6366f1",
}

const STATUS_META: Record<ProjectStatus, { label: string; color: string; Icon: typeof Clock }> = {
  en_ejecucion: { label: "En Ejecución", color: "#0ea5e9", Icon: Clock },
  planificado:  { label: "Planificado",  color: "#f59e0b", Icon: Calendar },
  completado:   { label: "Completado",   color: "#10b981", Icon: CheckCircle2 },
  continuo:     { label: "Continuo",     color: "#94a3b8", Icon: RefreshCw },
}

interface SegmentViewProps {
  segment: Segment
}

export function SegmentView({ segment }: SegmentViewProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const Icon = iconMap[segment.icon] || Building
  const accentColor = SEGMENT_COLORS[segment.id] ?? "#0ea5e9"

  const highlighted = segment.projects.slice(0, 3)

  const groupedProjects = segment.projects.reduce(
    (acc, p) => {
      const cat = p.category || "General"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    },
    {} as Record<string, typeof segment.projects>
  )

  const statusChartData = [
    { name: "En Ejecución", value: segment.projectsEnEjecucion,  fill: STATUS_META.en_ejecucion.color },
    { name: "Planificados", value: segment.projectsPlanificados, fill: STATUS_META.planificado.color },
    { name: "Completados",  value: segment.projectsCompletados,  fill: STATUS_META.completado.color },
    { name: "Continuos",    value: segment.projectsContinuos,    fill: STATUS_META.continuo.color },
  ].filter(d => d.value > 0)

  const categoryBarData = Object.entries(groupedProjects).map(([cat, ps]) => ({
    name: cat.length > 18 ? cat.slice(0, 18) + "…" : cat,
    Acciones: ps.length,
    fill: accentColor,
  }))

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{ background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)`, borderLeft: `4px solid ${accentColor}` }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-md"
            style={{ background: accentColor }}
          >
            <Icon className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-sans text-sm font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
              Área de gestión · 2026
            </p>
            <h2 className="font-montserrat text-3xl font-bold text-foreground leading-tight mt-1">
              {segment.name}
            </h2>
            <p className="font-sans text-base text-muted-foreground leading-relaxed mt-2">
              {segment.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {highlighted.map(p => (
                <Badge
                  key={p.id}
                  className="font-sans text-xs font-medium text-white border-0"
                  style={{ background: accentColor }}
                >
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Acciones",  value: segment.totalProjects,        color: accentColor },
          { label: "En Ejecución",    value: segment.projectsEnEjecucion,   color: STATUS_META.en_ejecucion.color },
          { label: "Planificados",    value: segment.projectsPlanificados,  color: STATUS_META.planificado.color },
          { label: "Completados",     value: segment.projectsCompletados,   color: STATUS_META.completado.color },
        ].map(({ label, value, color }) => (
          <Card key={label} className="border-border shadow-sm">
            <CardContent className="p-5">
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="mt-2 font-montserrat text-4xl font-extrabold" style={{ color }}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Highlighted Projects ── */}
      <div className="space-y-4">
        <h3 className="font-montserrat text-lg font-bold text-foreground">Acciones Principales</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {highlighted.map(project => {
            const { label, Icon: StatusIcon, color } = STATUS_META[project.status]
            return (
              <Card key={project.id} className="border-border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-montserrat text-base font-bold text-foreground leading-snug">
                      {project.name}
                    </CardTitle>
                    <StatusIcon className="h-5 w-5 shrink-0" style={{ color }} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                    {project.description}
                  </p>
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: color }}
                  >
                    {label}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="space-y-4">
        <h3 className="font-montserrat text-lg font-bold text-foreground">Distribución por Estado y Categoría</h3>
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Pie — by status */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="font-montserrat text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Por Estado
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[240px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      >
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {statusChartData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                    <span className="font-sans text-xs text-muted-foreground">{d.name} ({d.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bar — by category */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="font-montserrat text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[240px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryBarData}
                      layout="vertical"
                      margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        width={110}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
                        cursor={{ fill: `${accentColor}15` }}
                      />
                      <Bar dataKey="Acciones" radius={[0, 6, 6, 0]} fill={accentColor} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── All Actions ── */}
      <div className="space-y-5">
        <h3 className="font-montserrat text-lg font-bold text-foreground">Detalle por Categoría</h3>
        {Object.entries(groupedProjects).map(([category, projects]) => (
          <div key={category}>
            <div
              className="mb-3 flex items-center gap-2 rounded-lg px-4 py-2"
              style={{ background: `${accentColor}12` }}
            >
              <span className="h-1 w-5 rounded-full" style={{ background: accentColor }} />
              <span className="font-montserrat text-sm font-bold" style={{ color: accentColor }}>
                {category}
              </span>
            </div>
            <div className="grid gap-2 pl-2">
              {projects.map(project => {
                const { label, color } = STATUS_META[project.status]
                return (
                  <div
                    key={project.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
                  >
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-montserrat text-sm font-semibold text-foreground">{project.name}</p>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                          style={{ background: color }}
                        >
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-sm text-muted-foreground leading-relaxed">
                        {project.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
