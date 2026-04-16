import React from 'react';

/** Placeholder for team flag/crest — will be replaced with actual image later */
export function TeamFlag({ code }: { code: string }) {
  return (
    <div
      className="w-5 h-3.5 rounded-sm bg-terminal-border-subtle/40 border border-terminal-border-subtle/60 shrink-0 overflow-hidden"
      title={code}
    />
  );
}
