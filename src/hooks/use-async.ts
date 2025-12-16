import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseAsyncOptions<T> {
  asyncFn: (signal?: AbortSignal) => Promise<T>;
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  dependencies?: React.DependencyList;
}

export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (signal?: AbortSignal) => Promise<void>;
  reset: () => void;
}

/**
 * Generic hook for async operations with automatic cleanup and AbortController support.
 * Prevents state updates after component unmount and handles request cancellation.
 * 
 * @example
 * const { data, loading, error, execute } = useAsync({
 *   asyncFn: async (signal) => {
 *     const response = await fetch('/api/data', { signal });
 *     return response.json();
 *   },
 *   immediate: true,
 * });
 */
export function useAsync<T>({
  asyncFn,
  immediate = true,
  onSuccess,
  onError,
  dependencies = [],
}: UseAsyncOptions<T>): UseAsyncReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track current abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Store callbacks in refs to keep execute stable
  const asyncFnRef = useRef(asyncFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when they change
  useEffect(() => {
    asyncFnRef.current = asyncFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [asyncFn, onSuccess, onError]);

  const execute = useCallback(async (signal?: AbortSignal) => {
    // Create abort controller if not provided
    const controller = signal ? null : new AbortController();
    const abortSignal = signal || controller?.signal;
    
    if (controller) {
      // Abort previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = controller;
    }

    // Only update state if component is still mounted
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await asyncFnRef.current(abortSignal);
      
      // Check if component is still mounted or request was aborted before updating state
      if (!isMountedRef.current || abortSignal?.aborted) {
        return;
      }

      setData(result);
      setLoading(false);
      onSuccessRef.current?.(result);
    } catch (err) {
      // Ignore abort errors - component may have unmounted
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      // Check if component is still mounted or request was aborted before updating state
      if (!isMountedRef.current || abortSignal?.aborted) {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setLoading(false);
      onErrorRef.current?.(error);
    }
  }, []); // Empty deps - uses refs instead

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  // Execute immediately if requested, only when dependencies change
  // Note: execute is stable (uses refs), so we don't need it in deps
  useEffect(() => {
    if (!immediate) return;
    
    // Small delay to avoid race conditions when navigating quickly
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        execute();
      }
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immediate, ...dependencies]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

