import { jest, describe, beforeAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { DesignSystemProvider } from '@databricks/design-system';
import { QueryClient, QueryClientProvider } from '@databricks/web-shared/query-client';
import { MlflowService } from '../../../../sdk/MlflowService';
import { MemoryRouter, Routes, Route } from '../../../../../common/utils/RoutingUtils';
import { ExperimentPageUIStateContextProvider } from '../../contexts/ExperimentPageUIStateContext';
import { createExperimentPageUIState } from '../../models/ExperimentPageUIState';
import type { ExperimentPageUIState } from '../../models/ExperimentPageUIState';
import type { ExperimentRunsSelectorResult } from '../../utils/experimentRuns.selector';
import { ExperimentViewRunsColumnSelector } from './ExperimentViewRunsColumnSelector';

// eslint-disable-next-line no-restricted-syntax -- TODO(FEINF-4392)
jest.setTimeout(30000);

// jsdom does not implement layout scrolling APIs that the component calls inside
// a requestAnimationFrame when the panel opens.
beforeAll(() => {
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? jest.fn();
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? jest.fn();
});

const MOCK_RUNS_DATA = {
  paramKeyList: ['alpha', 'beta'],
  metricKeyList: ['accuracy', 'loss'],
  tagsList: [{ 'my-tag': { key: 'my-tag', value: 'v' } }],
  datasetsList: [],
} as unknown as ExperimentRunsSelectorResult;

describe('ExperimentViewRunsColumnSelector', () => {
  const onResetColumns = jest.fn();
  let getRunDataKeysSpy: jest.SpiedFunction<typeof MlflowService.getExperimentRunDataKeys>;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    onResetColumns.mockClear();
    // By default, the server does not know any other keys than the ones of the loaded runs
    getRunDataKeysSpy = jest.spyOn(MlflowService, 'getExperimentRunDataKeys').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const TestBed = ({ initialVisible = false }: { initialVisible?: boolean }) => {
    const [visible, setVisible] = useState(initialVisible);
    const [uiState, setUiState] = useState<ExperimentPageUIState>(() => ({
      ...createExperimentPageUIState(),
      selectedColumns: [],
    }));

    return (
      <ExperimentPageUIStateContextProvider setUIState={setUiState}>
        <ExperimentViewRunsColumnSelector
          columnSelectorVisible={visible}
          onChangeColumnSelectorVisible={setVisible}
          runsData={MOCK_RUNS_DATA}
          selectedColumns={uiState.selectedColumns}
          onResetColumns={onResetColumns}
        />
      </ExperimentPageUIStateContextProvider>
    );
  };

  const renderComponent = (props?: { initialVisible?: boolean }) =>
    render(<TestBed {...props} />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={['/experiments/123']}>
          <Routes>
            <Route
              path="/experiments/:experimentId"
              element={
                <DesignSystemProvider>
                  <IntlProvider locale="en">
                    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
                  </IntlProvider>
                </DesignSystemProvider>
              }
            />
          </Routes>
        </MemoryRouter>
      ),
    });

  it('renders the Columns trigger button', () => {
    renderComponent();
    expect(screen.getByTestId('column-selection-dropdown')).toBeInTheDocument();
  });

  it('renders the panel inside the floating-ui popper anchored to the trigger', async () => {
    renderComponent();

    await userEvent.click(screen.getByTestId('column-selection-dropdown'));

    // The bug (#24414): the legacy antd `Dropdown` rendered the panel into a
    // detached overlay positioned by stale absolute pixels, which drifted to the
    // page top-left when the toolbar wrapped. The fix anchors the panel to the
    // trigger via a Radix/floating-ui popper, so the panel must live inside the
    // popper wrapper.
    const tree = await screen.findByTestId('column-selector-tree');
    const popperWrapper = document.querySelector('[data-radix-popper-content-wrapper]');
    expect(popperWrapper).toContainElement(tree);
  });

  it('filters the tree via the search input', async () => {
    renderComponent();
    await userEvent.click(screen.getByTestId('column-selection-dropdown'));

    const tree = await screen.findByTestId('column-selector-tree');
    expect(tree.textContent).toContain('accuracy');
    expect(tree.textContent).toContain('alpha');

    await userEvent.type(screen.getByPlaceholderText('Search columns'), 'alpha');

    // Only the matching column ("alpha") should remain in the tree.
    await waitFor(() => {
      expect(tree.textContent).not.toContain('accuracy');
    });
    expect(tree.textContent).toContain('alpha');
  });

  it('toggles a column when its tree checkbox is clicked', async () => {
    renderComponent();
    await userEvent.click(screen.getByTestId('column-selection-dropdown'));

    const tree = await screen.findByTestId('column-selector-tree');
    const alphaNode = within(tree).getByTitle('alpha');
    const treeNode = alphaNode.closest('[class*="tree-treenode"]');
    expect(treeNode).not.toBeNull();

    // Not checked initially.
    expect(treeNode?.querySelector('[class*="tree-checkbox-checked"]')).toBeNull();

    await userEvent.click(alphaNode);

    // Clicking the node checks its checkbox (reflecting the added column).
    await waitFor(() => {
      expect(treeNode?.querySelector('[class*="tree-checkbox-checked"]')).not.toBeNull();
    });
  });

  it('invokes onResetColumns and closes the panel when "Reset to defaults" is clicked', async () => {
    renderComponent();
    await userEvent.click(screen.getByTestId('column-selection-dropdown'));

    await userEvent.click(await screen.findByTestId('column-selector-reset'));

    expect(onResetColumns).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByTestId('column-selector-tree')).not.toBeInTheDocument();
    });
  });

  it('closes the panel when Escape is pressed', async () => {
    renderComponent();
    await userEvent.click(screen.getByTestId('column-selection-dropdown'));

    await screen.findByTestId('column-selector-tree');
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByTestId('column-selector-tree')).not.toBeInTheDocument();
    });
  });

  describe('regular expression search', () => {
    const openPanel = async () => {
      await userEvent.click(screen.getByTestId('column-selection-dropdown'));
      return screen.findByTestId('column-selector-tree');
    };

    const typeRegexSearch = async (text: string) => {
      await userEvent.click(screen.getByTestId('column-selector-regex-toggle'));
      await userEvent.type(screen.getByPlaceholderText('Search columns'), text);
    };

    it('filters the keys case-insensitively and sends the flag to the server', async () => {
      getRunDataKeysSpy.mockResolvedValue({
        metric_keys: ['eval/a/AP_50', 'eval/a/AP_50_95', 'train/loss'],
        param_keys: ['alpha_50'],
      });
      renderComponent();
      const tree = await openPanel();
      await waitFor(() => expect(tree.textContent).toContain('train/loss'));

      await typeRegexSearch('ap_50$');

      await waitFor(() => expect(tree.textContent).not.toContain('train/loss'));
      expect(tree.textContent).toContain('eval/a/AP_50');
      expect(tree.textContent).not.toContain('AP_50_95');
      expect(tree.textContent).not.toContain('alpha_50');
      await waitFor(() =>
        expect(getRunDataKeysSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'ap_50$', search_is_regex: true }),
        ),
      );
    });

    it('highlights the matched part of the keys', async () => {
      getRunDataKeysSpy.mockResolvedValue({ metric_keys: ['eval/a/AP_50'] });
      renderComponent();
      const tree = await openPanel();
      await waitFor(() => expect(tree.textContent).toContain('eval/a/AP_50'));

      await typeRegexSearch('a/ap_\\d+');

      await waitFor(() => expect(tree.textContent).not.toContain('accuracy'));
      const highlighted = Array.from(tree.querySelectorAll('strong')).map((element) => element.textContent);
      expect(highlighted).toEqual(['a/AP_50']);
    });

    it('shows a hint, lists no keys and does not query the server while the expression is invalid', async () => {
      renderComponent();
      const tree = await openPanel();
      await waitFor(() => expect(getRunDataKeysSpy).toHaveBeenCalled());
      getRunDataKeysSpy.mockClear();

      await typeRegexSearch('(');

      expect(await screen.findByTestId('column-selector-invalid-regex-hint')).toHaveTextContent(
        'Invalid regular expression',
      );
      await waitFor(() => expect(tree.textContent).not.toContain('accuracy'));
      // Wait longer than the debounce of the search text
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(getRunDataKeysSpy).not.toHaveBeenCalled();
    });
  });

  describe('keys that are logged on the runs but not loaded', () => {
    it('lists the metrics and params that the server found next to the ones of the loaded runs', async () => {
      getRunDataKeysSpy.mockResolvedValue({ metric_keys: ['eval/f1', 'loss'], param_keys: ['gamma'] });
      renderComponent();
      await userEvent.click(screen.getByTestId('column-selection-dropdown'));

      const tree = await screen.findByTestId('column-selector-tree');

      await waitFor(() => expect(tree.textContent).toContain('eval/f1'));
      expect(tree.textContent).toContain('gamma');
      // Loaded keys are still listed, and a key found by both is not duplicated
      expect(tree.textContent).toContain('accuracy');
      expect(within(tree).getAllByTitle('loss')).toHaveLength(1);
      expect(getRunDataKeysSpy).toHaveBeenCalledWith(
        expect.objectContaining({ experiment_ids: ['123'], search: undefined }),
      );
    });

    it('searches the keys on the server with the typed text', async () => {
      renderComponent();
      await userEvent.click(screen.getByTestId('column-selection-dropdown'));
      await screen.findByTestId('column-selector-tree');

      getRunDataKeysSpy.mockResolvedValue({ metric_keys: ['eval/ds1/f1'] });
      await userEvent.type(screen.getByPlaceholderText('Search columns'), 'ds1');

      await waitFor(() =>
        expect(getRunDataKeysSpy).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ds1' })),
      );
      await waitFor(() => expect(screen.getByTestId('column-selector-tree').textContent).toContain('eval/ds1/f1'));
    });

    it('tells that only the first keys are listed when the server truncated them', async () => {
      getRunDataKeysSpy.mockResolvedValue({ metric_keys: ['a', 'b'], metric_keys_truncated: true });
      renderComponent();
      await userEvent.click(screen.getByTestId('column-selection-dropdown'));

      expect(await screen.findByTestId('column-selector-truncated-hint')).toBeInTheDocument();
      expect(screen.getByTestId('column-selector-tree').textContent).toContain('Metrics (4+)');
    });

    it('does not show the truncation hint when all keys are listed', async () => {
      renderComponent();
      await userEvent.click(screen.getByTestId('column-selection-dropdown'));

      await screen.findByTestId('column-selector-tree');
      expect(screen.queryByTestId('column-selector-truncated-hint')).not.toBeInTheDocument();
    });

    it('does not look up the keys while the panel is closed', () => {
      renderComponent();

      expect(getRunDataKeysSpy).not.toHaveBeenCalled();
    });
  });
});
