import { Button, Tooltip } from '@databricks/design-system';
import React, { useCallback, useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

export interface ExperimentViewRunsLoadFullDataButtonProps {
  /**
   * Run selection of the runs table, run UUID -> selected
   */
  runsSelected: Record<string, boolean>;
  /**
   * Loads all metrics and params of the given runs. The table only loads the metrics and params
   * of the displayed columns by default, which keeps it fast for runs that log thousands of them.
   */
  loadFullRunData?: (runUuids: string[]) => Promise<void>;
  isLoadingFullRunData?: boolean;
}

/**
 * Button that loads all metrics and params of the selected runs. It is disabled when no run is selected.
 */
export const ExperimentViewRunsLoadFullDataButton = React.memo(
  // eslint-disable-next-line react-component-name/react-component-name -- TODO(FEINF-4716)
  ({ runsSelected, loadFullRunData, isLoadingFullRunData }: ExperimentViewRunsLoadFullDataButtonProps) => {
    const intl = useIntl();
    const selectedRunUuids = useMemo(
      () =>
        Object.entries(runsSelected)
          .filter(([, isSelected]) => isSelected)
          .map(([runUuid]) => runUuid),
      [runsSelected],
    );

    const onClick = useCallback(() => {
      loadFullRunData?.(selectedRunUuids);
    }, [loadFullRunData, selectedRunUuids]);

    if (!loadFullRunData) {
      return null;
    }

    const hasSelectedRuns = selectedRunUuids.length > 0;

    return (
      <Tooltip
        componentId="mlflow.experiment_page.runs_table.load_full_data.tooltip"
        content={
          hasSelectedRuns
            ? intl.formatMessage({
                defaultMessage: 'Load all metrics and parameters of the selected runs',
                description: 'Tooltip of the button that loads the full metric and param data of selected runs',
              })
            : intl.formatMessage({
                defaultMessage: 'Select runs in the table to load all of their metrics and parameters',
                description: 'Tooltip of the disabled button that loads the full data of runs when no run is selected',
              })
        }
      >
        {/* The wrapper makes the tooltip work on the disabled button */}
        <span>
          <Button
            componentId="mlflow.experiment_page.runs_table.load_full_data"
            data-testid="runs-load-full-data-button"
            disabled={!hasSelectedRuns}
            loading={isLoadingFullRunData}
            onClick={onClick}
          >
            <FormattedMessage
              defaultMessage="Load full data"
              description="Label of the button above the experiment runs table that loads all metrics and params of the selected runs"
            />
          </Button>
        </span>
      </Tooltip>
    );
  },
);
