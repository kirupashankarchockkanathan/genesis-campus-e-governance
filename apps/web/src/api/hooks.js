import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client.js';

/** GET helper: `useGet(['events', filters], '/events?...')`. */
export const useGet = (key, path, options = {}) =>
  useQuery({ queryKey: key, queryFn: () => api(path), ...options });

/**
 * Mutation helper. Call `.mutate({ method, path, body })`; `invalidate` is a list of query-key
 * prefixes refreshed on success so lists never go stale (spec 13.4).
 */
export function useAction({ invalidate = [], onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method = 'POST', path, body, formData }) => api(path, { method, body, formData }),
    onSuccess: (data, vars) => {
      for (const key of invalidate) qc.invalidateQueries({ queryKey: key });
      onSuccess?.(data, vars);
    },
  });
}

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};
