import { isDevelopment, isStaging } from '@/config/environment';

/**
 * Visual banner indicating the current environment. Only shown in dev/staging, never in production.
 */
export function EnvironmentBanner() {
  if (!isDevelopment && !isStaging) return null;

  const label = isDevelopment ? 'DEV' : 'STAGING';
  const bgColor = isDevelopment ? 'bg-amber-500' : 'bg-blue-600';

  return (
    <div
      className={`${bgColor} text-white text-center text-xs font-medium py-1 px-2`}
      role="status"
      aria-label={`Environment: ${label}`}
    >
      {label}
    </div>
  );
}
