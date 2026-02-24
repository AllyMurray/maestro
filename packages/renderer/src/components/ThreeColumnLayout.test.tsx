import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../__test-utils__/render';
import { ThreeColumnLayout } from './ThreeColumnLayout';

describe('ThreeColumnLayout', () => {
  it('renders all three panels when enabled', () => {
    renderWithProviders(
      <ThreeColumnLayout
        left={<div>Left</div>}
        center={<div>Center</div>}
        right={<div>Right</div>}
        showLeft
        showRight
      />,
    );

    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders center-only layout when side panels disabled', () => {
    renderWithProviders(
      <ThreeColumnLayout
        left={<div>Left</div>}
        center={<div>Center</div>}
        right={null}
        showLeft={false}
        showRight={false}
      />,
    );

    expect(screen.getByText('Center')).toBeInTheDocument();
    expect(screen.queryByText('Left')).not.toBeInTheDocument();
    expect(screen.queryByText('Right')).not.toBeInTheDocument();
  });
});
