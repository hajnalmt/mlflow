import { useQuery } from '@databricks/web-shared/query-client';
import { useDebounce } from 'use-debounce';
import { MlflowService } from '../../../sdk/MlflowService';
import { ViewType } from '../../../sdk/MlflowEnums';

/**
 * Default maximum number of metric keys and of param keys requested at once. The runs of an experiment can
 * log tens of thousands of different metrics, which is too much to list: users search for the keys they need.
 */
export const RUN_DATA_KEYS_MAX_RESULTS = 500;

const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_KEYS: string[] = [];

/**
 * Looks up the metric and param keys that are logged on the runs of experiments, without loading the runs.
 * Only the first `RUN_DATA_KEYS_MAX_RESULTS` keys that contain the search text are returned, see
 * `metricKeysTruncated` and `paramKeysTruncated`.
 *
 * @param experimentIds IDs of the experiments to look up the keys for
 * @param search only keys containing this text (case-insensitive) are returned, the typed text is debounced
 * @param runViewType whether to look at active or deleted runs
 * @param maxResults maximum number of metric keys and of param keys to return, each
 * @param enabled set to `false` to skip looking up the keys, e.g. while the keys are not displayed
 */
export const useExperimentRunDataKeys = ({
  experimentIds,
  search,
  runViewType = ViewType.ACTIVE_ONLY,
  maxResults = RUN_DATA_KEYS_MAX_RESULTS,
  enabled = true,
}: {
  experimentIds: string[];
  search: string;
  runViewType?: string;
  maxResults?: number;
  enabled?: boolean;
}) => {
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['experimentRunDataKeys', experimentIds, runViewType, debouncedSearch, maxResults],
    queryFn: () =>
      MlflowService.getExperimentRunDataKeys({
        experiment_ids: experimentIds,
        run_view_type: runViewType,
        search: debouncedSearch || undefined,
        max_results: maxResults,
      }),
    enabled: enabled && experimentIds.length > 0,
    // The keys change slowly and are cheap to look up again when needed
    staleTime: 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    // Keep listing the previous keys while the result of a new search is being loaded
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    metricKeys: data?.metric_keys ?? EMPTY_KEYS,
    paramKeys: data?.param_keys ?? EMPTY_KEYS,
    metricKeysTruncated: Boolean(data?.metric_keys_truncated),
    paramKeysTruncated: Boolean(data?.param_keys_truncated),
    isLoading,
    // True while the typed search has not been sent yet or its result has not arrived
    isSearching: isFetching || search.trim() !== debouncedSearch,
    // The keys could not be looked up, e.g. the server does not support it
    isError,
  };
};
