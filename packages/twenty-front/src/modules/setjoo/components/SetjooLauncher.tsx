import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { themeCssVariables } from 'twenty-ui/theme';

import registry from '@/setjoo/constants/setjoo-applications.json';

// Mirrors Setjoo Core's NetworkLauncher. The JSON is overwritten at build time
// from https://auth.setjoo.com/api/v1/applications; the checked-in copy is the fallback.
const CURRENT_APP_SLUG = 'crm';
const GROUPS = [
  { id: 'operating', label: 'Operating' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'intelligence', label: 'Intelligence' },
];

type SetjooApplication = {
  id: string;
  slug: string;
  name: string;
  publicHost: string;
  status: string;
  group: string;
};

const applications: SetjooApplication[] = registry.applications;

const getLabel = (name: string) => name.replace(/^Setjoo\s+/, '');

const StyledRoot = styled.div`
  position: relative;
`;

const StyledTrigger = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  height: 24px;
  justify-content: center;
  padding: 0;
  width: 24px;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledPanel = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  color: ${themeCssVariables.font.color.primary};
  max-width: calc(100vw - 16px);
  overflow: hidden;
  position: fixed;
  width: 352px;
  z-index: 1000;
`;

const StyledScroll = styled.div`
  max-height: min(80vh, 576px);
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledHeading = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.16em;
  margin: ${themeCssVariables.spacing[3]} 0 ${themeCssVariables.spacing[1]};
  text-transform: uppercase;
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[1]};
  grid-template-columns: repeat(3, 1fr);
`;

const StyledTile = styled.a<{ isCurrent: boolean; isReady: boolean }>`
  align-items: center;
  background: ${({ isCurrent }) =>
    isCurrent ? themeCssVariables.background.transparent.light : 'transparent'};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${({ isCurrent }) =>
    isCurrent ? `0 0 0 1px ${themeCssVariables.font.color.primary}` : 'none'};
  color: inherit;
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
  opacity: ${({ isReady }) => (isReady ? 1 : 0.7)};
  padding: ${themeCssVariables.spacing[2]};
  text-align: center;
  text-decoration: none;

  &:hover {
    background: ${({ isReady }) =>
      isReady ? themeCssVariables.background.transparent.light : 'transparent'};
  }
`;

const StyledMark = styled.span<{ isReady: boolean }>`
  align-items: center;
  background: ${({ isReady }) =>
    isReady
      ? themeCssVariables.accent.accent9
      : themeCssVariables.background.transparent.medium};
  border-radius: 50%;
  color: ${({ isReady }) =>
    isReady
      ? themeCssVariables.font.color.inverted
      : themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  height: 36px;
  justify-content: center;
  width: 36px;
`;

const StyledComing = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};

  a {
    color: inherit;
  }

  a:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

export const SetjooLauncher = () => {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isOpen = position !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setPosition(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPosition(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (isOpen) {
      setPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    setPosition({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 360)),
    });
  };

  return (
    <StyledRoot ref={rootRef}>
      <StyledTrigger
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t`Setjoo apps`}
        onClick={handleToggle}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          {[2, 8, 14].flatMap((cx) =>
            [2, 8, 14].map((cy) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" />
            )),
          )}
        </svg>
      </StyledTrigger>
      {isOpen && (
        <StyledPanel
          role="dialog"
          aria-label={t`Setjoo apps`}
          style={{ top: position.top, left: position.left }}
        >
          <StyledScroll>
            <StyledHeading style={{ marginTop: 0 }}>
              {t`Setjoo network`}
            </StyledHeading>
            {GROUPS.map((group) => (
              <section key={group.id}>
                <StyledHeading>{group.label}</StyledHeading>
                <StyledGrid>
                  {applications
                    .filter((application) => application.group === group.id)
                    .map((application) => {
                      const isCurrent = application.slug === CURRENT_APP_SLUG;
                      const isReady =
                        isCurrent || application.status === 'available';
                      const label = getLabel(application.name);

                      return (
                        <StyledTile
                          key={application.id}
                          isCurrent={isCurrent}
                          isReady={isReady}
                          // The registry's href/origin are local dev addresses.
                          href={
                            isReady
                              ? isCurrent
                                ? '/'
                                : `https://${application.publicHost}/`
                              : undefined
                          }
                          aria-current={isCurrent ? 'page' : undefined}
                          aria-disabled={isReady ? undefined : true}
                          onClick={() => setPosition(null)}
                        >
                          <StyledMark isReady={isReady}>
                            {label.slice(0, 2).toUpperCase()}
                          </StyledMark>
                          <span>{label}</span>
                          {!isReady && <StyledComing>{t`Coming`}</StyledComing>}
                        </StyledTile>
                      );
                    })}
                </StyledGrid>
              </section>
            ))}
          </StyledScroll>
          <StyledFooter>
            <a href="https://auth.setjoo.com/">{t`Setjoo account`}</a>
            <a href="https://business.setjoo.com/">{t`Business`}</a>
          </StyledFooter>
        </StyledPanel>
      )}
    </StyledRoot>
  );
};
