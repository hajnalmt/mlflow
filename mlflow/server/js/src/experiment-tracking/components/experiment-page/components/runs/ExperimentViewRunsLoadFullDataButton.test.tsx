import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlProvider } from 'react-intl';
import { DesignSystemProvider } from '@databricks/design-system';
import { ExperimentViewRunsLoadFullDataButton } from './ExperimentViewRunsLoadFullDataButton';

const renderButton = (props: React.ComponentProps<typeof ExperimentViewRunsLoadFullDataButton>) =>
  render(<ExperimentViewRunsLoadFullDataButton {...props} />, {
    wrapper: ({ children }) => (
      <DesignSystemProvider>
        <IntlProvider locale="en">{children}</IntlProvider>
      </DesignSystemProvider>
    ),
  });

describe('ExperimentViewRunsLoadFullDataButton', () => {
  it('is disabled when no run is selected', () => {
    renderButton({ runsSelected: {}, loadFullRunData: jest.fn(async (_runUuids: string[]) => {}) });

    expect(screen.getByTestId('runs-load-full-data-button')).toBeDisabled();
  });

  it('is disabled when all runs have been deselected', () => {
    renderButton({ runsSelected: { run1: false }, loadFullRunData: jest.fn(async (_runUuids: string[]) => {}) });

    expect(screen.getByTestId('runs-load-full-data-button')).toBeDisabled();
  });

  it('loads the full data of the selected runs only', async () => {
    const loadFullRunData = jest.fn(async (_runUuids: string[]) => {});
    renderButton({ runsSelected: { run1: true, run2: false, run3: true }, loadFullRunData });

    const button = screen.getByTestId('runs-load-full-data-button');
    expect(button).toBeEnabled();
    await userEvent.click(button);

    expect(loadFullRunData).toHaveBeenCalledTimes(1);
    expect(loadFullRunData).toHaveBeenCalledWith(['run1', 'run3']);
  });

  it('explains why it is disabled in its tooltip', async () => {
    renderButton({ runsSelected: {}, loadFullRunData: jest.fn(async (_runUuids: string[]) => {}) });

    await userEvent.hover(screen.getByTestId('runs-load-full-data-button'));

    await waitFor(() =>
      expect(
        screen.getAllByText('Select runs in the table to load all of their metrics and parameters').length,
      ).toBeGreaterThan(0),
    );
  });

  it('is not rendered when loading the full data is not supported', () => {
    renderButton({ runsSelected: { run1: true } });

    expect(screen.queryByTestId('runs-load-full-data-button')).not.toBeInTheDocument();
  });
});
