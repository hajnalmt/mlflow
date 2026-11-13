import { useMemo, useRef, useState } from 'react';
import type { ErrorWrapper } from '../../../../../common/utils/ErrorWrapper';
import { EntitySearchAutoComplete } from '../../../EntitySearchAutoComplete';
import type { ExperimentRunsSelectorResult } from '../../utils/experimentRuns.selector';
import { RunsSearchTooltipContent } from './RunsSearchTooltipContent';
import type {
  EntitySearchAutoCompleteEntityNameGroup,
  EntitySearchAutoCompleteOptionGroup,
} from '../../../EntitySearchAutoComplete.utils';
import {
  cleanEntitySearchTagNames,
  getEntitySearchOptionsFromEntityNames,
} from '../../../EntitySearchAutoComplete.utils';
import { shouldUseRegexpBasedAutoRunsSearchFilter } from '../../../../../common/utils/FeatureUtils';
import { useExperimentIds } from '../../hooks/useExperimentIds';
import { useExperimentRunDataKeys } from '../../hooks/useExperimentRunDataKeys';

// A default placeholder for the search box
const SEARCH_BOX_PLACEHOLDER = 'metrics.rmse < 1 and params.model = "tree"';

export type RunsSearchAutoCompleteProps = {
  runsData: ExperimentRunsSelectorResult;
  searchFilter: string;
  onSearchFilterChange: (newValue: string) => void;
  onClear: () => void;
  requestError: ErrorWrapper | Error | null;
  className?: string;
};

const ATTRIBUTE_OPTIONS = [
  'run_id',
  'run_name',
  'status',
  'artifact_uri',
  'user_id',
  'start_time',
  'end_time',
  'created',
].map((s) => ({ value: `attributes.${s}` }));

// Maximum number of metric and param names looked up on the server for the typed text
const SERVER_SUGGESTIONS_MAX_RESULTS = 100;

// Matches the table name that prefixes the typed entity name, e.g. "metrics." in "metrics.rm"
const ENTITY_TABLE_PREFIX_REGEXP = /^(metrics?|params?|parameters?|tags?|attributes?|attr|run)\./i;

const mergeDeduplicate = (list1: string[], list2: string[]) => [...new Set([...list1, ...list2])];
const getTagNames = (tagsList: any[]) => tagsList.flatMap((tagRecord) => Object.keys(tagRecord));

const getEntityNamesFromRunsData = (
  newRunsData: ExperimentRunsSelectorResult,
  existingNames: EntitySearchAutoCompleteEntityNameGroup,
): EntitySearchAutoCompleteEntityNameGroup => {
  const metricNames = mergeDeduplicate(existingNames.metricNames, newRunsData.metricKeyList);
  const paramNames = mergeDeduplicate(existingNames.paramNames, newRunsData.paramKeyList);
  const tagNames = cleanEntitySearchTagNames(
    mergeDeduplicate(getTagNames(existingNames.tagNames), getTagNames(newRunsData.tagsList)),
  );

  return {
    metricNames,
    paramNames,
    tagNames,
  };
};

export const RunsSearchAutoComplete = ({ runsData, ...restProps }: RunsSearchAutoCompleteProps) => {
  const experimentIds = useExperimentIds();
  const existingEntityNamesRef = useRef<EntitySearchAutoCompleteEntityNameGroup>({
    metricNames: [],
    paramNames: [],
    tagNames: [],
  });

  // The runs only hold the metrics and params of the displayed columns, so the names that match the typed
  // text are looked up on the server.
  const [editedEntityName, setEditedEntityName] = useState('');
  const { metricKeys: serverMetricNames, paramKeys: serverParamNames } = useExperimentRunDataKeys({
    experimentIds,
    search: editedEntityName.replace(ENTITY_TABLE_PREFIX_REGEXP, ''),
    maxResults: SERVER_SUGGESTIONS_MAX_RESULTS,
    enabled: editedEntityName.length > 0,
  });

  const baseOptions = useMemo<EntitySearchAutoCompleteOptionGroup[]>(() => {
    const existingEntityNames = existingEntityNamesRef.current;
    const mergedEntityNames = getEntityNamesFromRunsData(runsData, existingEntityNames);
    existingEntityNamesRef.current = mergedEntityNames;
    return getEntitySearchOptionsFromEntityNames(
      {
        ...mergedEntityNames,
        // Names found by the server are not remembered, they are specific to the typed text
        metricNames: mergeDeduplicate(mergedEntityNames.metricNames, serverMetricNames),
        paramNames: mergeDeduplicate(mergedEntityNames.paramNames, serverParamNames),
      },
      ATTRIBUTE_OPTIONS,
    );
  }, [runsData, serverMetricNames, serverParamNames]);

  return (
    <EntitySearchAutoComplete
      {...restProps}
      baseOptions={baseOptions}
      tooltipContent={<RunsSearchTooltipContent />}
      placeholder={SEARCH_BOX_PLACEHOLDER}
      useQuickFilter={shouldUseRegexpBasedAutoRunsSearchFilter()}
      onEditedEntityNameChange={setEditedEntityName}
    />
  );
};
