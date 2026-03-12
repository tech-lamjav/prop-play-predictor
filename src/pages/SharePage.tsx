import React from 'react';
import { useParams } from 'react-router-dom';
import { useShareResolve } from '@/hooks/use-share-resolve';
import { ShareLayout } from '@/components/share/ShareLayout';
import { ShareKpiCards } from '@/components/share/ShareKpiCards';
import { ShareBankrollChart } from '@/components/share/ShareBankrollChart';
import { ShareBreakdownCharts } from '@/components/share/ShareBreakdownCharts';
import { ShareBetsTable } from '@/components/share/ShareBetsTable';
import { ShareLoadingSkeleton } from '@/components/share/ShareLoadingSkeleton';
import { ShareErrorState } from '@/components/share/ShareErrorState';
import { ShareEmptyState } from '@/components/share/ShareEmptyState';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error, refetch } = useShareResolve(token);

  if (isLoading) {
    return <ShareLoadingSkeleton />;
  }

  if (isError) {
    const err = error as Error & { status?: number; message?: string };
    const status = err?.status;
    const message = err?.message ?? '';
    return (
      <ShareErrorState
        status={status}
        message={message}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data) {
    return null;
  }

  if (data.bets.length === 0) {
    return (
      <ShareLayout
        ownerName={data.owner.name}
        filtersSnapshot={data.filters_snapshot}
      >
        <ShareEmptyState />
      </ShareLayout>
    );
  }

  return (
    <ShareLayout
      ownerName={data.owner.name}
      filtersSnapshot={data.filters_snapshot}
    >
      <div className="space-y-6">
        <ShareKpiCards bets={data.bets} />
        <ShareBankrollChart bets={data.bets} />
        <ShareBreakdownCharts bets={data.bets} />
        <ShareBetsTable bets={data.bets} />
      </div>
    </ShareLayout>
  );
}
