import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import {createPackOpener, MESSAGES} from '../core';
import type {
  PackOpenerEvent,
  PackOpenerInstance,
  PackOpenerOptions,
} from '../core';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PackOpenerHandle {
  autoSlice: () => void;
  reset: () => void;
  setEnabled: (value: boolean) => void;
}

export interface PackOpenerProps {
  options: PackOpenerOptions;
  className?: string;
  style?: CSSProperties;
  /** Fires once the scene has drawn the pack; `rect` is where it put it. */
  onReady?: (rect: Rect) => void;
  onInteractionStart?: () => void;
  /** Cut progress, 0..1 — the RN host turns these into haptic ticks. */
  onProgress?: (progress: number) => void;
  onCommitted?: () => void;
  /** The lid is off — the pack counts as opened from here. */
  onOpenComplete?: () => void;
  /** The whole ceremony has played out; `card` is where the card came to rest. */
  onRevealComplete?: (card?: Rect) => void;
  onReset?: () => void;
  onError?: (message: string) => void;
  /** Every event, raw — for hosts that would rather switch themselves. */
  onEvent?: (event: PackOpenerEvent) => void;
}

/**
 * The animation as a React component for the web. A thin shell: the engine is
 * `createPackOpener`, which any framework can call directly.
 */
const PackOpener = forwardRef<PackOpenerHandle, PackOpenerProps>(
  function PackOpenerCanvas(
    {
      options,
      className,
      style,
      onReady,
      onInteractionStart,
      onProgress,
      onCommitted,
      onOpenComplete,
      onRevealComplete,
      onReset,
      onError,
      onEvent,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<PackOpenerInstance | null>(null);

    // Callbacks live in a ref so a parent that re-renders with new closures
    // does not tear the scene down mid-animation
    const handlers = useRef({
      onReady,
      onInteractionStart,
      onProgress,
      onCommitted,
      onOpenComplete,
      onRevealComplete,
      onReset,
      onError,
      onEvent,
    });
    handlers.current = {
      onReady,
      onInteractionStart,
      onProgress,
      onCommitted,
      onOpenComplete,
      onRevealComplete,
      onReset,
      onError,
      onEvent,
    };

    const onSceneEvent = useCallback((event: PackOpenerEvent) => {
      const h = handlers.current;
      h.onEvent?.(event);
      switch (event.type) {
        case MESSAGES.READY:
          h.onReady?.(event.rect as Rect);
          break;
        case MESSAGES.INTERACTION_START:
          h.onInteractionStart?.();
          break;
        case MESSAGES.TICK:
          h.onProgress?.(Number(event.progress) || 0);
          break;
        case MESSAGES.COMMITTED:
          h.onCommitted?.();
          break;
        case MESSAGES.OPENED:
          h.onOpenComplete?.();
          break;
        case MESSAGES.REVEALED:
          h.onRevealComplete?.(event.card as Rect | undefined);
          break;
        case MESSAGES.RETRACTED:
          h.onReset?.();
          break;
        case MESSAGES.ERROR:
          h.onError?.(String(event.message ?? 'scene error'));
          break;
        default:
          break;
      }
    }, []);

    // Compared by value: an options object rebuilt on every render must not
    // remount the scene
    const optionsKey = JSON.stringify(options);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return undefined;
      }
      let cancelled = false;

      createPackOpener(host, JSON.parse(optionsKey), {onEvent: onSceneEvent})
        .then(instance => {
          if (cancelled) {
            instance.destroy();
            return;
          }
          instanceRef.current = instance;
        })
        .catch(error => {
          if (!cancelled) {
            handlers.current.onError?.(String(error?.message || error));
          }
        });

      return () => {
        cancelled = true;
        instanceRef.current?.destroy();
        instanceRef.current = null;
      };
    }, [optionsKey, onSceneEvent]);

    useImperativeHandle(
      ref,
      () => ({
        autoSlice: () => instanceRef.current?.autoSlice(),
        reset: () => instanceRef.current?.reset(),
        setEnabled: (value: boolean) => instanceRef.current?.setEnabled(value),
      }),
      [],
    );

    const rootStyle = useMemo<CSSProperties>(
      () => ({position: 'relative', width: '100%', height: '100%', ...style}),
      [style],
    );

    return <div ref={hostRef} className={className} style={rootStyle} />;
  },
);

export default PackOpener;
export type {PackOpenerOptions, PackOpenerEvent} from '../core';
