import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

type AppShellProps = {
  topBar: ReactNode
  children: ReactNode
  isSidebarOpen: boolean
  onCloseSidebar: () => void
  closeSidebarLabel: string
  appSubtitle: string
  modelSelectorTitle: string
  modelSelectorAriaLabel: string
  engineLabel: string
  capabilityAnalysis: string
  capabilityCharts: string
  capabilityExport: string
  capabilityFabric: string
}

export function AppShell({
  topBar,
  children,
  isSidebarOpen,
  onCloseSidebar,
  closeSidebarLabel,
  appSubtitle,
  modelSelectorTitle,
  modelSelectorAriaLabel,
  engineLabel,
  capabilityAnalysis,
  capabilityCharts,
  capabilityExport,
  capabilityFabric,
}: Readonly<AppShellProps>) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-slate-100 dark:bg-slate-950 md:h-screen md:flex-row">
      <div
        className={`fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-200 ease-in-out md:static md:z-auto md:w-[280px] md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          appSubtitle={appSubtitle}
          modelSelectorTitle={modelSelectorTitle}
          modelSelectorAriaLabel={modelSelectorAriaLabel}
          engineLabel={engineLabel}
          capabilityAnalysis={capabilityAnalysis}
          capabilityCharts={capabilityCharts}
          capabilityExport={capabilityExport}
          capabilityFabric={capabilityFabric}
        />
      </div>
      <button
        type="button"
        onClick={onCloseSidebar}
        className={`fixed inset-0 z-30 bg-slate-950/40 transition-opacity duration-200 md:hidden ${
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-label={closeSidebarLabel}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        {topBar}
        {children}
      </section>
    </div>
  )
}
