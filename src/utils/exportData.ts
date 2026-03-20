function escapeCsvCell(value: string): string {
  const str = String(value).trim()
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export function downloadCsv(filename: string, rows: string[][]): void {
  if (!rows.length) return
  const csv = '\uFEFF' + rowsToCsv(rows) // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function tableElementToRows(table: HTMLTableElement): string[][] {
  return Array.from(table.rows).map((row) =>
    Array.from(row.cells).map((cell) => cell.innerText.trim()),
  )
}

function normalizeJsLikeJson(raw: string): string {
  return raw
    .replaceAll("'", '"')
    .replace(/([{,]\s*)([a-zA-Z_]\w*)(\s*):/g, '$1"$2"$3:')
}

function parseQuickChartConfig(configStr: string): Record<string, unknown> | null {
  for (const attempt of [configStr, normalizeJsLikeJson(configStr)]) {
    try {
      return JSON.parse(attempt) as Record<string, unknown>
    } catch {
      // try next
    }
  }
  return null
}

export function quickChartSrcToRows(src: string): string[][] | null {
  try {
    const url = new URL(src)
    const configParam = url.searchParams.get('c')
    if (!configParam) return null

    const config = parseQuickChartConfig(decodeURIComponent(configParam))
    if (!config) return null

    const data = config.data as Record<string, unknown> | undefined
    const labels = (data?.labels as string[] | undefined) ?? []
    const datasets = (data?.datasets as Array<{ label?: string; data?: number[] }> | undefined) ?? []

    if (!datasets.length) return null

    const header = ['Label', ...datasets.map((d, i) => d.label ?? `Serie ${i + 1}`)]
    const dataRows = labels.map((label, idx) => [
      label,
      ...datasets.map((d) => String(d.data?.[idx] ?? '')),
    ])

    return [header, ...dataRows]
  } catch {
    return null
  }
}
