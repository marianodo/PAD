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

export const segments: Segment[] = [
  {
    id: "espacios-publicos",
    name: "Espacios Publicos",
    icon: "Trees",
    color: "chart-1",
    description: "Obras de mantenimiento, renovación y construcción de espacios de uso colectivo en la ciudad.",
    totalProjects: 9,
    projectsEnEjecucion: 3,
    projectsPlanificados: 2,
    projectsCompletados: 0,
    projectsContinuos: 4,
    projects: [
      {
        id: "ep-1",
        name: "Nuevo Playon Deportivo",
        description: "Construccion en el sector sur del predio del Parque Deportivo, integrando la historica calesita del Bebe Martinez y conectando con la Avenida del Libertador",
        status: "planificado",
        category: "Obras Proyectadas"
      },
      {
        id: "ep-2",
        name: "Restauracion del Viejo Casino",
        description: "Obra adjudicada para recuperar valor estructural e integrarlo al circuito turistico",
        status: "en_ejecucion",
        category: "Obras Proyectadas"
      },
      {
        id: "ep-3",
        name: "Transformacion de Belgrano 15",
        description: "Convenio con Banco Nacion para crear nuevo espacio con edificio municipal, ferias, areas de esparcimiento y servicios",
        status: "planificado",
        category: "Obras Proyectadas"
      },
      {
        id: "ep-4",
        name: "Recuperacion de la Colonia Santa Fe",
        description: "Restauracion integral con financiamiento de la Provincia de Cordoba",
        status: "en_ejecucion",
        category: "Obras Proyectadas"
      },
      {
        id: "ep-5",
        name: "Centros de Participacion Vecinal",
        description: "Construccion de dos centros en barrios Villa Oviedo y Valle Buena Esperanza",
        status: "en_ejecucion",
        category: "Obras Proyectadas"
      },
      {
        id: "ep-6",
        name: "Remodelacion Avenida Libertador",
        description: "Finalizacion de repavimentacion y modernizacion (etapa Llorens-Genova) con mas verde en cantero central",
        status: "continuo",
        category: "Mantenimiento"
      },
      {
        id: "ep-7",
        name: "Iluminacion LED",
        description: "Renovacion del sistema de luminarias para mejorar seguridad y eficiencia energetica en todos los barrios",
        status: "continuo",
        category: "Mantenimiento"
      },
      {
        id: "ep-8",
        name: "Puntos Verdes",
        description: "Mantenimiento de 13 puntos verdes de reciclaje",
        status: "continuo",
        category: "Mantenimiento"
      },
      {
        id: "ep-9",
        name: "Plan de Reforestacion",
        description: "Mas de 1,000 arboles plantados",
        status: "continuo",
        category: "Mantenimiento"
      }
    ]
  },
  {
    id: "servicios-publicos",
    name: "Servicios Publicos",
    icon: "Wrench",
    color: "chart-2",
    description: "Gestión de infraestructura de servicios básicos, residuos, movilidad y atención ciudadana.",
    totalProjects: 9,
    projectsEnEjecucion: 2,
    projectsPlanificados: 2,
    projectsCompletados: 0,
    projectsContinuos: 5,
    projects: [
      {
        id: "sp-1",
        name: "Fortalecimiento Flota Municipal",
        description: "Compra de camiones, maquinaria vial y equipamiento propio para autonomia operativa",
        status: "continuo",
        category: "Inversiones Realizadas"
      },
      {
        id: "sp-2",
        name: "Infraestructura Basica",
        description: "Ampliacion y sostenimiento de redes de agua y cloacas",
        status: "continuo",
        category: "Inversiones Realizadas"
      },
      {
        id: "sp-3",
        name: "Modernizacion Luminica",
        description: "Implementacion y renovacion con tecnologia LED",
        status: "continuo",
        category: "Inversiones Realizadas"
      },
      {
        id: "sp-4",
        name: "Gestion de Residuos",
        description: "Mantenimiento de 13 puntos verdes para separacion en origen",
        status: "continuo",
        category: "Inversiones Realizadas"
      },
      {
        id: "sp-5",
        name: "Centro de Acopio REUSAR",
        description: "Recuperacion de mas de 141 toneladas de materiales reciclables",
        status: "continuo",
        category: "Inversiones Realizadas"
      },
      {
        id: "sp-6",
        name: "Asistente Virtual (Bot)",
        description: "Atencion 24/7 para consultas y reclamos",
        status: "en_ejecucion",
        category: "Proyectos 2026"
      },
      {
        id: "sp-7",
        name: "Nuevos Loteos con Servicios",
        description: "Mas de 200 lotes planificados (100 zona sur, 100 sector Mujica) con servicios integrados",
        status: "planificado",
        category: "Proyectos 2026"
      },
      {
        id: "sp-8",
        name: "Transicion Energetica",
        description: "Integracion a Red Provincial de Carga de EPEC para movilidad electrica",
        status: "en_ejecucion",
        category: "Proyectos 2026"
      },
      {
        id: "sp-9",
        name: "Mantenimiento Espacios Publicos",
        description: "Cuadrillas para limpieza, iluminacion y cuidado de plazas y costanera",
        status: "planificado",
        category: "Proyectos 2026"
      }
    ]
  },
  {
    id: "deportes-cultura-turismo",
    name: "Deportes, Cultura y Turismo",
    icon: "Trophy",
    color: "chart-3",
    description: "Acciones en infraestructura deportiva, patrimonio cultural y fomento del turismo local.",
    totalProjects: 12,
    projectsEnEjecucion: 2,
    projectsPlanificados: 2,
    projectsCompletados: 4,
    projectsContinuos: 4,
    projects: [
      {
        id: "dct-1",
        name: "Nuevo Playon Deportivo",
        description: "Construccion en sector sur del Parque Deportivo con integracion a calesita del Bebe Martinez",
        status: "planificado",
        category: "Deportes"
      },
      {
        id: "dct-2",
        name: "Pista de BMX",
        description: "Sede de campeonatos internacionales - Mantenimiento continuo",
        status: "continuo",
        category: "Deportes"
      },
      {
        id: "dct-3",
        name: "Programa Cuna de Campeones",
        description: "Apoyo a atletas de alto rendimiento",
        status: "continuo",
        category: "Deportes"
      },
      {
        id: "dct-4",
        name: "Escuelas Municipales Deportivas",
        description: "Natacion, atletismo, voley, handball, basquet, deporte adaptado y newcom",
        status: "continuo",
        category: "Deportes"
      },
      {
        id: "dct-5",
        name: "Festival Peperina - 10a Edicion",
        description: "Organizacion de la decima edicion del festival en 2026",
        status: "planificado",
        category: "Cultura"
      },
      {
        id: "dct-6",
        name: "Agenda Cultural Anual",
        description: "Encuentro de Colectividades, Festival Mionca, Jazz de Invierno, Happy Birra",
        status: "continuo",
        category: "Cultura"
      },
      {
        id: "dct-7",
        name: "Restauracion Viejo Casino",
        description: "Obra ya adjudicada para restauracion integral",
        status: "en_ejecucion",
        category: "Patrimonio"
      },
      {
        id: "dct-8",
        name: "Recuperacion Colonia Santa Fe",
        description: "Financiamiento provincial para restauracion",
        status: "en_ejecucion",
        category: "Patrimonio"
      },
      {
        id: "dct-9",
        name: "Cine Teatro Monumental",
        description: "Puesta en valor completada",
        status: "completado",
        category: "Patrimonio"
      },
      {
        id: "dct-10",
        name: "Parque del Sierras Hotel",
        description: "Recuperacion completada",
        status: "completado",
        category: "Patrimonio"
      },
      {
        id: "dct-11",
        name: "Hornos de Cal",
        description: "Puesta en valor completada",
        status: "completado",
        category: "Patrimonio"
      },
      {
        id: "dct-12",
        name: "Paseo de la Cisterna",
        description: "Creacion completada",
        status: "completado",
        category: "Patrimonio"
      }
    ]
  },
  {
    id: "ayuda-social",
    name: "Ayuda Social",
    icon: "Heart",
    color: "chart-4",
    description: "Programas de asistencia social, formación, primera infancia y atención a adultos mayores.",
    totalProjects: 10,
    projectsEnEjecucion: 3,
    projectsPlanificados: 1,
    projectsCompletados: 0,
    projectsContinuos: 6,
    projects: [
      {
        id: "as-1",
        name: "Programa Estamos Cerca",
        description: "Eje central de gestion social con asistencia inmediata alimentaria y economica",
        status: "continuo",
        category: "Programas Sociales"
      },
      {
        id: "as-2",
        name: "Programa Terminar la Escuela",
        description: "Nueva iniciativa para quienes cursaron ultimo ano de secundario sin titularse",
        status: "planificado",
        category: "Educacion"
      },
      {
        id: "as-3",
        name: "Centro Desarrollo Infantil Parque San Juan",
        description: "Finalizacion de obra para ninos de 45 dias a 3 anos",
        status: "en_ejecucion",
        category: "Primera Infancia"
      },
      {
        id: "as-4",
        name: "Fortalecimiento Salas Cuna",
        description: "Alimentacion y estimulacion profesional",
        status: "continuo",
        category: "Primera Infancia"
      },
      {
        id: "as-5",
        name: "Centro Adultos Mayores Don Bosco",
        description: "Consolidacion del centro",
        status: "continuo",
        category: "Adultos Mayores"
      },
      {
        id: "as-6",
        name: "Beneficios Tributarios Jubilados",
        description: "Continuidad de beneficios para jubilados y pensionados",
        status: "continuo",
        category: "Adultos Mayores"
      },
      {
        id: "as-7",
        name: "Programas Municipales de Empleo",
        description: "Esfuerzos en empleo y gestion de programas provinciales",
        status: "en_ejecucion",
        category: "Empleo"
      },
      {
        id: "as-8",
        name: "Nuevas Diplomaturas UNC",
        description: "Cuatro diplomaturas: Mantenimiento, Estetica, Panificacion y Estilista",
        status: "en_ejecucion",
        category: "Capacitacion"
      },
      {
        id: "as-9",
        name: "Modulos Alimentarios",
        description: "Continuidad en entrega de asistencia directa",
        status: "continuo",
        category: "Asistencia Directa"
      },
      {
        id: "as-10",
        name: "Pases Libres Transporte",
        description: "Para personas con discapacidad",
        status: "continuo",
        category: "Asistencia Directa"
      }
    ]
  },
  {
    id: "obras",
    name: "Obras",
    icon: "Building",
    color: "chart-5",
    description: "Obras de vialidad, infraestructura educativa, sanitaria y desarrollo productivo.",
    totalProjects: 16,
    projectsEnEjecucion: 5,
    projectsPlanificados: 11,
    projectsCompletados: 0,
    projectsContinuos: 0,
    projects: [
      {
        id: "ob-1",
        name: "IPEM 345 Maestro Hugo Barrera",
        description: "Construccion del edificio propio en zona oeste",
        status: "en_ejecucion",
        category: "Infraestructura Educativa"
      },
      {
        id: "ob-2",
        name: "Ampliacion Dispensario 3 Ramon Carrillo",
        description: "Ampliacion para mayor capacidad de atencion",
        status: "en_ejecucion",
        category: "Salud"
      },
      {
        id: "ob-3",
        name: "Centro Desarrollo Infantil Parque San Juan",
        description: "Finalizacion de la obra",
        status: "en_ejecucion",
        category: "Desarrollo Infantil"
      },
      {
        id: "ob-4",
        name: "Remodelacion Avenida Libertador",
        description: "Segunda etapa desde Llorens hasta Genova",
        status: "en_ejecucion",
        category: "Vialidad"
      },
      {
        id: "ob-5",
        name: "Pavimentacion Calle Espana",
        description: "Pavimentacion completa",
        status: "en_ejecucion",
        category: "Vialidad"
      },
      {
        id: "ob-6",
        name: "Adoquinado Calle Belgrano",
        description: "Adoquinado y Boulevard Comechingones",
        status: "planificado",
        category: "Vialidad"
      },
      {
        id: "ob-7",
        name: "Restauracion Viejo Casino",
        description: "Inicio de restauracion integral",
        status: "planificado",
        category: "Patrimonio"
      },
      {
        id: "ob-8",
        name: "Aulas Jardin Amadeo Sabattini",
        description: "Construccion de nuevas aulas",
        status: "planificado",
        category: "Infraestructura Educativa"
      },
      {
        id: "ob-9",
        name: "Aulas Jardin Rector Avanzi",
        description: "Construccion de nuevas aulas",
        status: "planificado",
        category: "Infraestructura Educativa"
      },
      {
        id: "ob-10",
        name: "Nueva Escuela Secundaria Tiro Federal",
        description: "Construccion de nueva escuela para el barrio",
        status: "planificado",
        category: "Infraestructura Educativa"
      },
      {
        id: "ob-11",
        name: "Polo ALA Industrial",
        description: "Parque industrial y polo tecnologico de 145 hectareas",
        status: "planificado",
        category: "Desarrollo Productivo"
      },
      {
        id: "ob-12",
        name: "Centros Participacion Vecinal",
        description: "Villa Oviedo y Valle Buena Esperanza",
        status: "planificado",
        category: "Participacion Vecinal"
      },
      {
        id: "ob-13",
        name: "Rotonda Ruta C-45 Norte",
        description: "Nueva rotonda para ordenamiento vial",
        status: "planificado",
        category: "Vialidad"
      },
      {
        id: "ob-14",
        name: "Pavimentacion Celestina Aguero",
        description: "Pavimentacion en Parque San Juan",
        status: "planificado",
        category: "Vialidad"
      },
      {
        id: "ob-15",
        name: "Nuevos Lotes Zona Sur",
        description: "Mas de 100 lotes planificados",
        status: "planificado",
        category: "Vivienda"
      },
      {
        id: "ob-16",
        name: "Nuevo Playon Deportivo",
        description: "Sector sur con integracion a calesita del Bebe Martinez",
        status: "planificado",
        category: "Deporte"
      }
    ]
  },
  {
    id: "salud",
    name: "Salud",
    icon: "Stethoscope",
    color: "chart-1",
    description: "Infraestructura sanitaria, programas de prevención, atención primaria y formación de recursos humanos.",
    totalProjects: 9,
    projectsEnEjecucion: 3,
    projectsPlanificados: 1,
    projectsCompletados: 1,
    projectsContinuos: 4,
    projects: [
      {
        id: "sa-1",
        name: "Ampliacion Dispensario 3 Ramon Carrillo",
        description: "Ampliacion para mayor capacidad ante crecimiento poblacional",
        status: "en_ejecucion",
        category: "Infraestructura"
      },
      {
        id: "sa-2",
        name: "Nuevo Centro de Salud",
        description: "Centro moderno con especialidades interdisciplinarias recuperado de edificio en semiabandono",
        status: "completado",
        category: "Infraestructura"
      },
      {
        id: "sa-3",
        name: "Historia Clinica Digital",
        description: "Implementacion de sistema digital y turnos accesibles",
        status: "en_ejecucion",
        category: "Modernizacion"
      },
      {
        id: "sa-4",
        name: "Campanas de Prevencion Dengue",
        description: "Intensificacion de campanas preventivas",
        status: "continuo",
        category: "Prevencion"
      },
      {
        id: "sa-5",
        name: "Abordaje Salud Mental - RAAC",
        description: "Fortalecimiento junto a Red Asistencial de las Adicciones de Cordoba",
        status: "continuo",
        category: "Salud Mental"
      },
      {
        id: "sa-6",
        name: "Programas Salud Visual",
        description: "Asistencia en salud visual",
        status: "continuo",
        category: "Programas"
      },
      {
        id: "sa-7",
        name: "Traslados Interurbanos",
        description: "Facilitacion de acceso a traslados por motivos medicos",
        status: "continuo",
        category: "Programas"
      },
      {
        id: "sa-8",
        name: "Salud Escolar",
        description: "Intervenciones en ambito educativo para bienestar estudiantil",
        status: "en_ejecucion",
        category: "Programas"
      },
      {
        id: "sa-9",
        name: "Primeros Egresados Enfermeria",
        description: "30 profesionales formados en Alta Gracia en 2026",
        status: "planificado",
        category: "Formacion"
      }
    ]
  },
  {
    id: "seguridad",
    name: "Seguridad",
    icon: "Shield",
    color: "chart-2",
    description: "Equipamiento de vigilancia, prevención del delito, seguridad vial y formación de efectivos.",
    totalProjects: 10,
    projectsEnEjecucion: 2,
    projectsPlanificados: 3,
    projectsCompletados: 0,
    projectsContinuos: 5,
    projects: [
      {
        id: "se-1",
        name: "Camaras Alta Resolucion",
        description: "Inversion en camaras y domos estrategicos",
        status: "continuo",
        category: "Tecnologia"
      },
      {
        id: "se-2",
        name: "Central de Monitoreo",
        description: "Modernizacion de la central",
        status: "continuo",
        category: "Tecnologia"
      },
      {
        id: "se-3",
        name: "Lectores de Patentes",
        description: "Instalacion en accesos a la ciudad",
        status: "continuo",
        category: "Prevencion"
      },
      {
        id: "se-4",
        name: "Corredores Seguros",
        description: "Zonas con vigilancia permanente",
        status: "continuo",
        category: "Prevencion"
      },
      {
        id: "se-5",
        name: "Guardia Urbana",
        description: "Consolidacion del cuerpo municipal de prevencion activa",
        status: "continuo",
        category: "Prevencion"
      },
      {
        id: "se-6",
        name: "Programa Ojos en Alerta",
        description: "Red ciudadana con casi 3,900 participantes, 80-100 alertas diarias",
        status: "en_ejecucion",
        category: "Participacion"
      },
      {
        id: "se-7",
        name: "Capacitacion Ciudadana",
        description: "Mas de 4,500 vecinos formados en prevencion",
        status: "en_ejecucion",
        category: "Formacion"
      },
      {
        id: "se-8",
        name: "Formacion Nuevos Efectivos",
        description: "60+ suboficiales de policia en formacion",
        status: "planificado",
        category: "Formacion"
      },
      {
        id: "se-9",
        name: "Rotonda Ruta C-45 Norte",
        description: "Nueva rotonda para seguridad vial",
        status: "planificado",
        category: "Vialidad"
      },
      {
        id: "se-10",
        name: "Modernizacion LED",
        description: "Continuacion de iluminacion para seguridad",
        status: "planificado",
        category: "Infraestructura"
      }
    ]
  },
  {
    id: "otras-acciones",
    name: "Otras Acciones",
    icon: "Briefcase",
    color: "chart-3",
    description: "Acciones de desarrollo productivo, modernización administrativa, educación y relaciones institucionales.",
    totalProjects: 11,
    projectsEnEjecucion: 4,
    projectsPlanificados: 4,
    projectsCompletados: 0,
    projectsContinuos: 3,
    projects: [
      {
        id: "oa-1",
        name: "Polo ALA Industrial",
        description: "145 hectareas sobre Ruta C45 para desarrollo industrial y tecnologico",
        status: "en_ejecucion",
        category: "Desarrollo Productivo"
      },
      {
        id: "oa-2",
        name: "Beneficios Fiscales Empresas",
        description: "Proyecto de ordenanza para exenciones a inversores que generen empleo",
        status: "planificado",
        category: "Desarrollo Productivo"
      },
      {
        id: "oa-3",
        name: "Parque PyME",
        description: "Consolidacion del parque inaugurado en 2023",
        status: "continuo",
        category: "Desarrollo Productivo"
      },
      {
        id: "oa-4",
        name: "Nuevas Aulas Jardines Infantes",
        description: "4 aulas para alcanzar 90% cobertura en salas de 3 anos",
        status: "planificado",
        category: "Educacion"
      },
      {
        id: "oa-5",
        name: "Edificio IPEM 345",
        description: "Inicio de construccion del edificio propio",
        status: "en_ejecucion",
        category: "Educacion"
      },
      {
        id: "oa-6",
        name: "Polos Educativos",
        description: "Primeros egresados de Enfermeria y diplomaturas con UNC",
        status: "en_ejecucion",
        category: "Educacion"
      },
      {
        id: "oa-7",
        name: "Nueva Secundaria Tiro Federal",
        description: "Compromiso de construccion de nueva escuela",
        status: "planificado",
        category: "Educacion"
      },
      {
        id: "oa-8",
        name: "Asistente Virtual 24/7",
        description: "Bot para reclamos y consultas",
        status: "en_ejecucion",
        category: "Modernizacion"
      },
      {
        id: "oa-9",
        name: "Digitalizacion de Tramites",
        description: "Licencias de conducir, obras privadas y habilitaciones comerciales",
        status: "planificado",
        category: "Modernizacion"
      },
      {
        id: "oa-10",
        name: "Orden Financiero",
        description: "6 anos de superavit consecutivo",
        status: "continuo",
        category: "Gestion"
      },
      {
        id: "oa-11",
        name: "Simplificacion Administrativa",
        description: "Tramites mas rapidos y menos burocraticos",
        status: "continuo",
        category: "Gestion"
      }
    ]
  }
]

export function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    en_ejecucion: "En Ejecucion",
    planificado: "Planificado",
    completado: "Completado",
    continuo: "Continuo"
  }
  return labels[status]
}

export function getStatusColor(status: ProjectStatus): string {
  const colors: Record<ProjectStatus, string> = {
    en_ejecucion: "bg-chart-2 text-foreground",
    planificado: "bg-chart-3 text-background",
    completado: "bg-chart-1 text-background",
    continuo: "bg-muted text-muted-foreground"
  }
  return colors[status]
}

export function getTotals() {
  return segments.reduce(
    (acc, segment) => {
      acc.totalProjects += segment.totalProjects
      acc.enEjecucion += segment.projectsEnEjecucion
      acc.planificados += segment.projectsPlanificados
      acc.completados += segment.projectsCompletados
      acc.continuos += segment.projectsContinuos
      return acc
    },
    { totalProjects: 0, enEjecucion: 0, planificados: 0, completados: 0, continuos: 0 }
  )
}
