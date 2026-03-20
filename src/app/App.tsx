import { useEffect, useState } from 'react'
import { ChatComposer } from '../components/chat/ChatComposer'
import { ChatDisclaimer } from '../components/chat/ChatDisclaimer'
import { ChatTimeline } from '../components/chat/ChatTimeline'
import { SuggestionChips } from '../components/chat/SuggestionChips'
import { useChatState } from '../components/chat/useChatState'
import { AppShell } from '../components/layout/AppShell'
import { TopStatusBar } from '../components/layout/TopStatusBar'
import { translations, type Language } from '../i18n/translations'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'fibot-theme'
const LANG_STORAGE_KEY = 'fibot-lang'

function getInitialTheme(): Theme {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)

  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialLang(): Language {
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  return stored === 'en' ? 'en' : 'es'
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [lang, setLang] = useState<Language>(getInitialLang)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const t = translations[lang]

  const { messages, draftMessage, setDraftMessage, canSend, sendMessage, isSending } = useChatState(
    t.welcomeMessage,
    lang,
    t.errorFallback,
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  }, [lang])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const toggleLang = () => {
    setLang((current) => (current === 'es' ? 'en' : 'es'))
  }

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <AppShell
      isSidebarOpen={isSidebarOpen}
      onCloseSidebar={closeSidebar}
      closeSidebarLabel={t.closeSidebar}
      appSubtitle={t.appSubtitle}
      modelSelectorTitle={t.modelSelectorTitle}
      modelSelectorAriaLabel={t.modelSelectorAriaLabel}
      topBar={
        <TopStatusBar
          encryptionLabel={t.encryptionLabel}
          connectionLabel={t.connectionLabel}
          sessionActiveLabel={t.sessionActive}
          theme={theme}
          onToggleTheme={toggleTheme}
          changeThemeLabel={t.changeTheme}
          themeDarkLabel={t.themeDark}
          themeLightLabel={t.themeLight}
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          openSidebarLabel={t.openSidebar}
          closeSidebarLabel={t.closeSidebar}
          lang={lang}
          onToggleLang={toggleLang}
          langToggleLabel={t.langToggleLabel}
          langToggleAriaLabel={t.langToggleAriaLabel}
        />
      }
    >
      <ChatTimeline
        messages={messages}
        isAssistantThinking={isSending}
        thinkingLabel={t.thinkingLabel}
        thinkingAriaLabel={t.thinkingAriaLabel}
        conversationAriaLabel={t.conversationAriaLabel}
        exportTableLabel={t.exportTableCsv}
      />
      <div className="border-t border-slate-200 bg-slate-100 px-3 pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:pt-4">
        {messages.length === 1 && (
          <SuggestionChips
            suggestions={t.suggestions}
            onSelect={(text) => sendMessage(text)}
            disabled={isSending}
          />
        )}
        <ChatComposer
          value={draftMessage}
          onChange={setDraftMessage}
          onSend={sendMessage}
          canSend={canSend}
          placeholder={t.inputPlaceholder}
          consultingText={t.inputConsulting}
          inputAriaLabel={t.inputAriaLabel}
          sendAriaLabel={t.sendAriaLabel}
          isSending={isSending}
        />
        <ChatDisclaimer text={t.disclaimer} />
      </div>
    </AppShell>
  )
}
