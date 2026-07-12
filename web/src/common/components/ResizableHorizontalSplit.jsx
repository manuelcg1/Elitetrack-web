import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const DIVIDER_HEIGHT = 8;

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

const readStoredHeight = (storageKey, defaultHeight) => {
  if (!storageKey) {
    return defaultHeight;
  }
  try {
    const storedValue = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : defaultHeight;
  } catch {
    return defaultHeight;
  }
};

const storeHeight = (storageKey, height) => {
  if (!storageKey) {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, String(Math.round(height)));
  } catch {
    // El divisor sigue funcionando cuando el almacenamiento esta deshabilitado.
  }
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  },
  top: {
    flex: '0 0 auto',
    minHeight: 0,
    overflow: 'hidden',
    '& > *': {
      height: '100%',
    },
  },
  bottom: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    '& > *': {
      height: '100%',
    },
  },
  divider: {
    alignItems: 'center',
    backgroundColor: theme.palette.divider,
    cursor: 'row-resize',
    display: 'flex',
    flex: `0 0 ${DIVIDER_HEIGHT}px`,
    justifyContent: 'center',
    outline: 0,
    position: 'relative',
    touchAction: 'none',
    transition: theme.transitions.create(['background-color', 'box-shadow'], {
      duration: theme.transitions.duration.shortest,
    }),
    zIndex: 2,
    '&::before': {
      backgroundColor: theme.palette.text.disabled,
      borderRadius: 4,
      content: '""',
      height: 3,
      transition: theme.transitions.create(['background-color', 'height', 'width']),
      width: 44,
    },
    '&:hover, &:focus-visible, &[data-dragging="true"]': {
      backgroundColor: theme.palette.action.hover,
      boxShadow: `0 0 10px ${theme.palette.primary.main}55`,
      '&::before': {
        backgroundColor: theme.palette.primary.main,
        height: 5,
        width: 56,
      },
    },
  },
}));

const ResizableHorizontalSplit = ({
  top,
  bottom,
  defaultHeight = 360,
  minTop = 220,
  minBottom = 180,
  storageKey,
  onResizeEnd,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const enabled = useMediaQuery(theme.breakpoints.up('sm'));
  const rootRef = useRef(null);
  const heightRef = useRef(readStoredHeight(storageKey, defaultHeight));
  const dragRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [topHeight, setTopHeight] = useState(heightRef.current);
  const [dragging, setDragging] = useState(false);

  const getBounds = useCallback(() => {
    const totalHeight = rootRef.current?.getBoundingClientRect().height || 0;
    return {
      minimum: minTop,
      maximum: Math.max(minTop, totalHeight - minBottom - DIVIDER_HEIGHT),
    };
  }, [minBottom, minTop]);

  const updateHeight = useCallback((height) => {
    heightRef.current = height;
    setTopHeight(height);
  }, []);

  useEffect(() => {
    if (!enabled || !top || !rootRef.current) {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      const { minimum, maximum } = getBounds();
      const nextHeight = clamp(heightRef.current, minimum, maximum);
      if (nextHeight !== heightRef.current) {
        updateHeight(nextHeight);
      }
    });
    resizeObserver.observe(rootRef.current);
    return () => resizeObserver.disconnect();
  }, [enabled, getBounds, top, updateHeight]);

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  const finishResize = useCallback(() => {
    if (!dragRef.current) {
      return;
    }
    dragRef.current = null;
    setDragging(false);
    storeHeight(storageKey, heightRef.current);
    onResizeEnd?.(heightRef.current);
  }, [onResizeEnd, storageKey]);

  useEffect(() => {
    if (!dragging) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      if (!dragRef.current) {
        return;
      }
      const { minimum, maximum } = getBounds();
      const nextHeight = clamp(
        dragRef.current.startHeight + event.clientY - dragRef.current.startY,
        minimum,
        maximum,
      );
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(() => updateHeight(nextHeight));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };
  }, [dragging, finishResize, getBounds, updateHeight]);

  const handlePointerDown = (event) => {
    event.preventDefault();
    dragRef.current = {
      startY: event.clientY,
      startHeight: heightRef.current,
    };
    setDragging(true);
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const { minimum, maximum } = getBounds();
    const direction = event.key === 'ArrowUp' ? -1 : 1;
    const nextHeight = clamp(heightRef.current + direction * 16, minimum, maximum);
    updateHeight(nextHeight);
    storeHeight(storageKey, nextHeight);
    onResizeEnd?.(nextHeight);
  };

  if (!enabled || !top) {
    return (
      <>
        {top}
        {bottom}
      </>
    );
  }

  return (
    <div className={classes.root} ref={rootRef}>
      <div className={classes.top} style={{ height: topHeight }}>
        {top}
      </div>
      <div
        aria-label="Redimensionar mapa y tabla"
        aria-orientation="horizontal"
        aria-valuemax={Math.round(getBounds().maximum)}
        aria-valuemin={minTop}
        aria-valuenow={Math.round(topHeight)}
        className={classes.divider}
        data-dragging={dragging}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        role="separator"
        tabIndex={0}
      />
      <div className={classes.bottom}>{bottom}</div>
    </div>
  );
};

export default ResizableHorizontalSplit;
