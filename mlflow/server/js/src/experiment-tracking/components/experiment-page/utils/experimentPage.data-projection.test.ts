import { describe, expect, it } from '@jest/globals';
import { COLUMN_TYPES } from '../../../constants';
import { makeCanonicalSortKey } from './experimentPage.common-utils';
import {
  createRunsDataProjection,
  getChartsDataKeys,
  MAX_DATA_PROJECTION_KEYS,
} from './experimentPage.data-projection';
import { RunsChartType } from '../../runs-charts/runs-charts.types';
import type { SerializedRunsChartsCardConfigCard } from '../../runs-charts/runs-charts.types';
import { RunGroupingAggregateFunction, RunGroupingMode } from './experimentPage.row-types';

const metric = (key: string) => makeCanonicalSortKey(COLUMN_TYPES.METRICS, key);
const param = (key: string) => makeCanonicalSortKey(COLUMN_TYPES.PARAMS, key);
const attribute = (key: string) => makeCanonicalSortKey(COLUMN_TYPES.ATTRIBUTES, key);
const tag = (key: string) => makeCanonicalSortKey(COLUMN_TYPES.TAGS, key);

describe('createRunsDataProjection', () => {
  it('requests no metrics and params when only attribute and tag columns are selected', () => {
    expect(
      createRunsDataProjection({
        selectedColumns: [attribute('Source'), attribute('Models'), tag('mlflow.user')],
        orderByKey: 'attributes.start_time',
      }),
    ).toEqual({ metric_keys: [], param_keys: [] });
  });

  it('requests the selected metric and param columns, sorted and without duplicates', () => {
    expect(
      createRunsDataProjection({
        selectedColumns: [metric('b/loss'), attribute('Source'), param('lr'), metric('a.acc'), metric('b/loss')],
      }),
    ).toEqual({ metric_keys: ['a.acc', 'b/loss'], param_keys: ['lr'] });
  });

  it('keeps keys with special characters intact', () => {
    expect(createRunsDataProjection({ selectedColumns: [metric('eval/ds `x`/loss')] })).toEqual({
      metric_keys: ['eval/ds `x`/loss'],
      param_keys: [],
    });
  });

  it('requests the metric or param that the runs are sorted by', () => {
    expect(createRunsDataProjection({ selectedColumns: [], orderByKey: metric('f1') })).toEqual({
      metric_keys: ['f1'],
      param_keys: [],
    });
    expect(createRunsDataProjection({ selectedColumns: [], orderByKey: param('lr') })).toEqual({
      metric_keys: [],
      param_keys: ['lr'],
    });
  });

  it('requests the param that the runs are grouped by, but not tags and datasets', () => {
    const groupBy = {
      aggregateFunction: RunGroupingAggregateFunction.Average,
      groupByKeys: [
        { mode: RunGroupingMode.Param, groupByData: 'seed' },
        { mode: RunGroupingMode.Tag, groupByData: 'team' },
        { mode: RunGroupingMode.Dataset, groupByData: 'train' },
      ],
    };

    expect(createRunsDataProjection({ selectedColumns: [], groupBy })).toEqual({
      metric_keys: [],
      param_keys: ['seed'],
    });
  });

  it('never requests more keys than the server accepts', () => {
    const selectedColumns = Array.from({ length: MAX_DATA_PROJECTION_KEYS + 50 }, (_, i) =>
      metric(`metric_${String(i).padStart(5, '0')}`),
    );

    const { metric_keys } = createRunsDataProjection({ selectedColumns });

    expect(metric_keys).toHaveLength(MAX_DATA_PROJECTION_KEYS);
  });
});

const chart = (config: Record<string, unknown>) => config as unknown as SerializedRunsChartsCardConfigCard;

describe('getChartsDataKeys', () => {
  it('returns no keys without charts', () => {
    expect(getChartsDataKeys(undefined)).toEqual({ metricKeys: [], paramKeys: [] });
    expect(getChartsDataKeys([])).toEqual({ metricKeys: [], paramKeys: [] });
  });

  it('collects the metrics of bar charts, including the dataset specific ones', () => {
    const { metricKeys, paramKeys } = getChartsDataKeys([
      chart({ type: RunsChartType.BAR, metricKey: 'acc' }),
      chart({ type: RunsChartType.BAR, metricKey: 'loss', dataAccessKey: 'loss_eval', selectedMetricKeys: ['f1'] }),
    ]);

    expect(metricKeys.sort()).toEqual(['acc', 'f1', 'loss', 'loss_eval']);
    expect(paramKeys).toEqual([]);
  });

  it('collects the metrics and params of the axes of scatter and contour charts', () => {
    const { metricKeys, paramKeys } = getChartsDataKeys([
      chart({
        type: RunsChartType.SCATTER,
        xaxis: { key: 'lr', type: 'PARAM' },
        yaxis: { key: 'acc', type: 'METRIC' },
      }),
      chart({
        type: RunsChartType.CONTOUR,
        xaxis: { key: 'batch_size', type: 'PARAM' },
        yaxis: { key: 'lr', type: 'PARAM' },
        zaxis: { key: 'loss', type: 'METRIC', dataAccessKey: 'loss_eval' },
      }),
    ]);

    expect(metricKeys.sort()).toEqual(['acc', 'loss', 'loss_eval']);
    expect(paramKeys.sort()).toEqual(['batch_size', 'lr']);
  });

  it('collects the selected metrics and params of parallel coordinates charts', () => {
    expect(
      getChartsDataKeys([
        chart({ type: RunsChartType.PARALLEL, selectedMetrics: ['acc'], selectedParams: ['lr', 'seed'] }),
      ]),
    ).toEqual({ metricKeys: ['acc'], paramKeys: ['lr', 'seed'] });
  });

  it('ignores line charts, deleted charts and empty keys', () => {
    expect(
      getChartsDataKeys([
        // Line charts load the history of their metrics separately
        chart({ type: RunsChartType.LINE, metricKey: 'loss', selectedMetricKeys: ['loss', 'acc'] }),
        chart({ type: RunsChartType.BAR, metricKey: 'deleted_metric', deleted: true }),
        chart({ type: RunsChartType.BAR, metricKey: '' }),
        chart({ type: RunsChartType.SCATTER, xaxis: { key: '', type: 'METRIC' }, yaxis: { key: '', type: 'PARAM' } }),
        chart({ type: RunsChartType.DIFFERENCE }),
        chart({ type: RunsChartType.IMAGE, imageKeys: ['img'] }),
      ]),
    ).toEqual({ metricKeys: [], paramKeys: [] });
  });
});

describe('createRunsDataProjection with charts', () => {
  it('requests the metrics and params of the charts besides the displayed ones', () => {
    expect(
      createRunsDataProjection({
        selectedColumns: [metric('acc'), param('seed')],
        orderByKey: metric('f1'),
        charts: [
          chart({ type: RunsChartType.BAR, metricKey: 'acc' }),
          chart({
            type: RunsChartType.SCATTER,
            xaxis: { key: 'lr', type: 'PARAM' },
            yaxis: { key: 'loss', type: 'METRIC' },
          }),
        ],
      }),
    ).toEqual({ metric_keys: ['acc', 'f1', 'loss'], param_keys: ['lr', 'seed'] });
  });

  it('does not request anything for charts that do not read the loaded runs', () => {
    expect(
      createRunsDataProjection({
        selectedColumns: [],
        charts: [chart({ type: RunsChartType.LINE, metricKey: 'loss' })],
      }),
    ).toEqual({ metric_keys: [], param_keys: [] });
  });
});
