import { useRunApplicationHealthCheck } from '@/settings/applications/hooks/useRunApplicationHealthCheck';
import { type ApplicationHealthCheckRunner } from '@/settings/applications/types/ApplicationHealthCheckRunner';

export const useSaveApplicationVariablesAndRecheckHealth = <TData>({
  applicationId,
  runner,
  hasHealthCheck,
  hasMissingRequiredVariables,
  saveApplicationVariables,
}: {
  applicationId: string;
  runner: ApplicationHealthCheckRunner<TData>;
  hasHealthCheck: boolean;
  hasMissingRequiredVariables: boolean;
  saveApplicationVariables: () => Promise<boolean>;
}) => {
  const { runApplicationHealthCheck } = useRunApplicationHealthCheck({
    applicationId,
    runner,
  });

  const saveApplicationVariablesAndRecheckHealth = async () => {
    const areApplicationVariablesSaved = await saveApplicationVariables();

    if (
      !areApplicationVariablesSaved ||
      !hasHealthCheck ||
      hasMissingRequiredVariables
    ) {
      return;
    }

    await runApplicationHealthCheck({ shouldKeepPreviousResult: true });
  };

  return { saveApplicationVariablesAndRecheckHealth };
};
