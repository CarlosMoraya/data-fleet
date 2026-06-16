import React from 'react';

export default function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-16" role="status" aria-label="Carregando">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}
