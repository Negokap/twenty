import { useAuth } from '@/auth/hooks/useAuth';
import { useHasMultipleAuthMethods } from '@/auth/sign-in-up/hooks/useHasMultipleAuthMethods';
import { billingCheckoutSessionState } from '@/auth/states/billingCheckoutSessionState';
import { lastAuthenticatedMethodState } from '@/auth/states/lastAuthenticatedMethodState';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { AuthenticatedMethod } from '@/auth/types/AuthenticatedMethod';
import { type SocialSsoSignInUpActionType } from '@/auth/types/SocialSsoSignInUpActionType';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { SETJOO_AUTO_SSO_DISABLED_KEY } from '@/auth/sign-in-up/constants/SetjooAutoSsoDisabledKey';
import { useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MainButton } from 'twenty-ui/components/input';
import { IconLock } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme';
import { LastUsedPill } from './LastUsedPill';
import { SignInUpSeparator } from './SignInUpSeparator';
import { StyledSsoButtonContainer } from './SignInUpSsoButtonStyles';

export const SignInUpWithSetjoo = ({
  action,
  isGlobalScope,
}: {
  action: SocialSsoSignInUpActionType;
  isGlobalScope?: boolean;
}) => {
  const theme = useTheme();
  const { t } = useLingui();
  const workspaceInviteHash = useParams().workspaceInviteHash;
  const [searchParams] = useSearchParams();
  const billingCheckoutSession = useAtomStateValue(billingCheckoutSessionState);
  const signInUpStep = useAtomStateValue(signInUpStepState);
  const [lastAuthenticatedMethod, setLastAuthenticatedMethod] = useAtomState(
    lastAuthenticatedMethodState,
  );
  const { signInWithSetjoo } = useAuth();
  const hasMultipleAuthMethods = useHasMultipleAuthMethods();

  const handleClick = () => {
    setLastAuthenticatedMethod(AuthenticatedMethod.SETJOO);
    signInWithSetjoo({
      workspaceInviteHash,
      workspacePersonalInviteToken:
        searchParams.get('inviteToken') ?? undefined,
      billingCheckoutSession,
      action,
    });
  };

  // Start SSO immediately, once per tab, unless an error, sign-out, invite or ?local=1 says otherwise.
  useEffect(() => {
    if (
      searchParams.has('local') ||
      searchParams.has('errorMessage') ||
      searchParams.has('error') ||
      searchParams.has('inviteToken') ||
      workspaceInviteHash !== undefined ||
      sessionStorage.getItem(SETJOO_AUTO_SSO_DISABLED_KEY) !== null
    ) {
      return;
    }
    sessionStorage.setItem(SETJOO_AUTO_SSO_DISABLED_KEY, '1');
    handleClick();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLastUsed = lastAuthenticatedMethod === AuthenticatedMethod.SETJOO;

  return (
    <>
      <StyledSsoButtonContainer>
        <MainButton
          startIcon={<IconLock size={theme.icon.size.md} />}
          onClick={handleClick}
          fullWidth
          variant={signInUpStep === SignInUpStep.Init ? 'solid' : 'outline'}
        >{t`Sign in with Setjoo`}</MainButton>
        {isLastUsed && (isGlobalScope || hasMultipleAuthMethods) && (
          <LastUsedPill />
        )}
      </StyledSsoButtonContainer>
      <SignInUpSeparator />
    </>
  );
};
