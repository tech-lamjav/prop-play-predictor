import { isDevelopment, isStaging } from "@/config/environment";

export function EnvironmentBanner() {
  if (isDevelopment) {
    return (
      <div className="w-full bg-yellow-400 text-yellow-900 text-center text-xs font-semibold py-1 z-50">
        DEV — ambiente local
      </div>
    );
  }

  if (isStaging) {
    return (
      <div className="w-full bg-orange-500 text-white text-center text-xs font-semibold py-1 z-50">
        STAGING — não usar dados reais
      </div>
    );
  }

  return null;
}
