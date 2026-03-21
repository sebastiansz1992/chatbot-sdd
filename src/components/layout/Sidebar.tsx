import { APP_TITLE } from '../../data/content'
import { FiTrendingUp, FiBarChart2, FiDownload, FiDatabase } from 'react-icons/fi'
import fibotImage from '../../assets/fibot_sin fondo.png'

type SidebarProps = {
  appSubtitle: string
  modelSelectorTitle: string
  modelSelectorAriaLabel: string
  engineLabel: string
  capabilityAnalysis: string
  capabilityCharts: string
  capabilityExport: string
  capabilityFabric: string
}

const capabilities = [
  { key: 'analysis', Icon: FiTrendingUp },
  { key: 'charts', Icon: FiBarChart2 },
  { key: 'export', Icon: FiDownload },
  { key: 'fabric', Icon: FiDatabase },
] as const

type CapabilityKey = (typeof capabilities)[number]['key']

export function Sidebar({
  appSubtitle,
  engineLabel,
  capabilityAnalysis,
  capabilityCharts,
  capabilityExport,
  capabilityFabric,
}: Readonly<SidebarProps>) {
  const capabilityLabels: Record<CapabilityKey, string> = {
    analysis: capabilityAnalysis,
    charts: capabilityCharts,
    export: capabilityExport,
    fabric: capabilityFabric,
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 px-3 py-4 dark:border-slate-800 dark:bg-slate-900 md:w-[280px] md:border-b-0 md:border-r">
      {/* Header con mascota */}
      <div className="mb-6 flex flex-col items-center gap-2 px-2">
        <img
          src={fibotImage}
          alt="FiBot mascot"
          className="h-24 w-24 rounded-2xl object-cover shadow-lg shadow-blue-500/10 dark:shadow-blue-400/10"
        />
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{APP_TITLE}</p>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">{appSubtitle}</p>
        </div>
      </div>

      {/* Separador */}
      <div className="mx-2 mb-5 border-t border-slate-200 dark:border-slate-700/60" />

      {/* Motor activo */}
      <div className="mb-5 px-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {engineLabel}
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <FiTrendingUp size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">FinGPT Expert</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Capacidades */}
      <div className="px-2">
        <div className="space-y-1.5">
          {capabilities.map(({ key, Icon }) => (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-slate-600 dark:text-slate-300"
            >
              <Icon size={14} className="shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="text-xs font-medium">{capabilityLabels[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer para empujar el footer al fondo */}
      <div className="flex-1" />

      {/* Footer branding */}
      <div className="mx-2 border-t border-slate-200 pt-3 dark:border-slate-700/60">
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          Powered by Thinkus AI
        </p>
      </div>
    </aside>
  )
}
