type EncryptionStatusBadgeProps = {
  label: string
}

export function EncryptionStatusBadge({ label }: Readonly<EncryptionStatusBadgeProps>) {
  return (
    <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
      {label}
    </div>
  )
}
