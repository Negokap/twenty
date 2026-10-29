import { MockedProvider } from '@apollo/client/testing/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { ThemeProvider } from 'twenty-ui/theme';

import { SignInUpGlobalScopeForm } from '@/auth/sign-in-up/components/SignInUpGlobalScopeForm';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { authProvidersState } from '@/client-config/states/authProvidersState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const buildWorkspaceUrlMock = jest.fn();
const signOutMock = jest.fn();
const createWorkspaceMock = jest.fn();
const handleResetPasswordMock = jest.fn();
const resetPasswordClickMock = jest.fn();
const signInWithSetjooMock = jest.fn();

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: signOutMock,
    signInWithSetjoo: signInWithSetjooMock,
  }),
}));

jest.mock('@/domain-manager/hooks/useBuildWorkspaceUrl', () => ({
  useBuildWorkspaceUrl: () => ({
    buildWorkspaceUrl: buildWorkspaceUrlMock,
  }),
}));

jest.mock('@/auth/sign-in-up/hooks/useSignUpInNewWorkspace', () => ({
  useSignUpInNewWorkspace: () => ({
    createWorkspace: createWorkspaceMock,
  }),
}));

jest.mock('@/auth/sign-in-up/hooks/useSignInUpForm', () => ({
  useSignInUpForm: () => ({
    form: {
      getValues: () => 'person@example.com',
    },
  }),
}));

jest.mock('@/auth/sign-in-up/hooks/useHandleResetPassword', () => ({
  useHandleResetPassword: () => ({
    handleResetPassword: handleResetPasswordMock,
  }),
}));

jest.mock(
  '@/auth/sign-in-up/components/internal/SignInUpWithCredentials',
  () => ({
    SignInUpWithCredentials: () => <div>credentials-form</div>,
  }),
);

jest.mock('@/auth/sign-in-up/components/internal/SignInUpWithGoogle', () => ({
  SignInUpWithGoogle: () => null,
}));

jest.mock(
  '@/auth/sign-in-up/components/internal/SignInUpWithMicrosoft',
  () => ({
    SignInUpWithMicrosoft: () => null,
  }),
);

dynamicActivate(SOURCE_LOCALE);

describe('SignInUpGlobalScopeForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJotaiStore();
    handleResetPasswordMock.mockReturnValue(resetPasswordClickMock);
  });

  it('renders forgot-password link on password step and triggers reset callback', () => {
    jotaiStore.set(signInUpStepState.atom, SignInUpStep.Password);
    jotaiStore.set(authProvidersState.atom, {
      google: false,
      magicLink: false,
      microsoft: false,
      password: true,
      setjoo: false,
      sso: [],
    });

    render(
      <MockedProvider mocks={[]}>
        <JotaiProvider store={jotaiStore}>
          <ThemeProvider colorScheme="light">
            <I18nProvider i18n={i18n}>
              <SignInUpGlobalScopeForm />
            </I18nProvider>
          </ThemeProvider>
        </JotaiProvider>
      </MockedProvider>,
    );

    const forgotPasswordLink = screen.getByText('Forgot your password?');

    expect(forgotPasswordLink).toBeInTheDocument();
    expect(handleResetPasswordMock).toHaveBeenCalledWith('person@example.com');

    fireEvent.click(forgotPasswordLink);

    expect(resetPasswordClickMock).toHaveBeenCalledTimes(1);
  });

  const renderInitStep = (setjoo: boolean) => {
    jotaiStore.set(signInUpStepState.atom, SignInUpStep.Init);
    jotaiStore.set(authProvidersState.atom, {
      google: false,
      magicLink: false,
      microsoft: false,
      password: true,
      setjoo,
      sso: [],
    });

    render(
      <MockedProvider mocks={[]}>
        <MemoryRouter>
          <JotaiProvider store={jotaiStore}>
            <ThemeProvider colorScheme="light">
              <I18nProvider i18n={i18n}>
                <SignInUpGlobalScopeForm />
              </I18nProvider>
            </ThemeProvider>
          </JotaiProvider>
        </MemoryRouter>
      </MockedProvider>,
    );
  };

  it('shows Sign in with Setjoo first and starts the Setjoo flow when enabled', () => {
    renderInitStep(true);

    const setjooButton = screen.getByRole('button', {
      name: 'Sign in with Setjoo',
    });

    expect(
      setjooButton.compareDocumentPosition(
        screen.getByText('credentials-form'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(setjooButton);

    expect(signInWithSetjooMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'list-available-workspaces' }),
    );
  });

  it('hides Sign in with Setjoo when disabled', () => {
    renderInitStep(false);

    expect(
      screen.queryByRole('button', { name: 'Sign in with Setjoo' }),
    ).not.toBeInTheDocument();
  });
});
