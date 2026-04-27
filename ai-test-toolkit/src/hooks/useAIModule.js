import { useState, useCallback } from 'react';

/**
 * Generic hook for calling an async AI module function.
 * Handles loading, error, and result state uniformly.
 *
 * @param {Function} asyncFn - The AI module function to call
 * @returns {{ result, loading, error, execute, reset }}
 */
export function useAIModule(asyncFn) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const data = await asyncFn(...args);
        setResult(data);
        return data;
      } catch (err) {
        setError(err.message || 'An unexpected error occurred');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { result, loading, error, execute, reset };
}
