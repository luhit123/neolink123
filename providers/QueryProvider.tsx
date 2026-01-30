/**
 * React Query Provider
 *
 * Provides smart data fetching, caching, and state management.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus (can be annoying in medical apps)
      refetchOnWindowFocus: false,

      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Keep data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Retry failed requests 2 times
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Network mode - always try to fetch if online
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once
      retry: 1,

      // Network mode
      networkMode: 'online',
    },
  },
});

// Export for use outside of React (e.g., prefetching)
export { queryClient };

// Provider component
export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

export default QueryProvider;
