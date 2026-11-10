import { jest, describe, test, expect } from '@jest/globals';
import { keyBy } from 'lodash';
import { renderWithIntl, fastFillInput, screen } from '@mlflow/mlflow/src/common/utils/TestUtils.react18';
import type { KeyValueEntity } from '../../common/types';
import { DetailsOverviewParamsTable } from './DetailsOverviewParamsTable';
import { MemoryRouter } from '../../common/utils/RoutingUtils';
import userEvent from '@testing-library/user-event';

const testRunUuid = 'test-run-uuid';

// Larger timeout for integration testing (table rendering)
// eslint-disable-next-line no-restricted-syntax -- TODO(FEINF-4392)
jest.setTimeout(60000);

// Generates array of param_a1, param_a2, ..., param_b2, ..., param_c3 param keys with values "value_1.0"..."value_9.0"
const sampleLatestParameters = keyBy(
  ['a', 'b', 'c'].flatMap((letter, letterIndex) =>
    [1, 2, 3].map((digit, digitIndex) => ({
      key: `param_${letter}${digit}`,
      value: 'value_' + (letterIndex * 3 + digitIndex + 1).toFixed(1),
    })),
  ),
  'key',
) as any;

describe('DetailsOverviewParamsTable', () => {
  const renderComponent = (params: Record<string, KeyValueEntity> = sampleLatestParameters) => {
    return renderWithIntl(
      <MemoryRouter>
        <DetailsOverviewParamsTable params={params} />
      </MemoryRouter>,
    );
  };

  test('Renders the table with no params recorded', () => {
    renderComponent({});
    expect(screen.getByText('No parameters recorded')).toBeInTheDocument();
  });

  test('Renders the table with values and filters values', async () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: 'Parameters (9)' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'param_a1 value_1.0' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'param_c3 value_9.0' })).toBeInTheDocument();

    expect(screen.getAllByRole('row')).toHaveLength(10); // 9 rows + 1 header row

    await fastFillInput(screen.getByRole('textbox'), 'param_a');

    expect(screen.getAllByRole('row')).toHaveLength(4); // 3 rows + 1 header row

    await userEvent.clear(screen.getByRole('textbox'));
    await fastFillInput(screen.getByRole('textbox'), 'pArAM_a');

    expect(screen.getAllByRole('row')).toHaveLength(4); // 3 rows + 1 header row

    await userEvent.clear(screen.getByRole('textbox'));
    await fastFillInput(screen.getByRole('textbox'), 'param_xyz');

    expect(screen.getByText('No parameters match the search filter')).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox'));
    await fastFillInput(screen.getByRole('textbox'), '9.0');

    expect(screen.getAllByRole('row')).toHaveLength(2); // 1 row + 1 header row
  });

  describe('with more params than the page size', () => {
    const getRenderedRows = () => document.querySelectorAll('[role="row"]');

    const buildParams = (count: number): Record<string, KeyValueEntity> =>
      keyBy(
        Array.from({ length: count }, (_, index) => ({
          key: `param_${index.toString().padStart(3, '0')}`,
          value: `value_${index}`,
        })),
        'key',
      );

    test('renders a page of rows and reveals the rest on demand', async () => {
      renderComponent(buildParams(250));

      // The title counts all params, but only the first page of rows is rendered
      expect(screen.getByRole('heading', { name: 'Parameters (250)' })).toBeInTheDocument();
      expect(getRenderedRows()).toHaveLength(100 + 1);
      expect(screen.getByText('param_099')).toBeInTheDocument();
      expect(screen.queryByText('param_100')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Show 100 more (150 remaining)' }));
      expect(getRenderedRows()).toHaveLength(200 + 1);

      await userEvent.click(screen.getByRole('button', { name: 'Show 50 more (50 remaining)' }));
      expect(getRenderedRows()).toHaveLength(250 + 1);
      expect(screen.getByText('param_249')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Show .* more/ })).not.toBeInTheDocument();
    });

    test('filters all params, not only the rendered ones, and starts over from the first page', async () => {
      renderComponent(buildParams(250));
      await userEvent.click(screen.getByRole('button', { name: 'Show 100 more (150 remaining)' }));

      // This param is beyond the rendered rows
      await fastFillInput(screen.getByRole('textbox'), 'value_249');
      expect(screen.getByRole('heading', { name: 'Parameters (1)' })).toBeInTheDocument();
      expect(screen.getByText('param_249')).toBeInTheDocument();

      await userEvent.clear(screen.getByRole('textbox'));
      expect(getRenderedRows()).toHaveLength(100 + 1);
    });
  });
});
