import { useState } from 'react';
import { Alert, useDesignSystemTheme } from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';
import { MAX_AUTO_GENERATED_METRIC_CHARTS } from '../runs-charts.types';

/**
 * Informs the user that metric charts are generated automatically only for a limited number of
 * metrics, and how to chart any other metric. Renders nothing when every metric gets a chart.
 */
export const RunsChartsMetricLimitNotice = ({ metricsCount }: { metricsCount: number }) => {
  const { theme } = useDesignSystemTheme();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || metricsCount <= MAX_AUTO_GENERATED_METRIC_CHARTS) {
    return null;
  }

  return (
    <Alert
      componentId="mlflow.charts.metric_limit_notice"
      type="info"
      closable
      onClose={() => setDismissed(true)}
      css={{ marginBottom: theme.spacing.sm }}
      message={
        <FormattedMessage
          defaultMessage="Charts are generated automatically for {limit} of {total} metrics. To chart another metric, use the search above to check whether it is already charted, or choose Add chart in a section and select the metric."
          description="Experiment tracking > runs charts > notice shown when there are more metrics than the automatically generated charts"
          values={{ limit: MAX_AUTO_GENERATED_METRIC_CHARTS, total: metricsCount }}
        />
      }
    />
  );
};
