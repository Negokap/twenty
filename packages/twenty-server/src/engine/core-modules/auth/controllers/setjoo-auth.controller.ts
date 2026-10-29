import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Request, type Response } from 'express';
import { type CallbackParamsType } from 'openid-client';
import { ApiPath, AppPath } from 'twenty-shared/types';

import { AuthOAuthExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-oauth-exception.filter';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { SetjooProviderEnabledGuard } from 'src/engine/core-modules/auth/guards/setjoo-provider-enabled.guard';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { SetjooAuthService } from 'src/engine/core-modules/auth/services/setjoo-auth.service';
import { type SocialSsoState } from 'src/engine/core-modules/auth/types/social-sso-state.type';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { readCookieValue } from 'src/engine/core-modules/user-session/utils/extract-user-session-token-from-request.util';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

const SETJOO_AUTH_STATE_COOKIE_NAME = 'setjooAuthState';
const SETJOO_CALLBACK_PATH = `/${ApiPath.OAuth}/callback`;

// The callback path is fixed by Setjoo Identity, which only accepts <origin>/oauth/callback
@Controller()
@UseFilters(AuthRestApiExceptionFilter)
export class SetjooAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly setjooAuthService: SetjooAuthService,
    private readonly guardRedirectService: GuardRedirectService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  @Get(`${ApiPath.Auth}/setjoo`)
  @UseGuards(SetjooProviderEnabledGuard, PublicEndpointGuard, NoPermissionGuard)
  async setjooAuth(@Query() query: SocialSsoState, @Res() res: Response) {
    try {
      const { authorizationUrl, state } =
        await this.setjooAuthService.startSignIn({
          workspaceInviteHash: query.workspaceInviteHash,
          workspaceId: query.workspaceId,
          billingCheckoutSessionState: query.billingCheckoutSessionState,
          action: query.action,
          locale: query.locale,
          returnToPath: query.returnToPath,
        });

      res.cookie(SETJOO_AUTH_STATE_COOKIE_NAME, state, {
        httpOnly: true,
        secure: this.twentyConfigService
          .get('AUTH_SETJOO_CALLBACK_URL')
          .startsWith('https://'),
        // Lax so the cookie survives the top-level redirect back from Setjoo
        sameSite: 'lax',
        path: SETJOO_CALLBACK_PATH,
        maxAge: 10 * 60 * 1000,
      });

      return res.redirect(authorizationUrl);
    } catch (error) {
      return res.redirect(this.getErrorRedirectUrl(error));
    }
  }

  @Get(SETJOO_CALLBACK_PATH)
  @UseGuards(SetjooProviderEnabledGuard, PublicEndpointGuard, NoPermissionGuard)
  @UseFilters(AuthOAuthExceptionFilter)
  async setjooAuthCallback(
    @Query() callbackParameters: CallbackParamsType,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookieHeader = req.headers.cookie;

    res.clearCookie(SETJOO_AUTH_STATE_COOKIE_NAME, {
      path: SETJOO_CALLBACK_PATH,
    });

    let user;

    try {
      user = await this.setjooAuthService.finishSignIn({
        callbackParameters,
        stateFromCookie: isNonEmptyString(cookieHeader)
          ? readCookieValue(cookieHeader, SETJOO_AUTH_STATE_COOKIE_NAME)
          : undefined,
      });
    } catch (error) {
      return res.redirect(this.getErrorRedirectUrl(error));
    }

    return res.redirect(
      await this.authService.signInUpWithSocialSso(
        user,
        AuthProviderEnum.Setjoo,
      ),
    );
  }

  private getErrorRedirectUrl(error: unknown) {
    return this.guardRedirectService.getRedirectErrorUrlAndCaptureExceptions({
      error: error instanceof Error ? error : new Error(String(error)),
      workspace:
        this.workspaceDomainsService.getSubdomainAndCustomDomainFromWorkspaceFallbackOnDefaultSubdomain(),
      pathname: AppPath.Verify,
    });
  }
}
