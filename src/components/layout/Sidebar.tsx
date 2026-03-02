import { APP_SUBTITLE, APP_TITLE } from '../../data/content'
import { FiCpu } from 'react-icons/fi'
import { ModelSelector } from '../models/ModelSelector'
import { useModelSelection } from '../models/useModelSelection'

export function Sidebar() {
  const { items, setSelectedModelId } = useModelSelection()

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-slate-50 px-3 py-4 dark:border-slate-800 dark:bg-slate-900 md:w-[280px] md:border-b-0 md:border-r">
      <div className="mb-4 flex items-center gap-3 px-2 md:mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          <FiCpu aria-hidden="true" />
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-800 dark:text-slate-100 md:text-2xl">{APP_TITLE}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{APP_SUBTITLE}</p>
        </div>
      </div>
      <div className="space-y-5">
        <ModelSelector items={items} onSelect={setSelectedModelId} />
      </div>
    </aside>
  )
}
