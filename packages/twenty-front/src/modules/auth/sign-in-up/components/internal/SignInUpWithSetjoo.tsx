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
import { useLingui } from '@lingui/react/macro';
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
