import { ActiveSessionStatus } from './ActiveSessionStatus'
import { EncryptionStatusBadge } from './EncryptionStatusBadge'
import { FiGlobe, FiMenu, FiMoon, FiSun, FiX } from 'react-icons/fi'
import type { Language } from '../../i18n/translations'

type TopStatusBarProps = {
  encryptionLabel: string
  connectionLabel: string
  sessionActiveLabel: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  changeThemeLabel: string
  themeDarkLabel: string
  themeLightLabel: string
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  openSidebarLabel: string
  closeSidebarLabel: string
  lang: Language
  onToggleLang: () => void
  langToggleLabel: string
  langToggleAriaLabel: string
}

export function TopStatusBar({
  encryptionLabel,
  connectionLabel,
  sessionActiveLabel,
  theme,
  onToggleTheme,
  changeThemeLabel,
  themeDarkLabel,
  themeLightLabel,
  onToggleSidebar,
  isSidebarOpen,
  openSidebarLabel,
  closeSidebarLabel,
  onToggleLang,
  langToggleLabel,
  langToggleAriaLabel,
}: Readonly<TopStatusBarProps>) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6 lg:px-8" aria-label={sessionActiveLabel}>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:hidden"
          aria-label={isSidebarOpen ? closeSidebarLabel : openSidebarLabel}
        >
          {isSidebarOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
        <EncryptionStatusBadge label={encryptionLabel} />
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label={changeThemeLabel}
        >
          <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
            <FiSun
              className={`absolute transition-all duration-200 ease-in-out ${
                theme === 'dark' ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
              }`}
            />
            <FiMoon
              className={`absolute transition-all duration-200 ease-in-out ${
                theme === 'dark' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
            />
          </span>
          {theme === 'dark' ? themeDarkLabel : themeLightLabel}
        </button>
        <button
          type="button"
          onClick={onToggleLang}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label={langToggleAriaLabel}
        >
          <FiGlobe className="h-3.5 w-3.5" aria-hidden="true" />
          {langToggleLabel}
        </button>
      </div>
      <div className="text-left sm:text-right" aria-label={sessionActiveLabel}>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sessionActiveLabel}</p>
        <ActiveSessionStatus label={connectionLabel} />
      </div>
    </header>
  )
}
