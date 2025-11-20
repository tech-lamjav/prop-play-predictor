import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/i18n'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import { config } from './config/environment'

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
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
