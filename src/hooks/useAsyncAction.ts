"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseAsyncActionOptions {
    /** Auto-clear error after this many milliseconds (default: 5000, 0 = no auto-clear) */
    errorTimeout?: number;
}

interface UseAsyncActionReturn<T extends unknown[], R> {
    /** Execute the async action */
    execute: (...args: T) => Promise<R | undefined>;
    /** Whether the action is currently loading */
    isLoading: boolean;
    /** The last error that occurred */
    error: Error | null;
    /** Manually clear the error */
    clearError: () => void;
}

/**
 * Hook that wraps async functions with loading state and error handling.
 * Prevents double-submit by blocking execution while loading.
 *
 * @param asyncFn - The async function to wrap
 * @param options - Configuration options
 * @returns Object with execute function, loading state, and error state
 *
 * @example
 * ```tsx
 * const { execute: handleBuy, isLoading: isBuying } = useAsyncAction(
 *   async (listingId: string) => {
 *     await buyListing(listingId);
 *   }
 * );
 *
 * <button onClick={() => handleBuy(listing.id)} disabled={isBuying}>
 *   {isBuying ? "Processing..." : "Buy"}
 * </button>
 * ```
 */
export function useAsyncAction<T extends unknown[], R>(
    asyncFn: (...args: T) => Promise<R>,
    options: UseAsyncActionOptions = {}
): UseAsyncActionReturn<T, R> {
    const { errorTimeout = 5000 } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const execute = useCallback(
        async (...args: T): Promise<R | undefined> => {
            // Prevent double-submit
            if (isLoading) {
                return undefined;
            }

            setIsLoading(true);
            setError(null);

            // Clear any existing error timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            try {
                const result = await asyncFn(...args);
                if (mountedRef.current) {
                    setIsLoading(false);
                }
                return result;
            } catch (err) {
                if (mountedRef.current) {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setError(errorObj);
                    setIsLoading(false);

                    // Auto-clear error after timeout
                    if (errorTimeout > 0) {
                        timeoutRef.current = setTimeout(() => {
                            if (mountedRef.current) {
                                setError(null);
                            }
                        }, errorTimeout);
                    }
                }
                return undefined;
            }
        },
        [asyncFn, errorTimeout, isLoading]
    );

    return {
        execute,
        isLoading,
        error,
        clearError,
    };
}

/**
 * Hook for tracking multiple async actions with a single loading state.
 * Useful when any of several actions should disable all action buttons.
 *
 * @returns Object with loading state and wrapper function
 *
 * @example
 * ```tsx
 * const { isAnyLoading, wrapAction } = useAsyncActions();
 *
 * const handleBuy = wrapAction(async () => await buyListing(id));
 * const handleCancel = wrapAction(async () => await cancelListing(id));
 *
 * <button disabled={isAnyLoading}>Buy</button>
 * <button disabled={isAnyLoading}>Cancel</button>
 * ```
 */
export function useAsyncActions() {
    const [loadingCount, setLoadingCount] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const wrapAction = useCallback(
        <T extends unknown[], R>(
            asyncFn: (...args: T) => Promise<R>
        ) => {
            return async (...args: T): Promise<R | undefined> => {
                if (!mountedRef.current) return undefined;

                setLoadingCount((c) => c + 1);
                try {
                    return await asyncFn(...args);
                } finally {
                    if (mountedRef.current) {
                        setLoadingCount((c) => Math.max(0, c - 1));
                    }
                }
            };
        },
        []
    );

    return {
        isAnyLoading: loadingCount > 0,
        wrapAction,
    };
}

export default useAsyncAction;
