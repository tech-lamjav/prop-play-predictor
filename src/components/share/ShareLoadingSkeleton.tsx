import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const ShareLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-terminal-black">
      <header className="border-b border-terminal-border bg-terminal-dark-gray">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Skeleton className="h-6 w-48 bg-terminal-gray mb-2" />
          <Skeleton className="h-5 w-64 bg-terminal-gray" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-terminal-dark-gray border-terminal-border">
              <CardHeader className="pb-1 pt-4 px-4">
                <Skeleton className="h-4 w-24 bg-terminal-gray" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Skeleton className="h-7 w-20 bg-terminal-gray" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[280px] w-full bg-terminal-gray rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
        </div>
      </main>
    </div>
  );
};
