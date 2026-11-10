import { useReactTable_unverifiedWithReact18 as useReactTable } from '@databricks/web-shared/react-table';
import {
  Empty,
  Input,
  Overflow,
  SearchIcon,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  useDesignSystemTheme,
} from '@databricks/design-system';
import type { LoggedModelProto, MetricEntitiesByName, MetricEntity, RunInfoEntity } from '../../../types';
import { compact, flatMap, groupBy, isEmpty, keyBy, mapValues, sum, values } from 'lodash';
import { useMemo, useState } from 'react';
import { Link } from '../../../../common/utils/RoutingUtils';
import Routes from '../../../routes';
import { RunPageTabName } from '../../../constants';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { isSystemMetricKey } from '../../../utils/MetricsUtils';
import type { ColumnDef, Table as TableDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel } from '@tanstack/react-table';
import type { UseGetRunQueryResponseRunInfo } from '../hooks/useGetRunQuery';
import { isUndefined } from 'lodash';
import { useExperimentTrackingDetailsPageLayoutStyles } from '../../../hooks/useExperimentTrackingDetailsPageLayoutStyles';
import { DETAILS_OVERVIEW_TABLE_PAGE_SIZE, DetailsOverviewShowMoreRows } from '../../DetailsOverviewShowMoreRows';

const { systemMetricsLabel, modelMetricsLabel } = defineMessages({
  systemMetricsLabel: {
    defaultMessage: 'System metrics',
    description: 'Run page > Overview > Metrics table > System charts section > title',
  },
  modelMetricsLabel: {
    defaultMessage: 'Model metrics',
    description: 'Run page > Overview > Metrics table > Model charts section > title',
  },
});

const metricKeyMatchesFilter = (filter: string) => {
  const filterLower = filter.toLowerCase();
  return ({ key }: MetricEntity) => key.toLowerCase().includes(filterLower);
};

interface MetricEntityWithLoggedModels extends MetricEntity {
  loggedModels?: LoggedModelProto[];
}

const RunViewMetricsTableSection = ({
  metricsList,
  totalCount,
  anyRowHasModels,
  runInfo,
  header,
  table,
}: {
  runInfo: RunInfoEntity | UseGetRunQueryResponseRunInfo;
  /**
   * Metrics that are rendered, which can be fewer than all metrics of the section.
   */
  metricsList: MetricEntityWithLoggedModels[];
  /**
   * Number of all metrics of the section, including the ones that are not rendered yet.
   */
  totalCount: number;
  /**
   * Whether any metric has logged models. The columns are defined for all metrics, so it can't be
   * derived from the rendered ones only.
   */
  anyRowHasModels: boolean;
  header?: React.ReactNode;
  table: TableDef<MetricEntityWithLoggedModels>;
}) => {
  const { theme } = useDesignSystemTheme();
  const [{ column: keyColumn }, ...otherColumns] = table.getLeafHeaders();

  const valueColumn = otherColumns.find((column) => column.id === 'value')?.column;

  const modelColumn = otherColumns.find((column) => column.id === 'models')?.column;

  return totalCount ? (
    <>
      {header && (
        <TableRow>
          <TableCell css={{ flex: 1, backgroundColor: theme.colors.backgroundSecondary }}>
            <Typography.Text bold>
              {header} ({totalCount})
            </Typography.Text>
          </TableCell>
        </TableRow>
      )}
      {metricsList.map(
        ({
          // Get metric key and value to display in table
          key,
          value,
          loggedModels,
        }) => (
          <TableRow key={key}>
            <TableCell
              style={{
                flex: keyColumn.getCanResize() ? keyColumn.getSize() / 100 : undefined,
              }}
            >
              <Link
                componentId="mlflow.run_page.overview.metric_chart_link"
                to={Routes.getRunPageTabRoute(
                  runInfo.experimentId ?? '',
                  runInfo.runUuid ?? '',
                  RunPageTabName.MODEL_METRIC_CHARTS,
                )}
              >
                {key}
              </Link>
            </TableCell>
            <TableCell
              css={{
                flex: valueColumn?.getCanResize() ? valueColumn.getSize() / 100 : undefined,
              }}
            >
              {value.toString()}
            </TableCell>
            {anyRowHasModels && (
              <TableCell
                css={{
                  flex: modelColumn?.getCanResize() ? modelColumn.getSize() / 100 : undefined,
                }}
              >
                {!isEmpty(loggedModels) ? (
                  <Overflow>
                    {loggedModels?.map((model) => (
                      <Link
                        componentId="mlflow.run_page.overview.metric_model_link"
                        key={model.info?.model_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        to={Routes.getExperimentLoggedModelDetailsPage(
                          model.info?.experiment_id ?? '',
                          model.info?.model_id ?? '',
                        )}
                      >
                        {model.info?.name}
                      </Link>
                    ))}
                  </Overflow>
                ) : (
                  '-'
                )}
              </TableCell>
            )}
          </TableRow>
        ),
      )}
    </>
  ) : null;
};

/**
 * Displays table with metrics key/values in run detail overview.
 */
export const RunViewMetricsTable = ({
  latestMetrics,
  runInfo,
  loggedModels,
  expandToParentContainer,
}: {
  latestMetrics: MetricEntitiesByName;
  runInfo: RunInfoEntity | UseGetRunQueryResponseRunInfo;
  loggedModels?: LoggedModelProto[];
  expandToParentContainer?: boolean;
}) => {
  const { theme } = useDesignSystemTheme();
  const { detailsPageTableStyles, detailsPageNoEntriesStyles } = useExperimentTrackingDetailsPageLayoutStyles();
  const intl = useIntl();
  const [filter, setFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(DETAILS_OVERVIEW_TABLE_PAGE_SIZE);

  /**
   * Aggregate logged models by metric key.
   * This is used to display the models associated with each metric in the table.
   */
  const loggedModelsByMetricKey = useMemo(() => {
    if (!loggedModels) {
      return {};
    }
    const metricsWithModels = compact(
      flatMap(loggedModels, (model) => model.data?.metrics?.map(({ key }) => ({ key, model }))),
    );
    const groupedMetrics = groupBy(metricsWithModels, 'key');
    return mapValues(groupedMetrics, (group) => group.map(({ model }) => model));
  }, [loggedModels]);

  /**
   * Enrich the metric list with related logged models.
   */
  const metricValues = useMemo<MetricEntityWithLoggedModels[]>(() => {
    const metricList = values(latestMetrics);

    if (isEmpty(loggedModelsByMetricKey)) {
      return metricList;
    }
    return metricList.map((metric) => ({
      ...metric,
      loggedModels: loggedModelsByMetricKey[metric.key] ?? [],
    }));
  }, [latestMetrics, loggedModelsByMetricKey]);

  const anyRowHasModels = metricValues.some(({ loggedModels }) => !isEmpty(loggedModels));

  const modelColumnDefs: ColumnDef<MetricEntityWithLoggedModels>[] = useMemo(
    () => [
      {
        id: 'models',
        header: intl.formatMessage({
          defaultMessage: 'Models',
          description: 'Run page > Overview > Metrics table > Models column header',
        }),
        accessorKey: 'models',
        enableResizing: true,
      },
    ],
    [intl],
  );

  const columns = useMemo(() => {
    const columnDefs: ColumnDef<MetricEntityWithLoggedModels>[] = [
      {
        id: 'key',
        accessorKey: 'key',
        // eslint-disable-next-line @databricks/no-unstable-nested-components -- go/no-nested-components
        header: () => (
          <FormattedMessage
            defaultMessage="Metric"
            description="Run page > Overview > Metrics table > Key column header"
          />
        ),
        enableResizing: true,
        size: 240,
      },
      {
        id: 'value',
        // eslint-disable-next-line @databricks/no-unstable-nested-components -- go/no-nested-components
        header: () => (
          <FormattedMessage
            defaultMessage="Value"
            description="Run page > Overview > Metrics table > Value column header"
          />
        ),
        accessorKey: 'value',
        enableResizing: true,
      },
    ];

    if (anyRowHasModels) {
      columnDefs.push(...modelColumnDefs);
    }

    return columnDefs;
  }, [anyRowHasModels, modelColumnDefs]);

  // Break down metric lists into system and model segments. If no system (or model) metrics
  // are detected, return a single segment.
  const metricSegments = useMemo(() => {
    const systemMetrics = metricValues.filter(({ key }) => isSystemMetricKey(key));
    const modelMetrics = metricValues.filter(({ key }) => !isSystemMetricKey(key));
    const isSegmented = systemMetrics.length > 0 && modelMetrics.length > 0;
    if (!isSegmented) {
      return [{ header: undefined, metrics: metricValues.filter(metricKeyMatchesFilter(filter)) }];
    }
    return [
      {
        header: intl.formatMessage(systemMetricsLabel),
        metrics: systemMetrics.filter(metricKeyMatchesFilter(filter)),
      },
      {
        header: intl.formatMessage(modelMetricsLabel),
        metrics: modelMetrics.filter(metricKeyMatchesFilter(filter)),
      },
    ];
  }, [filter, metricValues, intl]);

  // Runs can log thousands of metrics, so only a limited number of rows is rendered at once.
  // The first segments take the rows first, filtering and counts still cover all metrics.
  const totalMetricsCount = sum(metricSegments.map(({ metrics }) => metrics.length));
  const visibleMetricSegments = useMemo(() => {
    let remainingRows = visibleCount;
    return metricSegments.map((segment) => {
      const metrics = segment.metrics.slice(0, remainingRows);
      remainingRows -= metrics.length;
      return { ...segment, metrics, totalCount: segment.metrics.length };
    });
  }, [metricSegments, visibleCount]);
  const visibleMetricsCount = sum(visibleMetricSegments.map(({ metrics }) => metrics.length));

  const table = useReactTable<MetricEntity>(
    'mlflow/server/js/src/experiment-tracking/components/run-page/overview/RunViewMetricsTable.tsx',
    {
      data: metricValues,
      getCoreRowModel: getCoreRowModel(),
      getRowId: (row) => row.key,
      enableColumnResizing: true,
      columnResizeMode: 'onChange',
      columns,
    },
  );

  const renderTableContent = () => {
    if (!metricValues.length) {
      return (
        <div css={detailsPageNoEntriesStyles}>
          <Empty
            description={
              <FormattedMessage
                defaultMessage="No metrics recorded"
                description="Run page > Overview > Metrics table > No metrics recorded"
              />
            }
          />
        </div>
      );
    }

    const areAllResultsFiltered = totalMetricsCount < 1;

    return (
      <>
        <div css={{ marginBottom: theme.spacing.sm }}>
          <Input
            componentId="codegen_mlflow_app_src_experiment-tracking_components_run-page_overview_runviewmetricstable.tsx_186"
            prefix={<SearchIcon />}
            placeholder={intl.formatMessage({
              defaultMessage: 'Search metrics',
              description: 'Run page > Overview > Metrics table > Filter input placeholder',
            })}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setVisibleCount(DETAILS_OVERVIEW_TABLE_PAGE_SIZE);
            }}
            allowClear
          />
        </div>

        <Table
          scrollable
          empty={
            areAllResultsFiltered ? (
              <div>
                <Empty
                  description={
                    <FormattedMessage
                      defaultMessage="No metrics match the search filter"
                      description="Message displayed when no metrics match the search filter in the run details page details metrics table"
                    />
                  }
                />
              </div>
            ) : null
          }
          css={detailsPageTableStyles}
        >
          <TableRow isHeader>
            {table.getLeafHeaders().map((header) => (
              <TableHeader
                componentId="codegen_mlflow_app_src_experiment-tracking_components_run-page_overview_runviewmetricstable.tsx_312"
                key={header.id}
                header={header}
                column={header.column}
                setColumnSizing={table.setColumnSizing}
                isResizing={header.column.getIsResizing()}
                style={{
                  flex: header.column.getCanResize() ? header.column.getSize() / 100 : undefined,
                }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHeader>
            ))}
          </TableRow>
          {visibleMetricSegments.map((segment, index) => (
            <RunViewMetricsTableSection
              key={segment.header || index}
              metricsList={segment.metrics}
              totalCount={segment.totalCount}
              anyRowHasModels={anyRowHasModels}
              runInfo={runInfo}
              header={segment.header}
              table={table}
            />
          ))}
        </Table>
        <DetailsOverviewShowMoreRows
          componentId="mlflow.run_page.overview.metrics_table.show_more"
          remainingCount={totalMetricsCount - visibleMetricsCount}
          onShowMore={() => setVisibleCount((count) => count + DETAILS_OVERVIEW_TABLE_PAGE_SIZE)}
        />
      </>
    );
  };
  return (
    <div
      css={{
        flex: expandToParentContainer ? 1 : '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Typography.Title level={4} css={{ flexShrink: 0 }}>
        <FormattedMessage
          defaultMessage="Metrics ({length})"
          description="Run page > Overview > Metrics table > Section title"
          values={{ length: totalMetricsCount }}
        />
      </Typography.Title>
      <div
        css={{
          padding: theme.spacing.sm,
          border: `1px solid ${theme.colors.borderDecorative}`,
          borderRadius: theme.general.borderRadiusBase,
          display: 'flex',
          flexDirection: 'column',
          flex: expandToParentContainer ? 1 : '0 0 auto',
          overflow: 'hidden',
        }}
      >
        {renderTableContent()}
      </div>
    </div>
  );
};
