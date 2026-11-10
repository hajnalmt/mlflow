import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@databricks/web-shared/query-client';
import { MlflowService } from '../../../sdk/MlflowService';
import { RUN_DATA_KEYS_MAX_RESULTS, useExperimentRunDataKeys } from './useExperimentRunDataKeys';

describe('useExperimentRunDataKeys', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient();
    jest.spyOn(MlflowService, 'getExperimentRunDataKeys').mockResolvedValue({
      metric_keys: ['m1', 'm2'],
      param_keys: ['p1'],
      metric_keys_truncated: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('looks up the keys of the experiments with the maximum number of results', async () => {
    const { result } = renderHook(() => useExperimentRunDataKeys({ experimentIds: ['1', '2'], search: '' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.metricKeys).toEqual(['m1', 'm2']));
    expect(result.current.paramKeys).toEqual(['p1']);
    expect(result.current.metricKeysTruncated).toBe(true);
    expect(result.current.paramKeysTruncated).toBe(false);
    expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledWith({
      experiment_ids: ['1', '2'],
      run_view_type: 'ACTIVE_ONLY',
      search: undefined,
      max_results: RUN_DATA_KEYS_MAX_RESULTS,
    });
  });

  it('debounces the search text before looking up the keys', async () => {
    const { result, rerender } = renderHook(
      ({ search }) => useExperimentRunDataKeys({ experimentIds: ['1'], search }),
      { wrapper, initialProps: { search: '' } },
    );
    await waitFor(() => expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledTimes(1));

    rerender({ search: 'los' });
    rerender({ search: 'loss' });

    // The typed text has not been sent yet
    expect(result.current.isSearching).toBe(true);
    expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledTimes(1);

    // Only the final text is sent, once typing has paused
    await waitFor(() => expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledTimes(2));
    expect(MlflowService.getExperimentRunDataKeys).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'loss' }),
    );
    expect(MlflowService.getExperimentRunDataKeys).not.toHaveBeenCalledWith(expect.objectContaining({ search: 'los' }));
  });

  it('passes a custom maximum number of results', async () => {
    const { result } = renderHook(
      () => useExperimentRunDataKeys({ experimentIds: ['1'], search: 'loss', maxResults: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.metricKeys).toEqual(['m1', 'm2']));
    expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'loss', max_results: 20 }),
    );
  });

  it('does not look up the keys when disabled', () => {
    renderHook(() => useExperimentRunDataKeys({ experimentIds: ['1'], search: '', enabled: false }), { wrapper });

    expect(MlflowService.getExperimentRunDataKeys).not.toHaveBeenCalled();
  });

  it('reports an error when the keys cannot be looked up', async () => {
    jest.spyOn(MlflowService, 'getExperimentRunDataKeys').mockRejectedValue(new Error('not supported'));

    const { result } = renderHook(() => useExperimentRunDataKeys({ experimentIds: ['1'], search: '' }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.metricKeys).toEqual([]);
  });
});
