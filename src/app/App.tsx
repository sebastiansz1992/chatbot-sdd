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

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { messages, draftMessage, setDraftMessage, canSend, sendMessage } = useChatState()
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  return (
    <AppShell
      topBar={
        <TopStatusBar
          encryptionLabel={sessionStatus.encryptionLabel}
          connectionLabel={sessionStatus.connectionLabel}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      }
    >
      <ChatTimeline messages={messages} />
      <div className="border-t border-slate-200 bg-slate-100 px-4 pt-4 dark:border-slate-800 dark:bg-slate-950">
        <ChatComposer
          value={draftMessage}
          onChange={setDraftMessage}
          onSend={sendMessage}
          canSend={canSend}
          placeholder={INPUT_PLACEHOLDER}
        />
        <ChatDisclaimer text={DISCLAIMER} />
      </div>
    </AppShell>
  )
}
