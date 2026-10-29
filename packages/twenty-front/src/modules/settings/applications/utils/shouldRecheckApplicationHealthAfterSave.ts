export const shouldRecheckApplicationHealthAfterSave = ({
  isSaved,
  hasHealthCheck,
  hasMissingRequiredVariables,
}: {
  isSaved: boolean;
  hasHealthCheck: boolean;
  hasMissingRequiredVariables: boolean;
}): boolean => isSaved && hasHealthCheck && !hasMissingRequiredVariables;
