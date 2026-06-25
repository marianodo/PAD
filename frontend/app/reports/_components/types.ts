export type ProjectStatus = "en_ejecucion" | "planificado" | "completado" | "continuo"

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  category?: string
}

export interface Segment {
  id: string
  name: string
  icon: string
  color: string
  description: string
  totalProjects: number
  projectsEnEjecucion: number
  projectsPlanificados: number
  projectsCompletados: number
  projectsContinuos: number
  projects: Project[]
}

export interface ReportConfig {
  badge: string
  title: string
  titleHighlight: string
  description: string
  descriptionMaxWidth?: string
  statsCategoryLabel: string
  segmentWord: string
  year: string
  footer: string
}

export interface ReportDocument {
  slug?: string
  period?: string
  title?: string
  config: ReportConfig
  segments: Segment[]
}
