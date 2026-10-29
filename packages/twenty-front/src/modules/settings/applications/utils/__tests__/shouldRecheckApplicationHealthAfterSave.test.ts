import { shouldRecheckApplicationHealthAfterSave } from '@/settings/applications/utils/shouldRecheckApplicationHealthAfterSave';

describe('shouldRecheckApplicationHealthAfterSave', () => {
  it('rechecks after a successful save of an app with a health check and nothing missing', () => {
    expect(
      shouldRecheckApplicationHealthAfterSave({
        isSaved: true,
        hasHealthCheck: true,
        hasMissingRequiredVariables: false,
      }),
    ).toBe(true);
  });

  it.each([
    {
      reason: 'the save failed',
      isSaved: false,
      hasHealthCheck: true,
      hasMissingRequiredVariables: false,
    },
    {
      reason: 'the app declares no health check',
      isSaved: true,
      hasHealthCheck: false,
      hasMissingRequiredVariables: false,
    },
    {
      reason: 'a required variable was missing',
      isSaved: true,
      hasHealthCheck: true,
      hasMissingRequiredVariables: true,
    },
  ])(
    'does not recheck when $reason',
    ({ isSaved, hasHealthCheck, hasMissingRequiredVariables }) => {
      expect(
        shouldRecheckApplicationHealthAfterSave({
          isSaved,
          hasHealthCheck,
          hasMissingRequiredVariables,
        }),
      ).toBe(false);
    },
  );
});
