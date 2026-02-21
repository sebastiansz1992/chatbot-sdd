import { ActiveSessionStatus } from './ActiveSessionStatus'
import { EncryptionStatusBadge } from './EncryptionStatusBadge'
import { FiMoon, FiSun } from 'react-icons/fi'

type TopStatusBarProps = {
  encryptionLabel: string
  connectionLabel: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function TopStatusBar({
  encryptionLabel,
  connectionLabel,
  theme,
  onToggleTheme,
}: Readonly<TopStatusBarProps>) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-3 dark:border-slate-800 dark:bg-slate-900" aria-label="Estado de sesión y seguridad">
      <div className="flex items-center gap-3">
        <EncryptionStatusBadge label={encryptionLabel} />
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          aria-label="Cambiar tema"
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
          {theme === 'dark' ? 'Oscuro' : 'Claro'}
        </button>
      </div>
      <div className="text-right" aria-label="Estado de sesión activa">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Sesión activa</p>
        <ActiveSessionStatus label={connectionLabel} />
      </div>
    </header>
  )
}
