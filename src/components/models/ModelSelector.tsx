import type { ModelOption } from '../../types/ui'
import { ModelOptionItem } from './ModelOptionItem'

type ModelSelectorProps = {
  items: ModelOption[]
  onSelect: (id: string) => void
}

export function ModelSelector({ items, onSelect }: Readonly<ModelSelectorProps>) {
  return (
    <section className="space-y-2" aria-label="Selector de modelo">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Seleccionar modelo de IA</h2>
      {items.map((item) => (
        <ModelOptionItem key={item.id} item={item} onSelect={onSelect} />
      ))}
    </section>
  )
}
