import { SetjooProviderEnabledGuard } from 'src/engine/core-modules/auth/guards/setjoo-provider-enabled.guard';

const buildGuard = (isEnabled: boolean) => {
  const guardRedirectService = {
    dispatchErrorFromGuard: jest.fn(),
    getSubdomainAndCustomDomainFromContext: jest.fn(() => ({
      subdomain: 'app',
      customDomain: null,
    })),
  };

  return {
    guardRedirectService,
    guard: new SetjooProviderEnabledGuard(
      { get: () => isEnabled } as never,
      guardRedirectService as never,
    ),
  };
};

describe('SetjooProviderEnabledGuard', () => {
  it('lets the request through when AUTH_SETJOO_ENABLED is on', () => {
    const { guard, guardRedirectService } = buildGuard(true);

    expect(guard.canActivate({} as never)).toBe(true);
    expect(guardRedirectService.dispatchErrorFromGuard).not.toHaveBeenCalled();
  });

  it('redirects with a clear error when AUTH_SETJOO_ENABLED is off', () => {
    const { guard, guardRedirectService } = buildGuard(false);

    expect(guard.canActivate({} as never)).toBe(false);
    expect(guardRedirectService.dispatchErrorFromGuard).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ message: 'Setjoo auth is not enabled' }),
      { subdomain: 'app', customDomain: null },
    );
  });
});
