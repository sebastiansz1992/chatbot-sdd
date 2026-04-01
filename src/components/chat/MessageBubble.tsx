import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../types/ui'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { FiDownload, FiCpu } from 'react-icons/fi'
import { downloadCsv, tableElementToRows } from '../../utils/exportData'

type MessageBubbleProps = {
  message: ChatMessage
  exportTableLabel: string
}

marked.setOptions({ gfm: true, breaks: true })

function hasHtmlTags(value: string) {
  return /<\s*[a-z][^>]*>/i.test(value)
}

function parseNumberList(raw: string) {
  return raw
    .split(',')
    .map((value) => Number.parseFloat(value.trim()))
    .filter((value) => Number.isFinite(value))
}

function buildQuickChartFromMermaidBlock(block: string) {
  const titleMatch = /title\s+(.+)/i.exec(block)
  const datasetRegex = /"([^"]+)"\s*:\s*\[([^\]]+)\]/g
  const datasets: Array<{ label: string; data: number[] }> = []

  let datasetMatch = datasetRegex.exec(block)
  while (datasetMatch) {
    const label = datasetMatch[1].trim()
    const data = parseNumberList(datasetMatch[2])
    if (data.length) {
      datasets.push({ label, data })
    }
    datasetMatch = datasetRegex.exec(block)
  }

  if (!datasets.length) return ''

  const maxPoints = Math.max(...datasets.map((dataset) => dataset.data.length))
  const labels = Array.from({ length: maxPoints }, (_, index) => `P${index + 1}`)

  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      plugins: {
        title: titleMatch?.[1]?.trim() ? { display: true, text: titleMatch[1].trim() } : undefined,
      },
    },
  }

  const encodedConfig = encodeURIComponent(JSON.stringify(chartConfig))
  return `<img src="https://quickchart.io/chart?c=${encodedConfig}" style="width:80%; max-width:500px;" alt="Grafico generado" />`
}

function replaceMermaidWithQuickChart(raw: string) {
  return raw.replaceAll(/```mermaid\s*([\s\S]*?)```/gi, (_, block: string) => {
    const quickChartHtml = buildQuickChartFromMermaidBlock(block)
    return quickChartHtml || ''
  })
}

function renderAssistantMessage(raw: string) {
  const withCharts = replaceMermaidWithQuickChart(raw)

  if (hasHtmlTags(withCharts)) {
    return withCharts
  }

  const rendered = marked.parse(withCharts)
  return typeof rendered === 'string' ? rendered : withCharts
}

export function MessageBubble({ message, exportTableLabel }: Readonly<MessageBubbleProps>) {
  const isAssistant = message.role === 'assistant'
  const assistantHtml = isAssistant
    ? DOMPurify.sanitize(renderAssistantMessage(message.content), {
        USE_PROFILES: { html: true },
      })
    : ''

  const contentRef = useRef<HTMLDivElement>(null)
  const [hasTables, setHasTables] = useState(false)

  useEffect(() => {
    if (!contentRef.current) return
    setHasTables(contentRef.current.querySelectorAll('table').length > 0)
  }, [assistantHtml])

  const handleExportTables = () => {
    if (!contentRef.current) return
    const tables = Array.from(contentRef.current.querySelectorAll('table'))
    const allRows: string[][] = []
    tables.forEach((table, i) => {
      if (i > 0) allRows.push([])
      allRows.push(...tableElementToRows(table))
    })
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`fibot-tabla-${date}.csv`, allRows)
  }

  if (!isAssistant) {
    return (
      <div className="flex justify-end w-full" data-testid={`message-${message.role}`}>
        <div className="max-w-[75%] rounded-full bg-blue-500 px-4 py-2 text-sm text-white shadow-sm dark:bg-blue-600 sm:max-w-lg">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 w-full" data-testid={`message-${message.role}`}>
      <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <FiCpu size={15} className="text-slate-500 dark:text-slate-400" aria-hidden="true" />
      </div>
      <article className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 shadow-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:max-w-3xl">
        <div
          ref={contentRef}
          className="prose prose-sm max-w-none break-words dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: assistantHtml }}
        />
        {hasTables && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={handleExportTables}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <FiDownload size={12} aria-hidden="true" />
              {exportTableLabel}
            </button>
          </div>
        )}
      </article>
    </div>
  )
}
