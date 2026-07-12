import { useCallback } from 'react';
import ResizableHorizontalSplit from '../../common/components/ResizableHorizontalSplit';
import { map } from '../../map/core/MapView';

const ReportMapSplit = ({ mapPanel, contentPanel, storageKey }) => {
  const handleResizeEnd = useCallback(() => {
    window.requestAnimationFrame(() => map.resize());
  }, []);

  return (
    <ResizableHorizontalSplit
      top={mapPanel}
      bottom={contentPanel}
      defaultHeight={360}
      minTop={220}
      minBottom={180}
      storageKey={storageKey}
      onResizeEnd={handleResizeEnd}
    />
  );
};

export default ReportMapSplit;
