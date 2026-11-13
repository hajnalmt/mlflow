import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntlProvider } from 'react-intl';
import { render, screen, waitFor } from '@testing-library/react';
import { RunsSearchAutoComplete } from './RunsSearchAutoComplete';
import userEvent from '@testing-library/user-event';
import { DesignSystemProvider } from '@databricks/design-system';
import { QueryClient, QueryClientProvider } from '@databricks/web-shared/query-client';
import { MemoryRouter, Route, Routes } from '../../../../../common/utils/RoutingUtils';
import { MlflowService } from '../../../../sdk/MlflowService';
import { shouldUseRegexpBasedAutoRunsSearchFilter } from '../../../../../common/utils/FeatureUtils';

jest.mock('../../../../../common/utils/FeatureUtils', () => ({
  ...jest.requireActual<typeof import('../../../../../common/utils/FeatureUtils')>(
    '../../../../../common/utils/FeatureUtils',
  ),
  shouldUseRegexpBasedAutoRunsSearchFilter: jest.fn(),
}));

describe('RunsSearchAutoComplete', () => {
  const onClear = jest.fn();
  const onSearchFilterChange = jest.fn();

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    jest.spyOn(MlflowService, 'getExperimentRunDataKeys').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderTestComponent = ({ requestError = null }: { requestError?: Error | null } = {}) => {
    render(
      <RunsSearchAutoComplete
        onClear={onClear}
        onSearchFilterChange={onSearchFilterChange}
        requestError={requestError}
        runsData={{
          datasetsList: [],
          experimentTags: {},
          metricKeyList: [],
          metricsList: [],
          modelVersionsByRunUuid: {},
          paramKeyList: [],
          paramsList: [],
          runInfos: [],
          runUuidsMatchingFilter: [],
          tagsList: [],
        }}
        searchFilter=""
      />,
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/experiments/123']}>
            <Routes>
              <Route
                path="/experiments/:experimentId"
                element={
                  <IntlProvider locale="en">
                    <DesignSystemProvider>
                      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
                    </DesignSystemProvider>
                  </IntlProvider>
                }
              />
            </Routes>
          </MemoryRouter>
        ),
      },
    );
  };
  it('should render', async () => {
    // Enable automatic transformation from plain text to regexp-based RLIKE filter
    jest.mocked(shouldUseRegexpBasedAutoRunsSearchFilter).mockReturnValue(true);
    renderTestComponent();

    await userEvent.type(screen.getByRole('combobox'), 'foobar{Enter}');

    // Wait for the search filter to be updated
    await waitFor(() => {
      expect(onSearchFilterChange).toHaveBeenCalledWith('foobar');
    });

    // Expect relevant tooltip to be displayed
    expect(
      screen.getByLabelText(/The following query will be used: attributes\.run_name RLIKE 'foobar'/),
    ).toBeInTheDocument();
  });

  it('should display informational tooltip on error', async () => {
    // Render a component with a simulated syntax error
    renderTestComponent({ requestError: new Error('Bad syntax') });

    // Help tooltip should be displayed immediately
    expect(await screen.findByText(/Search runs using a simplified version of the SQL/)).toBeInTheDocument();
  });

  it('should suggest the metrics and params that the server found for the typed name', async () => {
    jest.mocked(shouldUseRegexpBasedAutoRunsSearchFilter).mockReturnValue(false);
    jest.mocked(MlflowService.getExperimentRunDataKeys).mockResolvedValue({
      metric_keys: ['eval/ds1/f1'],
      param_keys: ['eval_lr'],
    });
    renderTestComponent();

    await userEvent.type(screen.getByRole('combobox'), 'metrics.eval');

    // The table name is not part of the key that is searched for
    await waitFor(() =>
      expect(MlflowService.getExperimentRunDataKeys).toHaveBeenCalledWith(
        expect.objectContaining({ experiment_ids: ['123'], search: 'eval', max_results: 100 }),
      ),
    );
    expect(await screen.findByText('metrics.eval/ds1/f1', { exact: false })).toBeInTheDocument();
  });

  it('should not look up names before an entity is typed', () => {
    renderTestComponent();

    expect(MlflowService.getExperimentRunDataKeys).not.toHaveBeenCalled();
  });
});
