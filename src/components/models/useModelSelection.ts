import { useMemo, useState } from 'react'
import { modelOptions } from '../../data/mockData'

export function useModelSelection() {
  const [selectedModelId, setSelectedModelId] = useState(
    modelOptions.find((model) => model.isSelected)?.id ?? modelOptions[0].id
  )

  const items = useMemo(
    () =>
      modelOptions.map((model) => ({
        ...model,
        isSelected: model.id === selectedModelId,
      })),
    [selectedModelId]
  )

  return {
    items,
    selectedModelId,
    setSelectedModelId,
  }
}
