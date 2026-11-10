import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { DesignSystemProvider } from '@databricks/design-system';
import { MAX_AUTO_GENERATED_METRIC_CHARTS } from '../runs-charts.types';
import { RunsChartsMetricLimitNotice } from './RunsChartsMetricLimitNotice';

describe('RunsChartsMetricLimitNotice', () => {
  const renderNotice = (metricsCount: number) =>
    render(
      <IntlProvider locale="en">
        <DesignSystemProvider>
          <RunsChartsMetricLimitNotice metricsCount={metricsCount} />
        </DesignSystemProvider>
      </IntlProvider>,
    );

  test('renders nothing when every metric gets a chart', () => {
    const { container } = renderNotice(MAX_AUTO_GENERATED_METRIC_CHARTS);

    expect(container).toBeEmptyDOMElement();
  });

  test('explains the limit and how to chart another metric when there are more metrics', () => {
    renderNotice(51234);

    expect(
      screen.getByText(
        new RegExp(`generated automatically for ${MAX_AUTO_GENERATED_METRIC_CHARTS} of 51,?234 metrics`),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/choose Add chart in a section/)).toBeInTheDocument();
  });

  test('can be dismissed', async () => {
    renderNotice(MAX_AUTO_GENERATED_METRIC_CHARTS + 1);
    expect(screen.getByText(/generated automatically for/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByText(/generated automatically for/)).not.toBeInTheDocument();
  });
});
