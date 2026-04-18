export type Language = 'es' | 'en'

export type Translations = {
  appSubtitle: string
  welcomeMessage: string
  disclaimer: string
  inputPlaceholder: string
  inputConsulting: string
  inputAriaLabel: string
  sendAriaLabel: string
  thinkingLabel: string
  thinkingAriaLabel: string
  conversationAriaLabel: string
  sessionActive: string
  openSidebar: string
  closeSidebar: string
  changeTheme: string
  themeDark: string
  themeLight: string
  langToggleLabel: string
  langToggleAriaLabel: string
  errorFallback: string
  encryptionLabel: string
  connectionLabel: string
  modelSelectorTitle: string
  modelSelectorAriaLabel: string
  engineLabel: string
  capabilityAnalysis: string
  capabilityCharts: string
  capabilityExport: string
  capabilityFabric: string
  exportTableCsv: string
  micStartAriaLabel: string
  micStopAriaLabel: string
  micListeningHint: string
  micPermissionDenied: string
  micErrorGeneric: string
  ttsEnableAriaLabel: string
  ttsDisableAriaLabel: string
  suggestions: string[]
}

export const translations: Record<Language, Translations> = {
  es: {
    appSubtitle: 'Terminal Seguro',
    welcomeMessage:
      'Bienvenido a FiBot. Soy tu asistente seguro de asesoría financiera. ¿Cómo puedo ayudarte hoy a analizar los mercados o revisar tu portafolio?',
    disclaimer: 'FiBot puede generar información inexacta. No constituye asesoría financiera.',
    inputPlaceholder: 'Pregúntale a FiBot Expert sobre datos financieros...',
    inputConsulting: 'Consultando agente de IA...',
    inputAriaLabel: 'Entrada de chat',
    sendAriaLabel: 'Enviar mensaje',
    thinkingLabel: 'Asistente está pensando',
    thinkingAriaLabel: 'El asistente está pensando',
    conversationAriaLabel: 'Conversación',
    sessionActive: 'Sesión activa',
    openSidebar: 'Abrir menú lateral',
    closeSidebar: 'Cerrar menú lateral',
    changeTheme: 'Cambiar tema',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    langToggleLabel: 'EN',
    langToggleAriaLabel: 'Cambiar a inglés',
    errorFallback:
      'No pude responder en este momento. Verifica la conexión con el proveedor de IA e inténtalo de nuevo.',
    encryptionLabel: 'Cifrado de extremo a extremo',
    connectionLabel: 'Conectado a OpenAI',
    modelSelectorTitle: 'Seleccionar modelo de IA',
    modelSelectorAriaLabel: 'Selector de modelo',
    exportTableCsv: 'Exportar tabla como CSV',
    micStartAriaLabel: 'Dictar por voz',
    micStopAriaLabel: 'Detener dictado',
    micListeningHint: 'Escuchando...',
    micPermissionDenied: 'Permiso de micrófono denegado. Habilítalo en la configuración del navegador.',
    micErrorGeneric: 'No se pudo iniciar el dictado de voz.',
    ttsEnableAriaLabel: 'Activar lectura en voz alta de las respuestas',
    ttsDisableAriaLabel: 'Desactivar lectura en voz alta',
    engineLabel: 'Motor activo',
    capabilityAnalysis: 'Análisis financiero',
    capabilityCharts: 'Gráficos interactivos',
    capabilityExport: 'Exportación de datos',
    capabilityFabric: 'Conexión Data Fabric',
    suggestions: [
      'Generar gráficos de Facturación',
      'Costos y gastos',
      'Utilidad neta',
      'Cálculo EBITDA',
    ],
  },
  en: {
    appSubtitle: 'Secure Terminal',
    welcomeMessage:
      'Welcome to FiBot. I am your secure financial advisory assistant. How can I help you today analyze markets or review your portfolio?',
    disclaimer: 'FiBot may generate inaccurate information. It does not constitute financial advice.',
    inputPlaceholder: 'Ask FiBot Expert about financial data...',
    inputConsulting: 'Querying AI agent...',
    inputAriaLabel: 'Chat input',
    sendAriaLabel: 'Send message',
    thinkingLabel: 'Assistant is thinking',
    thinkingAriaLabel: 'The assistant is thinking',
    conversationAriaLabel: 'Conversation',
    sessionActive: 'Active session',
    openSidebar: 'Open sidebar',
    closeSidebar: 'Close sidebar',
    changeTheme: 'Change theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    langToggleLabel: 'ES',
    langToggleAriaLabel: 'Switch to Spanish',
    errorFallback: 'I could not respond at this time. Check the connection with the AI provider and try again.',
    encryptionLabel: 'End-to-end encrypted',
    connectionLabel: 'Connected to OpenAI',
    modelSelectorTitle: 'Select AI model',
    modelSelectorAriaLabel: 'Model selector',
    exportTableCsv: 'Export table as CSV',
    micStartAriaLabel: 'Dictate by voice',
    micStopAriaLabel: 'Stop dictation',
    micListeningHint: 'Listening...',
    micPermissionDenied: 'Microphone permission denied. Enable it in your browser settings.',
    micErrorGeneric: 'Could not start voice dictation.',
    ttsEnableAriaLabel: 'Enable spoken responses',
    ttsDisableAriaLabel: 'Disable spoken responses',
    engineLabel: 'Active engine',
    capabilityAnalysis: 'Financial analysis',
    capabilityCharts: 'Interactive charts',
    capabilityExport: 'Data export',
    capabilityFabric: 'Data Fabric connection',
    suggestions: [
      'Generate Billing charts',
      'Costs and expenses',
      'Net profit',
      'EBITDA Calculation',
    ],
  },
}
