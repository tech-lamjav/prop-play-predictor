import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@posthog/react'

/**
 * Component to track page views with PostHog
 * This component should be placed inside the Router to track route changes
 */
export const PostHogPageView = () => {
  const location = useLocation()
  const posthog = usePostHog()

  useEffect(() => {
    if (posthog) {
      posthog.capture('$pageview', {
        $current_url: window.location.href,
        path: location.pathname,
      })
    }
  }, [location, posthog])

  return null
}

