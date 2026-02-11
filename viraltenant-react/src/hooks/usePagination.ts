import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  initialLimit?: number;
  increment?: number;
}

export function usePagination<T>(items: T[], options: UsePaginationOptions = {}) {
  const { initialLimit = 12, increment = 12 } = options;
  const [displayCount, setDisplayCount] = useState(initialLimit);

  const displayedItems = useMemo(() => {
    return items.slice(0, displayCount);
  }, [items, displayCount]);

  const hasMore = displayCount < items.length;
  const remainingCount = items.length - displayCount;

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + increment, items.length));
  };

  const reset = () => {
    setDisplayCount(initialLimit);
  };

  return {
    displayedItems,
    hasMore,
    remainingCount,
    loadMore,
    reset,
    totalCount: items.length,
    displayCount
  };
}
