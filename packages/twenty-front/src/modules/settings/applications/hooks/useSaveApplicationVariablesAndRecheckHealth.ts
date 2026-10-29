import { useRunApplicationHealthCheck } from '@/settings/applications/hooks/useRunApplicationHealthCheck';
import { type ApplicationHealthCheckRunner } from '@/settings/applications/types/ApplicationHealthCheckRunner';
import { shouldRecheckApplicationHealthAfterSave } from '@/settings/applications/utils/shouldRecheckApplicationHealthAfterSave';

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
    const isSaved = await saveApplicationVariables();

    if (
      !shouldRecheckApplicationHealthAfterSave({
        isSaved,
        hasHealthCheck,
        hasMissingRequiredVariables,
      })
    ) {
      return;
    }

    await runApplicationHealthCheck({ shouldKeepPreviousResult: true });
  };

  return { saveApplicationVariablesAndRecheckHealth };
};
