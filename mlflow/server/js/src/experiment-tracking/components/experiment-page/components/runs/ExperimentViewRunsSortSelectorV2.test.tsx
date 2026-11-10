import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../../../../common/utils/TestUtils.react18';
import { ExperimentViewRunsSortSelectorV2 } from './ExperimentViewRunsSortSelectorV2';
import { DesignSystemProvider } from '@databricks/design-system';
import { MemoryRouter, Route, Routes, useSearchParams } from '../../../../../common/utils/RoutingUtils';
import { IntlProvider } from 'react-intl';
import { QueryClient, QueryClientProvider } from '@databricks/web-shared/query-client';
import { MlflowService } from '../../../../sdk/MlflowService';

// eslint-disable-next-line no-restricted-syntax -- TODO(FEINF-4392)
jest.setTimeout(30000);

const metricKeys = ['metric_alpha', 'metric_beta'];
const paramKeys = ['param_1', 'param_2', 'param_3'];

jest.mock('../../../../../common/utils/RoutingUtils', () => {
  const params = new URLSearchParams();
  const setSearchParamsMock = jest.fn((setter: (newParams: URLSearchParams) => URLSearchParams) => setter(params));
  return {
    ...jest.requireActual<typeof import('../../../../../common/utils/RoutingUtils')>(
      '../../../../../common/utils/RoutingUtils',
    ),
    useSearchParams: () => {
      return [params, setSearchParamsMock];
    },
  };
});

describe('ExperimentViewRunsSortSelectorV2', () => {
  let mockLatestParams = new URLSearchParams();

  const getCurrentSearchParams = () => Object.fromEntries(mockLatestParams.entries());

  let queryClient: QueryClient;

  const renderComponent = (experimentId = '123') => {
    const Component = () => {
      const [latestParams] = useSearchParams();
      mockLatestParams = latestParams;

      return (
        <ExperimentViewRunsSortSelectorV2
          metricKeys={metricKeys}
          paramKeys={paramKeys}
          orderByKey=""
          orderByAsc={false}
        />
      );
    };
    render(<Component />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[`/experiments/${experimentId}`]}>
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
    });
  };

  beforeEach(() => {
    mockLatestParams = new URLSearchParams();
    queryClient = new QueryClient();
    jest.spyOn(MlflowService, 'getExperimentRunDataKeys').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should change sort options', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'metric_alpha' }));

    expect(getCurrentSearchParams()).toEqual(expect.objectContaining({ orderByKey: 'metrics.`metric_alpha`' }));

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.click(screen.getByLabelText('Sort ascending'));

    expect(getCurrentSearchParams()).toEqual(
      expect.objectContaining({
        orderByAsc: 'true',
        orderByKey: 'metrics.`metric_alpha`',
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.click(screen.getByLabelText('Sort descending'));

    expect(getCurrentSearchParams()).toEqual(
      expect.objectContaining({
        orderByAsc: 'false',
        orderByKey: 'metrics.`metric_alpha`',
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'param_2' }));

    expect(getCurrentSearchParams()).toEqual(
      expect.objectContaining({
        orderByAsc: 'false',
        orderByKey: 'params.`param_2`',
      }),
    );
  });

  test('should search for parameter', async () => {
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.type(screen.getByPlaceholderText('Search'), 'beta');
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'metric_beta' }));

    expect(getCurrentSearchParams()).toEqual(expect.objectContaining({ orderByKey: 'metrics.`metric_beta`' }));

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.type(screen.getByPlaceholderText('Search'), 'abc-xyz-foo-bar');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  test('should offer the metrics and params found by the server for the search query', async () => {
    jest.mocked(MlflowService.getExperimentRunDataKeys).mockResolvedValue({
      metric_keys: ['eval/ds1/f1', 'metric_beta'],
      param_keys: ['eval_lr'],
    });
    renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.type(screen.getByPlaceholderText('Search'), 'eval');

    await waitFor(() =>
      expect(MlflowService.getExperimentRunDataKeys).toHaveBeenLastCalledWith(
        expect.objectContaining({ experiment_ids: ['123'], search: 'eval', max_results: 100 }),
      ),
    );
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'eval/ds1/f1' }));

    expect(getCurrentSearchParams()).toEqual(expect.objectContaining({ orderByKey: 'metrics.`eval/ds1/f1`' }));
    // Keys that were loaded already are not offered twice
    await userEvent.click(screen.getByRole('button', { name: /Sort/ }));
    await userEvent.type(screen.getByPlaceholderText('Search'), 'beta');
    expect(screen.getAllByRole('menuitemcheckbox', { name: 'metric_beta' })).toHaveLength(1);
  });
});
