import { createHash } from 'crypto';

import { Issuer } from 'openid-client';

import { AuthExceptionCode } from 'src/engine/core-modules/auth/auth.exception';
import { SetjooAuthService } from 'src/engine/core-modules/auth/services/setjoo-auth.service';

jest.mock('openid-client', () => ({
  ...jest.requireActual('openid-client'),
  Issuer: { discover: jest.fn() },
}));

const CALLBACK_URL = 'https://crm.setjoo.com/oauth/callback';

const CONFIG: Record<string, string> = {
  AUTH_SETJOO_ISSUER: 'https://auth.setjoo.com',
  AUTH_SETJOO_CLIENT_ID: 'setjoo-crm',
  AUTH_SETJOO_CALLBACK_URL: CALLBACK_URL,
};

describe('SetjooAuthService', () => {
  let cache: Map<string, unknown>;
  let clientMetadata: Record<string, unknown> | undefined;
  let callback: jest.Mock;
  let authorizationUrl: jest.Mock;
  let service: SetjooAuthService;

  beforeEach(() => {
    cache = new Map();
    callback = jest.fn().mockResolvedValue({
      claims: () => ({
        email: 'ada@setjoo.com',
        name: 'Ada King Lovelace',
        picture: 'https://cdn.setjoo.com/ada.png',
      }),
    });
    authorizationUrl = jest.fn(
      (parameters: Record<string, string>) =>
        `https://auth.setjoo.com/oauth/authorize?${new URLSearchParams(parameters)}`,
    );

    jest.mocked(Issuer.discover).mockResolvedValue({
      Client: class {
        constructor(metadata: Record<string, unknown>) {
          clientMetadata = metadata;
        }
        authorizationUrl = authorizationUrl;
        callback = callback;
      },
    } as unknown as Issuer);

    service = new SetjooAuthService(
      { get: (key: string) => CONFIG[key] } as never,
      {
        set: async (key: string, value: unknown) => cache.set(key, value),
        get: async (key: string) => cache.get(key),
        del: async (key: string) => cache.delete(key),
      } as never,
    );
  });

  it('registers a public client and sends an S256 challenge of the stored verifier', async () => {
    const { state } = await service.startSignIn({ workspaceId: 'ws-1' });

    expect(Issuer.discover).toHaveBeenCalledWith('https://auth.setjoo.com');
    expect(clientMetadata).toEqual({
      client_id: 'setjoo-crm',
      redirect_uris: [CALLBACK_URL],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    expect(clientMetadata).not.toHaveProperty('client_secret');

    const parameters = authorizationUrl.mock.calls[0][0];
    const [pendingSignIn] = [...cache.values()] as [
      { codeVerifier: string; socialSsoState: unknown },
    ];

    expect(parameters.state).toBe(state);
    expect(parameters.scope).toBe('openid profile email');
    expect(parameters.code_challenge_method).toBe('S256');
    expect(parameters.code_challenge).toBe(
      createHash('sha256')
        .update(pendingSignIn.codeVerifier)
        .digest('base64url'),
    );
    expect(pendingSignIn.socialSsoState).toEqual({ workspaceId: 'ws-1' });
  });

  it('rejects a state that does not match the cookie', async () => {
    const { state } = await service.startSignIn({});

    await expect(
      service.finishSignIn({
        callbackParameters: { code: 'code', state },
        stateFromCookie: 'other-state',
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.SSO_AUTH_FAILED });
    expect(callback).not.toHaveBeenCalled();
  });

  it('rejects a callback whose verifier is missing or already used', async () => {
    await expect(
      service.finishSignIn({
        callbackParameters: { code: 'code', state: 'unknown' },
        stateFromCookie: 'unknown',
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.SSO_AUTH_FAILED });
    expect(callback).not.toHaveBeenCalled();
  });

  it('exchanges the code with the verifier and maps ID token claims', async () => {
    const { state } = await service.startSignIn({
      workspaceInviteHash: 'invite',
      locale: 'fr-FR',
    });
    const [{ codeVerifier }] = [...cache.values()] as [
      { codeVerifier: string },
    ];

    const user = await service.finishSignIn({
      callbackParameters: { code: 'code', state },
      stateFromCookie: state,
    });

    expect(callback).toHaveBeenCalledWith(
      CALLBACK_URL,
      { code: 'code', state },
      { state, code_verifier: codeVerifier },
    );
    expect(user).toEqual({
      email: 'ada@setjoo.com',
      firstName: 'Ada',
      lastName: 'King Lovelace',
      picture: 'https://cdn.setjoo.com/ada.png',
      workspaceInviteHash: 'invite',
      workspaceId: undefined,
      billingCheckoutSessionState: undefined,
      action: 'list-available-workspaces',
      locale: 'fr-FR',
      returnToPath: undefined,
    });

    await expect(
      service.finishSignIn({
        callbackParameters: { code: 'code', state },
        stateFromCookie: state,
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.SSO_AUTH_FAILED });
  });

  it('prefers given and family name claims', async () => {
    callback.mockResolvedValue({
      claims: () => ({
        email: 'ada@setjoo.com',
        name: 'Ignored',
        given_name: 'Ada',
        family_name: 'Lovelace',
      }),
    });
    const { state } = await service.startSignIn({});

    await expect(
      service.finishSignIn({
        callbackParameters: { code: 'code', state },
        stateFromCookie: state,
      }),
    ).resolves.toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      picture: null,
    });
  });

  it('rejects an email the provider marks as unverified', async () => {
    callback.mockResolvedValue({
      claims: () => ({ email: 'ada@setjoo.com', email_verified: false }),
    });
    const { state } = await service.startSignIn({});

    await expect(
      service.finishSignIn({
        callbackParameters: { code: 'code', state },
        stateFromCookie: state,
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.EMAIL_NOT_VERIFIED });
  });

  it('turns a denied consent into OAUTH_ACCESS_DENIED', async () => {
    await expect(
      service.finishSignIn({
        callbackParameters: { error: 'access_denied' },
        stateFromCookie: undefined,
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.OAUTH_ACCESS_DENIED });
  });
});
