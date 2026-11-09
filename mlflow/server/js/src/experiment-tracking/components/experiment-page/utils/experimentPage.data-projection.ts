import { COLUMN_TYPES } from '../../../constants';
import { extractCanonicalSortKey, isCanonicalSortKeyOfType } from './experimentPage.common-utils';
import { RunGroupingMode } from './experimentPage.row-types';
import type { RunsGroupByConfig } from './experimentPage.group-row-utils';

/**
 * Describes which metrics and params to request for each run, see `SearchRuns.data_projection`.
 */
export type RunsDataProjection = {
  metric_keys: string[];
  param_keys: string[];
};

/**
 * The server rejects projections with more keys than this per list.
 */
export const MAX_DATA_PROJECTION_KEYS = 1000;

/**
 * Creates the projection of the metrics and params that are required to display the runs table: the
 * metric and param columns that are selected, the column that the runs are sorted by and the param
 * that the runs are grouped by. All the other metrics and params of the runs are not requested,
 * which keeps the payload small for runs that log thousands of them.
 */
export const createRunsDataProjection = ({
  selectedColumns,
  orderByKey,
  groupBy,
}: {
  selectedColumns: string[];
  orderByKey?: string;
  groupBy?: RunsGroupByConfig | null;
}): RunsDataProjection => {
  const metricKeys = new Set<string>();
  const paramKeys = new Set<string>();

  [...selectedColumns, ...(orderByKey ? [orderByKey] : [])].forEach((canonicalKey) => {
    if (isCanonicalSortKeyOfType(canonicalKey, COLUMN_TYPES.METRICS)) {
      metricKeys.add(extractCanonicalSortKey(canonicalKey, COLUMN_TYPES.METRICS));
    } else if (isCanonicalSortKeyOfType(canonicalKey, COLUMN_TYPES.PARAMS)) {
      paramKeys.add(extractCanonicalSortKey(canonicalKey, COLUMN_TYPES.PARAMS));
    }
  });

  groupBy?.groupByKeys.forEach(({ mode, groupByData }) => {
    if (mode === RunGroupingMode.Param) {
      paramKeys.add(groupByData);
    }
  });

  return {
    metric_keys: Array.from(metricKeys).sort().slice(0, MAX_DATA_PROJECTION_KEYS),
    param_keys: Array.from(paramKeys).sort().slice(0, MAX_DATA_PROJECTION_KEYS),
  };
};
