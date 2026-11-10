import { describe, test, expect } from '@jest/globals';
import {
  MAX_AUTO_GENERATED_METRIC_CHARTS,
  RunsChartsBarCardConfig,
  RunsChartsCardConfig,
  RunsChartsLineCardConfig,
  RunsChartType,
} from './runs-charts.types';
import type { RunsChartsRunData } from './components/RunsCharts.common';

describe('RunsChartsCardConfig.getBaseChartAndSectionConfigs', () => {
  const createMockRunData = (metrics: Record<string, any>): RunsChartsRunData => ({
    uuid: 'test-run-uuid',
    displayName: 'Test Run',
    metrics,
    params: {},
    tags: {},
    images: {},
  });

  describe('nodeLevelMetricsConfig integration', () => {
    test('creates Node system metrics section and charts when common node metrics are provided', () => {
      const runsData = [
        createMockRunData({
          'system/node_0/cpu_utilization_percentage': { key: 'system/node_0/cpu_utilization_percentage', value: 50 },
          'system/node_1/cpu_utilization_percentage': { key: 'system/node_1/cpu_utilization_percentage', value: 60 },
        }),
      ];

      const nodeLevelMetricsConfig = {
        nodeIndexes: ['0', '1'],
        commonMetrics: ['cpu_utilization_percentage'],
        gpuIndexes: [],
        commonGpuMetrics: [],
        enabled: true as const,
      };

      const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData,
        nodeLevelMetricsConfig,
      });

      // Verify Node system metrics section was created
      const nodeSectionExists = resultSectionSet.some((section) => section.name === 'Node system metrics');
      expect(nodeSectionExists).toBe(true);

      // Verify chart was created for the common metric
      const cpuChart = resultChartSet.find(
        (chart) =>
          chart instanceof RunsChartsLineCardConfig &&
          chart.nodeLevelSystemMetricConfiguration?.metric === 'cpu_utilization_percentage' &&
          chart.nodeLevelSystemMetricConfiguration?.type === 'node',
      ) as RunsChartsLineCardConfig;

      expect(cpuChart).toBeDefined();
      expect(cpuChart.displayName).toBe('cpu_utilization_percentage');
      expect(cpuChart.selectedMetricKeys).toEqual([
        'system/node_0/cpu_utilization_percentage',
        'system/node_1/cpu_utilization_percentage',
      ]);
    });

    test('creates GPU system metrics section and charts when common GPU metrics are provided', () => {
      const runsData = [
        createMockRunData({
          'system/node_0/gpu_0_utilization_percentage': {
            key: 'system/node_0/gpu_0_utilization_percentage',
            value: 70,
          },
          'system/node_1/gpu_0_utilization_percentage': {
            key: 'system/node_1/gpu_0_utilization_percentage',
            value: 80,
          },
        }),
      ];

      const nodeLevelMetricsConfig = {
        nodeIndexes: ['0', '1'],
        commonMetrics: [],
        gpuIndexes: [0],
        commonGpuMetrics: ['utilization_percentage'],
        enabled: true as const,
      };

      const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData,
        nodeLevelMetricsConfig,
      });

      // Verify GPU system metrics section was created
      const gpuSectionExists = resultSectionSet.some((section) => section.name === 'GPU system metrics');
      expect(gpuSectionExists).toBe(true);

      // Verify chart was created for the common GPU metric
      const gpuChart = resultChartSet.find(
        (chart) =>
          chart instanceof RunsChartsLineCardConfig &&
          chart.nodeLevelSystemMetricConfiguration?.metric === 'utilization_percentage' &&
          chart.nodeLevelSystemMetricConfiguration?.type === 'gpu',
      ) as RunsChartsLineCardConfig;

      expect(gpuChart).toBeDefined();
      expect(gpuChart.displayName).toBe('utilization_percentage');
      expect(gpuChart.selectedMetricKeys).toEqual([
        'system/node_0/gpu_0_utilization_percentage',
        'system/node_1/gpu_0_utilization_percentage',
      ]);
    });

    test('creates charts for multiple GPU indexes across multiple nodes', () => {
      const runsData = [
        createMockRunData({
          'system/node_0/gpu_0_power_usage_watts': { key: 'system/node_0/gpu_0_power_usage_watts', value: 100 },
          'system/node_0/gpu_1_power_usage_watts': { key: 'system/node_0/gpu_1_power_usage_watts', value: 110 },
          'system/node_1/gpu_0_power_usage_watts': { key: 'system/node_1/gpu_0_power_usage_watts', value: 120 },
          'system/node_1/gpu_1_power_usage_watts': { key: 'system/node_1/gpu_1_power_usage_watts', value: 130 },
        }),
      ];

      const nodeLevelMetricsConfig = {
        nodeIndexes: ['0', '1'],
        commonMetrics: [],
        gpuIndexes: [0, 1],
        commonGpuMetrics: ['power_usage_watts'],
        enabled: true as const,
      };

      const { resultChartSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData,
        nodeLevelMetricsConfig,
      });

      const powerChart = resultChartSet.find(
        (chart) =>
          chart instanceof RunsChartsLineCardConfig &&
          chart.nodeLevelSystemMetricConfiguration?.metric === 'power_usage_watts',
      ) as RunsChartsLineCardConfig;

      expect(powerChart).toBeDefined();
      expect(powerChart.selectedMetricKeys).toEqual([
        'system/node_0/gpu_0_power_usage_watts',
        'system/node_0/gpu_1_power_usage_watts',
        'system/node_1/gpu_0_power_usage_watts',
        'system/node_1/gpu_1_power_usage_watts',
      ]);
    });

    test('does not create node-level sections when nodeLevelMetricsConfig is disabled', () => {
      const runsData = [
        createMockRunData({
          'system/node_0/cpu_utilization_percentage': { key: 'system/node_0/cpu_utilization_percentage', value: 50 },
        }),
      ];

      const nodeLevelMetricsConfig = {
        nodeIndexes: [],
        commonMetrics: [],
        gpuIndexes: [],
        commonGpuMetrics: [],
        enabled: false,
      };

      const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData,
        nodeLevelMetricsConfig,
      });

      // Verify Node/GPU system metrics sections were not created
      const nodeSectionExists = resultSectionSet.some((section) => section.name === 'Node system metrics');
      const gpuSectionExists = resultSectionSet.some((section) => section.name === 'GPU system metrics');

      expect(nodeSectionExists).toBe(false);
      expect(gpuSectionExists).toBe(false);

      // Verify no node-level charts were created
      const nodeLevelCharts = resultChartSet.filter(
        (chart) => chart instanceof RunsChartsLineCardConfig && chart.nodeLevelSystemMetricConfiguration,
      );
      expect(nodeLevelCharts).toHaveLength(0);
    });

    test('does not create sections when common metrics arrays are empty', () => {
      const runsData = [createMockRunData({})];

      const nodeLevelMetricsConfig = {
        nodeIndexes: ['0'],
        commonMetrics: [],
        gpuIndexes: [],
        commonGpuMetrics: [],
        enabled: true as const,
      };

      const { resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
        runsData,
        nodeLevelMetricsConfig,
      });

      const nodeSectionExists = resultSectionSet.some((section) => section.name === 'Node system metrics');
      const gpuSectionExists = resultSectionSet.some((section) => section.name === 'GPU system metrics');

      expect(nodeSectionExists).toBe(false);
      expect(gpuSectionExists).toBe(false);
    });
  });

  test('uses section-relative display names for generated nested metric charts', () => {
    const runsData = [
      createMockRunData({
        'train/losses/grouped_by_x/after_y/mae': {
          key: 'train/losses/grouped_by_x/after_y/mae',
          value: 0.1,
          step: 0,
        },
        'system/gpu_1': {
          key: 'system/gpu_1',
          value: 10,
          step: 2,
        },
      }),
    ];

    const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      runsData,
    });

    const nestedMetricChart = resultChartSet.find(
      (chart) => 'metricKey' in chart && chart.metricKey === 'train/losses/grouped_by_x/after_y/mae',
    );
    const systemMetricChart = resultChartSet.find(
      (chart) => 'metricKey' in chart && chart.metricKey === 'system/gpu_1',
    );

    expect(nestedMetricChart?.displayName).toBe('mae');
    expect(systemMetricChart?.displayName).toBe('gpu_1');
    expect(resultSectionSet.some((section) => section.name === 'train/losses/grouped_by_x/after_y')).toBe(true);
    expect(resultSectionSet.some((section) => section.name === 'System metrics')).toBe(true);
  });
});

describe('automatically generated metric charts limit', () => {
  const createRunDataWithMetrics = (metricKeys: string[]): RunsChartsRunData => ({
    uuid: 'test-run-uuid',
    displayName: 'Test Run',
    metrics: Object.fromEntries(metricKeys.map((key) => [key, { key, value: 1, step: 0 }])) as any,
    params: {},
    tags: {},
    images: {},
  });
  const manyMetricKeys = Array.from({ length: 5000 }, (_, i) => `eval/ds_${String(i).padStart(4, '0')}/loss`);
  const metricKeysOf = (charts: RunsChartsCardConfig[]) =>
    charts.map((chart) => (chart as RunsChartsBarCardConfig).metricKey);

  test('base configs chart only the first metrics, and sections only for them', () => {
    const { resultChartSet, resultSectionSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      runsData: [createRunDataWithMetrics(manyMetricKeys)],
    });

    expect(resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS);
    expect(metricKeysOf(resultChartSet)).toEqual(manyMetricKeys.slice(0, MAX_AUTO_GENERATED_METRIC_CHARTS));
    expect(resultSectionSet.length).toBeLessThanOrEqual(MAX_AUTO_GENERATED_METRIC_CHARTS + 2);
  });

  test('base configs keep the primary metric within the limit', () => {
    const primaryMetricKey = 'zzz/primary';
    const { resultChartSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      primaryMetricKey,
      runsData: [createRunDataWithMetrics([...manyMetricKeys, primaryMetricKey])],
    });

    expect(resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS);
    expect(metricKeysOf(resultChartSet)).toContain(primaryMetricKey);
  });

  test('base configs below the limit chart every metric', () => {
    const metricKeys = manyMetricKeys.slice(0, MAX_AUTO_GENERATED_METRIC_CHARTS);
    const { resultChartSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      runsData: [createRunDataWithMetrics(metricKeys)],
    });

    expect(metricKeysOf(resultChartSet).sort()).toEqual(metricKeys);
  });

  test('base configs do not spend the limit on node-level metrics that are not charted individually', () => {
    const nodeMetricKeys = Array.from({ length: 200 }, (_, i) => `system/node_${i}/cpu_utilization_percentage`);
    const { resultChartSet } = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      runsData: [createRunDataWithMetrics([...nodeMetricKeys, 'z_loss'])],
      nodeLevelMetricsConfig: {
        nodeIndexes: ['0', '1'],
        commonMetrics: [],
        gpuIndexes: [],
        commonGpuMetrics: [],
        enabled: true as const,
      },
    });

    expect(metricKeysOf(resultChartSet)).toEqual(['z_loss']);
  });

  test('updating charts adds new metrics only up to the limit and stays stable', () => {
    const runsData = [createRunDataWithMetrics(manyMetricKeys)];
    const first = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: [],
      compareRunSections: [],
      isAccordionReordered: false,
      runsData,
    });

    expect(first.isResultUpdated).toBe(true);
    expect(first.resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS);
    expect(metricKeysOf(first.resultChartSet).sort()).toEqual(
      manyMetricKeys.slice(0, MAX_AUTO_GENERATED_METRIC_CHARTS),
    );

    // The same data again does not change anything, so the UI state is not rewritten
    const second = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: first.resultChartSet,
      compareRunSections: first.resultSectionSet,
      isAccordionReordered: false,
      runsData,
    });
    expect(second.isResultUpdated).toBe(false);
    expect(second.resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS);
  });

  test('updating charts does not bring back deleted generated charts', () => {
    const runsData = [createRunDataWithMetrics(manyMetricKeys)];
    const first = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: [],
      compareRunSections: [],
      isAccordionReordered: false,
      runsData,
    });
    const charts = first.resultChartSet.map((chart, i) => (i === 0 ? { ...chart, deleted: true } : chart));

    const second = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: charts,
      compareRunSections: first.resultSectionSet,
      isAccordionReordered: false,
      runsData,
    });

    expect(second.resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS);
    expect(second.resultChartSet.filter((chart) => chart.deleted)).toHaveLength(1);
  });

  test('updating charts still adds a few new metrics when under the limit', () => {
    const existing = RunsChartsCardConfig.getBaseChartAndSectionConfigs({
      runsData: [createRunDataWithMetrics(['a/loss'])],
    });

    const { resultChartSet, isResultUpdated } = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: existing.resultChartSet,
      compareRunSections: existing.resultSectionSet,
      isAccordionReordered: false,
      runsData: [createRunDataWithMetrics(['a/loss', 'b/loss'])],
    });

    expect(isResultUpdated).toBe(true);
    expect(metricKeysOf(resultChartSet).sort()).toEqual(['a/loss', 'b/loss']);
  });

  test('user added charts do not count towards the limit', () => {
    const userChart = {
      ...RunsChartsCardConfig.getEmptyChartCardByType(RunsChartType.BAR, false, 'user-chart', 'section'),
      metricKey: 'my/metric',
    } as RunsChartsBarCardConfig;

    const { resultChartSet } = RunsChartsCardConfig.updateChartAndSectionConfigs({
      compareRunCharts: [userChart],
      compareRunSections: [],
      isAccordionReordered: false,
      runsData: [createRunDataWithMetrics(['my/metric', ...manyMetricKeys])],
    });

    expect(resultChartSet).toHaveLength(MAX_AUTO_GENERATED_METRIC_CHARTS + 1);
  });
});

describe('RunsChartsCardConfig.getDisplayNameForUpdatedMetricSelection', () => {
  test('preserves the display name when a legacy chart selection is normalized', () => {
    const config = new RunsChartsBarCardConfig(true);
    config.metricKey = 'train/loss';
    config.displayName = 'loss';

    expect(RunsChartsCardConfig.getDisplayNameForUpdatedMetricSelection(config, ['train/loss'])).toBe('loss');
  });

  test('clears the display name when the selected metric changes', () => {
    const config = new RunsChartsLineCardConfig(true);
    config.metricKey = 'train/loss';
    config.selectedMetricKeys = ['train/loss'];
    config.displayName = 'loss';

    expect(
      RunsChartsCardConfig.getDisplayNameForUpdatedMetricSelection(config, ['validation/accuracy']),
    ).toBeUndefined();
  });
});
