import { render, screen } from '@testing-library/react';

import { FileIcon, getFileIconLabel } from '@/features/studio/components/file-icon';

describe('FileIcon', () => {
  it('renders folder icon for directories', () => {
    const { container } = render(<FileIcon path="src" isDirectory />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders open folder when isOpen', () => {
    const { container } = render(<FileIcon path="src" isDirectory isOpen />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders file icon for typescript paths', () => {
    const { container } = render(<FileIcon path="src/app.tsx" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('getFileIconLabel', () => {
  it('returns extension label', () => {
    expect(getFileIconLabel('src/app.tsx')).toBe('tsx');
    expect(getFileIconLabel('bundle.')).toBe('file');
  });
});
