import { describe, expect, it } from '@jest/globals';
import { COLUMN_TYPES } from '../../../constants';
import { makeCanonicalSortKey } from './experimentPage.common-utils';
import { createRunsDataProjection, MAX_DATA_PROJECTION_KEYS } from './experimentPage.data-projection';
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
