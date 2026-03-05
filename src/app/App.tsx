import { useEffect, useState } from 'react'
import { ChatComposer } from '../components/chat/ChatComposer'
import { ChatDisclaimer } from '../components/chat/ChatDisclaimer'
import { ChatTimeline } from '../components/chat/ChatTimeline'
import { useChatState } from '../components/chat/useChatState'
import { DISCLAIMER, INPUT_PLACEHOLDER } from '../data/content'
import { sessionStatus } from '../data/mockData'
import { AppShell } from '../components/layout/AppShell'
import { TopStatusBar } from '../components/layout/TopStatusBar'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'fibot-theme'

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { messages, draftMessage, setDraftMessage, canSend, sendMessage, isSending } = useChatState()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  const toggleSidebar = () => {
    setIsSidebarOpen((currentState) => !currentState)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <AppShell
      isSidebarOpen={isSidebarOpen}
      onCloseSidebar={closeSidebar}
      topBar={
        <TopStatusBar
          encryptionLabel={sessionStatus.encryptionLabel}
          connectionLabel={sessionStatus.connectionLabel}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
        />
      }
    >
      <ChatTimeline messages={messages} />
      <div className="border-t border-slate-200 bg-slate-100 px-3 pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:pt-4">
        <ChatComposer
          value={draftMessage}
          onChange={setDraftMessage}
          onSend={sendMessage}
          canSend={canSend}
          placeholder={INPUT_PLACEHOLDER}
          isSending={isSending}
        />
        <ChatDisclaimer text={DISCLAIMER} />
      </div>
    </AppShell>
  )
}
