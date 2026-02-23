import { Separator } from 'react-resizable-panels';

interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
}

export function ResizeHandle({ direction = 'horizontal' }: ResizeHandleProps) {
  const isVertical = direction === 'vertical';

  return (
    <Separator
      style={{
        width: isVertical ? '100%' : 1,
        height: isVertical ? 1 : '100%',
        background: 'var(--mantine-color-dark-5)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: isVertical ? -2 : 0,
          left: isVertical ? 0 : -2,
          right: isVertical ? 0 : -2,
          bottom: isVertical ? -2 : 0,
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.parentElement as HTMLElement).style.background =
            'var(--mantine-color-blue-6)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.parentElement as HTMLElement).style.background =
            'var(--mantine-color-dark-5)';
        }}
      />
    </Separator>
  );
}
