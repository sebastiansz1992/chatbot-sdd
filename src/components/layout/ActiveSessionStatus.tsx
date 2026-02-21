type ActiveSessionStatusProps = {
  label: string
}

export function ActiveSessionStatus({ label }: Readonly<ActiveSessionStatusProps>) {
  return <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
}
