import { render, screen } from '@testing-library/react';

import {
  StudioWorkbenchProvider,
  useStudioWorkbenchSession,
  useStudioWorkbenchSessionOptional,
} from '@/features/studio/context/studio-workbench-context';

function SessionReader() {
  const { activeSessionId } = useStudioWorkbenchSession();
  return <span data-testid="session">{activeSessionId ?? 'none'}</span>;
}

function OptionalReader() {
  const ctx = useStudioWorkbenchSessionOptional();
  return <span data-testid="optional">{ctx?.activeSessionId ?? 'none'}</span>;
}

describe('StudioWorkbenchContext', () => {
  it('provides session id to children', () => {
    render(
      <StudioWorkbenchProvider value={{ activeSessionId: 'sess-1', setActiveSessionId: jest.fn() }}>
        <SessionReader />
      </StudioWorkbenchProvider>,
    );
    expect(screen.getByTestId('session')).toHaveTextContent('sess-1');
  });

  it('throws outside provider for required hook', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SessionReader />)).toThrow(
      'useStudioWorkbenchSession must be used within StudioWorkbenchProvider',
    );
    spy.mockRestore();
  });

  it('optional hook returns null outside provider', () => {
    render(<OptionalReader />);
    expect(screen.getByTestId('optional')).toHaveTextContent('none');
  });
});
