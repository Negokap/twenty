import { type ApplicationHealthCheckRunner } from '@/settings/applications/types/ApplicationHealthCheckRunner';
import { useMutation } from '@apollo/client/react';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

export const useRunApplicationHealthCheck = <TData>({
  applicationId,
  runner: { healthCheckFamilyState, healthCheckMutation, getHealthCheckResult },
}: {
  applicationId: string;
  runner: ApplicationHealthCheckRunner<TData>;
}) => {
  const store = useStore();

  const [runHealthCheckMutation] = useMutation(healthCheckMutation);

  const runApplicationHealthCheck = useCallback(
    async ({
      shouldKeepPreviousResult,
    }: {
      shouldKeepPreviousResult: boolean;
    }) => {
      const healthCheckAtom = healthCheckFamilyState.atomFamily(applicationId);
      const runId = v4();

      store.set(healthCheckAtom, (previousHealthCheck) => ({
        runId,
        result: shouldKeepPreviousResult ? previousHealthCheck.result : null,
      }));

      const response = await runHealthCheckMutation({
        variables: { applicationId },
      }).catch(() => undefined);

      if (!isDefined(response) || store.get(healthCheckAtom).runId !== runId) {
        return;
      }

      store.set(healthCheckAtom, {
        runId,
        result: isDefined(response.data)
          ? getHealthCheckResult(response.data)
          : null,
      });
    },
    [
      applicationId,
      getHealthCheckResult,
      healthCheckFamilyState,
      runHealthCheckMutation,
      store,
    ],
  );

  return { runApplicationHealthCheck };
};
