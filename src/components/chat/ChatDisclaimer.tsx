type ChatDisclaimerProps = {
  text: string
}

export function ChatDisclaimer({ text }: ChatDisclaimerProps) {
  return <p className="pb-4 text-center text-xs text-slate-500 dark:text-slate-400">{text}</p>
}
