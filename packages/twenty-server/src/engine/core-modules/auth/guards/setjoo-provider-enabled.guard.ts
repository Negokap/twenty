import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { GuardRedirectService } from 'src/engine/core-modules/guard-redirect/services/guard-redirect.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class SetjooProviderEnabledGuard implements CanActivate {
  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly guardRedirectService: GuardRedirectService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.twentyConfigService.get('AUTH_SETJOO_ENABLED')) {
      return true;
    }

    this.guardRedirectService.dispatchErrorFromGuard(
      context,
      new AuthException(
        'Setjoo auth is not enabled',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      ),
      this.guardRedirectService.getSubdomainAndCustomDomainFromContext(context),
    );

    return false;
  }
}
