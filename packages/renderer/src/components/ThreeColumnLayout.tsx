import { Group, Panel } from 'react-resizable-panels';
import { ResizeHandle } from './ResizeHandle';

interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode | null;
  showLeft: boolean;
  showRight: boolean;
}

export function ThreeColumnLayout({ left, center, right, showLeft, showRight }: ThreeColumnLayoutProps) {
  return (
    <Group orientation="horizontal" style={{ height: '100%' }}>
      {showLeft && (
        <>
          <Panel
            id="left"
            defaultSize="15%"
            minSize="12%"
            maxSize="25%"
            collapsible
          >
            {left}
          </Panel>
          <ResizeHandle />
        </>
      )}

      <Panel id="center" minSize="25%">
        {center}
      </Panel>

      {showRight && right && (
        <>
          <ResizeHandle />
          <Panel
            id="right"
            defaultSize="30%"
            minSize="18%"
            maxSize="50%"
            collapsible
          >
            {right}
          </Panel>
        </>
      )}
    </Group>
  );
}
