import type { ModelOption } from '../../types/ui'
import { ModelOptionItem } from './ModelOptionItem'

type ModelSelectorProps = {
  items: ModelOption[]
  onSelect: (id: string) => void
  title: string
  ariaLabel: string
}

export function ModelSelector({ items, onSelect, title, ariaLabel }: Readonly<ModelSelectorProps>) {
  return (
    <section className="space-y-2" aria-label={ariaLabel}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      {items.map((item) => (
        <ModelOptionItem key={item.id} item={item} onSelect={onSelect} />
      ))}
    </section>
  )
}
