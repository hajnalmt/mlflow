import { COLUMN_TYPES } from '../../../constants';
import { extractCanonicalSortKey, isCanonicalSortKeyOfType } from './experimentPage.common-utils';
import { RunGroupingMode } from './experimentPage.row-types';
import type { RunsGroupByConfig } from './experimentPage.group-row-utils';
import type {
  RunsChartsBarCardConfig,
  RunsChartsContourCardConfig,
  RunsChartsParallelCardConfig,
  RunsChartsScatterCardConfig,
  SerializedRunsChartsCardConfigCard,
} from '../../runs-charts/runs-charts.types';
import { RunsChartType } from '../../runs-charts/runs-charts.types';
import type { RunsChartAxisDef } from '../../runs-charts/components/RunsCharts.common';

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
 * Collects the metrics and params that the configured charts read from the loaded runs: bar charts
 * read the latest value of their metrics, scatter and contour charts of the metrics and params of their
 * axes, and parallel coordinates charts of their selected metrics and params. Line charts load the
 * history of their metrics separately, so they do not depend on the loaded runs. Deleted charts are
 * ignored.
 */
export const getChartsDataKeys = (
  charts?: SerializedRunsChartsCardConfigCard[],
): { metricKeys: string[]; paramKeys: string[] } => {
  const metricKeys = new Set<string>();
  const paramKeys = new Set<string>();

  const addKeys = (target: Set<string>, keys: (string | undefined)[]) =>
    keys.forEach((key) => {
      if (key) {
        target.add(key);
      }
    });
  const addAxis = (axis?: RunsChartAxisDef) => {
    if (axis) {
      addKeys(axis.type === 'PARAM' ? paramKeys : metricKeys, [axis.key, axis.dataAccessKey]);
    }
  };

  (charts ?? []).forEach((chart) => {
    if (chart.deleted) {
      return;
    }
    switch (chart.type) {
      case RunsChartType.BAR: {
        const { metricKey, dataAccessKey, selectedMetricKeys } = chart as RunsChartsBarCardConfig;
        addKeys(metricKeys, [metricKey, dataAccessKey, ...(selectedMetricKeys ?? [])]);
        break;
      }
      case RunsChartType.SCATTER: {
        const { xaxis, yaxis } = chart as RunsChartsScatterCardConfig;
        [xaxis, yaxis].forEach(addAxis);
        break;
      }
      case RunsChartType.CONTOUR: {
        const { xaxis, yaxis, zaxis } = chart as RunsChartsContourCardConfig;
        [xaxis, yaxis, zaxis].forEach(addAxis);
        break;
      }
      case RunsChartType.PARALLEL: {
        const { selectedMetrics, selectedParams } = chart as RunsChartsParallelCardConfig;
        addKeys(metricKeys, selectedMetrics ?? []);
        addKeys(paramKeys, selectedParams ?? []);
        break;
      }
      default:
        break;
    }
  });

  return { metricKeys: Array.from(metricKeys), paramKeys: Array.from(paramKeys) };
};

/**
 * Creates the projection of the metrics and params that are required to display the runs table and the
 * charts: the metric and param columns that are selected, the column that the runs are sorted by, the
 * param that the runs are grouped by and the metrics and params of the configured charts. All the other
 * metrics and params of the runs are not requested, which keeps the payload small for runs that log
 * thousands of them.
 */
export const createRunsDataProjection = ({
  selectedColumns,
  orderByKey,
  groupBy,
  charts,
}: {
  selectedColumns: string[];
  orderByKey?: string;
  groupBy?: RunsGroupByConfig | null;
  charts?: SerializedRunsChartsCardConfigCard[];
}): RunsDataProjection => {
  const chartsDataKeys = getChartsDataKeys(charts);
  const metricKeys = new Set<string>(chartsDataKeys.metricKeys);
  const paramKeys = new Set<string>(chartsDataKeys.paramKeys);

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
