import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
// Fonte do rebrand do Bolão — Inter Variable (UI + display).
// Display usa peso alto + tracking apertado em vez de serif, mantendo coesão
// com a identidade "data/profissional" do Smart Betting.
import '@fontsource-variable/inter'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import { config } from './config/environment'
// A inicialização do idioma é GLOBAL e acontece UMA vez, aqui. Antes do #534
// três telas importavam o i18next cada uma por conta própria, e nenhuma delas
// usava. Ver src/i18n/init.ts.
import { iniciarIdioma } from './i18n/init'

iniciarIdioma()

// Initialize PostHog
if (config.posthog.key) {
  posthog.init(config.posthog.key, {
    api_host: config.posthog.host,
    person_profiles: 'identified_only', // Only create profiles for identified users
    capture_pageview: false, // We'll handle pageviews manually with React Router
    capture_pageleave: true,
  })
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </HelmetProvider>
);
