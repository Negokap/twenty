import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import ms from 'ms';
import {
  type BaseClient,
  type CallbackParamsType,
  generators,
  Issuer,
} from 'openid-client';
import { isDefined } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { type GoogleRequest } from 'src/engine/core-modules/auth/strategies/google.auth.strategy';
import { type SocialSsoState } from 'src/engine/core-modules/auth/types/social-sso-state.type';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const PENDING_SIGN_IN_TTL = ms('10m');

type PendingSetjooSignIn = {
  codeVerifier: string;
  socialSsoState: SocialSsoState;
};

const getPendingSignInCacheKey = (state: string) =>
  `setjoo-auth-pending-sign-in:${state}`;

@Injectable()
export class SetjooAuthService {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    @InjectCacheStorage(CacheStorageNamespace.EngineAuthSession)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  private async getClient(): Promise<BaseClient> {
    const issuer = await Issuer.discover(
      this.twentyConfigService.get('AUTH_SETJOO_ISSUER'),
    );

    return new issuer.Client({
      client_id: this.twentyConfigService.get('AUTH_SETJOO_CLIENT_ID'),
      redirect_uris: [this.twentyConfigService.get('AUTH_SETJOO_CALLBACK_URL')],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  }

  // No nonce: Setjoo Identity does not echo it in ID tokens; state + PKCE bind the code to this browser
  async startSignIn(
    socialSsoState: SocialSsoState,
  ): Promise<{ authorizationUrl: string; state: string }> {
    const client = await this.getClient();
    const state = generators.state();
    const codeVerifier = generators.codeVerifier();

    await this.cacheStorage.set<PendingSetjooSignIn>(
      getPendingSignInCacheKey(state),
      { codeVerifier, socialSsoState },
      PENDING_SIGN_IN_TTL,
    );

    return {
      state,
      authorizationUrl: client.authorizationUrl({
        scope: 'openid profile email',
        state,
        code_challenge: generators.codeChallenge(codeVerifier),
        code_challenge_method: 'S256',
      }),
    };
  }

  async finishSignIn({
    callbackParameters,
    stateFromCookie,
  }: {
    callbackParameters: CallbackParamsType;
    stateFromCookie: string | undefined;
  }): Promise<GoogleRequest['user']> {
    if (callbackParameters.error === 'access_denied') {
      throw new AuthException(
        'Setjoo OAuth access denied',
        AuthExceptionCode.OAUTH_ACCESS_DENIED,
      );
    }

    const { state } = callbackParameters;

    if (!isNonEmptyString(state) || state !== stateFromCookie) {
      throw new AuthException(
        'Setjoo sign-in state does not match, please try again',
        AuthExceptionCode.SSO_AUTH_FAILED,
      );
    }

    const pendingSignInCacheKey = getPendingSignInCacheKey(state);
    const pendingSignIn = await this.cacheStorage.get<PendingSetjooSignIn>(
      pendingSignInCacheKey,
    );

    if (!isDefined(pendingSignIn)) {
      throw new AuthException(
        'Setjoo sign-in expired, please try again',
        AuthExceptionCode.SSO_AUTH_FAILED,
      );
    }

    await this.cacheStorage.del(pendingSignInCacheKey);

    const client = await this.getClient();

    const tokenSet = await client.callback(
      this.twentyConfigService.get('AUTH_SETJOO_CALLBACK_URL'),
      callbackParameters,
      { state, code_verifier: pendingSignIn.codeVerifier },
    );

    const claims = tokenSet.claims();

    if (!isNonEmptyString(claims.email)) {
      throw new AuthException(
        'Setjoo did not return an email address',
        AuthExceptionCode.EMAIL_NOT_VERIFIED,
      );
    }

    if (isDefined(claims.email_verified) && claims.email_verified !== true) {
      throw new AuthException(
        'Please verify your email address with Setjoo',
        AuthExceptionCode.EMAIL_NOT_VERIFIED,
      );
    }

    const [firstNameFromName, ...lastNameFromName] = (claims.name ?? '')
      .trim()
      .split(/\s+/);
    const { socialSsoState } = pendingSignIn;

    return {
      email: claims.email,
      firstName: claims.given_name ?? firstNameFromName,
      lastName: claims.family_name ?? lastNameFromName.join(' '),
      picture: claims.picture ?? null,
      workspaceInviteHash: socialSsoState.workspaceInviteHash,
      workspaceId: socialSsoState.workspaceId,
      billingCheckoutSessionState: socialSsoState.billingCheckoutSessionState,
      action: socialSsoState.action ?? 'list-available-workspaces',
      locale: socialSsoState.locale,
      returnToPath: socialSsoState.returnToPath,
    };
  }
}
