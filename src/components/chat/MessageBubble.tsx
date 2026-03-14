import type { ChatMessage } from '../../types/ui'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

type MessageBubbleProps = {
  message: ChatMessage
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
  return raw.replace(/```mermaid\s*([\s\S]*?)```/gi, (_, block: string) => {
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

export function MessageBubble({ message }: Readonly<MessageBubbleProps>) {
  const isAssistant = message.role === 'assistant'
  const assistantHtml = isAssistant
    ? DOMPurify.sanitize(renderAssistantMessage(message.content), {
        USE_PROFILES: { html: true },
      })
    : ''

  return (
    <article
      className={`w-full max-w-full rounded-xl border px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-3xl ${
        isAssistant
          ? 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          : 'ml-auto border-blue-300 bg-blue-50 text-slate-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-slate-100'
      }`}
      data-testid={`message-${message.role}`}
    >
      {isAssistant ? (
        <div className="prose prose-sm max-w-none break-words dark:prose-invert" dangerouslySetInnerHTML={{ __html: assistantHtml }} />
      ) : (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      )}
    </article>
  )
}
