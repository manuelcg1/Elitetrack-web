import { useCallback, useEffect } from 'react';
import ResizableHorizontalSplit from '../../common/components/ResizableHorizontalSplit';
import { map } from '../../map/core/MapView';

const ReportMapSplit = ({ mapPanel, contentPanel, storageKey }) => {
  const mapVisible = Boolean(mapPanel);
  const handleResizeEnd = useCallback(() => {
    window.requestAnimationFrame(() => map.resize());
  }, []);

  useEffect(() => {
    if (!mapVisible) {
      return undefined;
    }
    const animationFrame = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(animationFrame);
  }, [mapVisible]);

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
