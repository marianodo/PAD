import {
  Trees, Wrench, Trophy, Heart, Building, Stethoscope, Shield, Briefcase,
  GraduationCap, Factory, Wheat, TrendingUp,
  type LucideIcon,
} from "lucide-react"

// Iconos soportados por nombre (segment.icon). Ampliar acá si un cliente usa uno nuevo.
export const iconMap: Record<string, LucideIcon> = {
  Trees, Wrench, Trophy, Heart, Building, Stethoscope, Shield, Briefcase,
  GraduationCap, Factory, Wheat, TrendingUp,
}

export const fallbackIcon: LucideIcon = Building
