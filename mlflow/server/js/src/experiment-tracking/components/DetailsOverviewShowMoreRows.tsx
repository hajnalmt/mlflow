import { Button, useDesignSystemTheme } from '@databricks/design-system';
import { FormattedMessage } from 'react-intl';

/**
 * Number of rows that the metrics and parameters tables of the details pages render at once.
 * Runs can log thousands of metrics and parameters, and mounting a row for each of them makes the
 * page slow. The search filter always covers all rows, and the rest is revealed on demand.
 */
export const DETAILS_OVERVIEW_TABLE_PAGE_SIZE = 100;

/**
 * Footer of a details page table that renders a limited number of rows. Renders nothing when
 * all rows are displayed.
 */
export const DetailsOverviewShowMoreRows = ({
  componentId,
  remainingCount,
  onShowMore,
}: {
  componentId: string;
  remainingCount: number;
  onShowMore: () => void;
}) => {
  const { theme } = useDesignSystemTheme();

  if (remainingCount <= 0) {
    return null;
  }

  return (
    <div css={{ flexShrink: 0, paddingTop: theme.spacing.sm }}>
      <Button componentId={componentId} block onClick={onShowMore}>
        <FormattedMessage
          defaultMessage="Show {count} more ({remaining} remaining)"
          description="Run page > Overview > Metrics and parameters tables > Button that reveals more rows when the table is truncated"
          values={{
            count: Math.min(remainingCount, DETAILS_OVERVIEW_TABLE_PAGE_SIZE),
            remaining: remainingCount,
          }}
        />
      </Button>
    </div>
  );
};
