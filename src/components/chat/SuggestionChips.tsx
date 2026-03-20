type SuggestionChipsProps = {
  suggestions: string[]
  onSelect: (text: string) => void
  disabled: boolean
}

export function SuggestionChips({ suggestions, onSelect, disabled }: Readonly<SuggestionChipsProps>) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-3 pb-3 sm:px-4">
      {suggestions.map((text) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
