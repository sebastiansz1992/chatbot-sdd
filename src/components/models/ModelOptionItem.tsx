import type { ModelOption } from '../../types/ui'
import { FiActivity, FiCpu, FiTrendingUp } from 'react-icons/fi'

type ModelOptionItemProps = {
  item: ModelOption
  onSelect: (id: string) => void
}

export function ModelOptionItem({ item, onSelect }: Readonly<ModelOptionItemProps>) {
  const AgentIcon =
    item.id === 'fin-gpt-expert'
      ? FiTrendingUp
      : item.id === 'claude-analyst'
        ? FiActivity
        : FiCpu

  const providerAccentClass =
    item.provider === 'OpenAI'
      ? 'text-emerald-600 dark:text-emerald-300'
      : item.provider === 'Anthropic'
        ? 'text-violet-600 dark:text-violet-300'
        : 'text-sky-600 dark:text-sky-300'

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`w-full rounded-xl border px-3 py-2 text-left ${
        item.isSelected
          ? 'border-blue-200 bg-blue-50 text-slate-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-slate-100'
          : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
      aria-pressed={item.isSelected}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            item.isSelected
              ? 'bg-white/80 text-blue-700 dark:bg-slate-900/80 dark:text-blue-300'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
          aria-hidden="true"
        >
          <AgentIcon size={14} className={providerAccentClass} />
        </span>
        <div>
          <p className="text-sm font-medium">{item.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{item.provider}</p>
        </div>
      </div>
    </button>
  )
}
