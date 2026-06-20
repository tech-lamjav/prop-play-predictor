import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Target,
  BarChart3,
  Flame,
  Snowflake,
  type LucideIcon,
} from 'lucide-react';
import type { IconName } from '@/utils/dashboardAggregations';

const ICON_MAP: Record<IconName, LucideIcon> = {
  'trending-up': TrendingUp,
  'alert-triangle': AlertTriangle,
  target: Target,
  'chart-bar': BarChart3,
  flame: Flame,
  snowflake: Snowflake,
};

interface InsightIconProps {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}

export const InsightIcon: React.FC<InsightIconProps> = ({
  name,
  className,
  strokeWidth = 2,
}) => {
  const Icon = ICON_MAP[name];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
};
