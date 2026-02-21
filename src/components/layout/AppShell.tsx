import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

type AppShellProps = {
  topBar: ReactNode
  children: ReactNode
}

export function AppShell({ topBar, children }: Readonly<AppShellProps>) {
  return (
    <div className="flex h-screen min-h-[768px] min-w-[1366px] bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        {topBar}
        {children}
      </section>
    </div>
  )
}
