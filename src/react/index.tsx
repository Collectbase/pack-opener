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
  ClimbCard,
  PackOpenerEvent,
  PackOpenerInstance,
  PackOpenerOptions,
  PackOpenerTimeline,
} from '../core';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * The running scene's controls. The climb's — `start`, `setCards`,
 * `setSpeed`, `skipToEnd`, `markSold` — wait for the scene when it is not up yet (it
 * mounts asynchronously) and run in order once it is; `reset()` before then
 * drops them. Once no scene is coming — the component unmounted, or its
 * scene failed to mount (`onError`) — they are dropped as they are sent,
 * until it mounts again. See `PackOpenerInstance` for what each does.
 */
export interface PackOpenerHandle {
  autoSlice: () => void;
  /** Mix the choice up — the carousel's ring spins on; a no-op for the other mechanics. */
  shuffle: () => void;
  /** `climb`: the items fly in and spin until the cards come. Once per batch, before `setCards`. */
  start: () => void;
  /**
   * `climb`: the cards the items turn into, in grid order, and the combo to
   * write under the grid. Resolves once they are handed over, or once they
   * are dropped (a reset, an unmount, a failed mount) — never rejects.
   */
  setCards: (cards: ClimbCard[], extras?: {combo?: string | null}) => Promise<void>;
  /** `climb`: how fast it plays from now on, as a multiple of its pace (Speed up's 1–4). */
  setSpeed: (multiplier: number) => void;
  /** `climb`: every card up at once, with its price and the combo. */
  skipToEnd: () => void;
  /** `climb`: cards of the batch on show sold since they came, by their index — they go dark, `SOLD` under them. */
  markSold: (indices: number[]) => void;
  /** `climb`: a blow to the stage, `strength` 0..1 — for a sum reaching the balance. Dropped when no scene is up. */
  shake: (strength?: number) => void;
  cue: (name: string) => void;
  /** Back to the untouched state — for the climb, the empty grid. */
  reset: () => void;
  setEnabled: (value: boolean) => void;
}

export interface PackOpenerProps {
  options: PackOpenerOptions;
  className?: string;
  style?: CSSProperties;
  /**
   * Fires once the scene has drawn the pack, and again whenever the pack moves
   * — a resized window, a rotated phone. `rect` is where it is now.
   */
  onReady?: (rect: Rect) => void;
  onInteractionStart?: () => void;
  /** Cut progress, 0..1 — the RN host turns these into haptic ticks. */
  onProgress?: (progress: number) => void;
  onCommitted?: () => void;
  /** The lid is off — the pack counts as opened from here. */
  onOpenComplete?: () => void;
  /** The whole ceremony has played out; `card` is where the card came to rest. */
  onRevealComplete?: (card?: Rect) => void;
  /** The cut was let go of before it finished — the pack is untouched again. */
  onInteractionCancel?: () => void;
  onError?: (message: string) => void;
  /**
   * A phase of the ceremony has begun — the scene's own name for it and how
   * long it will run, see `MESSAGES.PHASE`. For scoring the ceremony with sound.
   */
  onPhase?: (name: string, durationMs: number) => void;
  /**
   * New `options` could not be applied on the spot: the scene is mid-ceremony
   * or holding a revealed card, and the change waits for `reset()`. An editor
   * that wants every change seen at once resets here.
   */
  onOptionsDeferred?: () => void;
  /** How long each phase will run — with `ready` and after every retune, see `MESSAGES.TIMELINE`. */
  onTimeline?: (timeline: PackOpenerTimeline) => void;
  /** `climb`: item `index` has come to rest on its card's colour, in grid order. */
  onCardSettled?: (index: number) => void;
  /** `climb`: card `index` is face up; `card` is where it is. */
  onCardRevealed?: (index: number, card: Rect) => void;
  /** `climb`: the hits have come round together, under the flash. */
  onHitsRevealed?: () => void;
  /**
   * `climb`: every card is up with its price — once per ceremony; `cards` are
   * where they are, in grid order, none after `setCards([])`.
   */
  onAllRevealed?: (cards: Rect[]) => void;
  /** `climb`: card `index` was tapped, once every card was up. */
  onCardTap?: (index: number) => void;
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
      onInteractionCancel,
      onError,
      onPhase,
      onOptionsDeferred,
      onTimeline,
      onCardSettled,
      onCardRevealed,
      onHitsRevealed,
      onAllRevealed,
      onCardTap,
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
      onInteractionCancel,
      onError,
      onPhase,
      onOptionsDeferred,
      onTimeline,
      onCardSettled,
      onCardRevealed,
      onHitsRevealed,
      onAllRevealed,
      onCardTap,
      onEvent,
    });
    handlers.current = {
      onReady,
      onInteractionStart,
      onProgress,
      onCommitted,
      onOpenComplete,
      onRevealComplete,
      onInteractionCancel,
      onError,
      onPhase,
      onOptionsDeferred,
      onTimeline,
      onCardSettled,
      onCardRevealed,
      onHitsRevealed,
      onAllRevealed,
      onCardTap,
      onEvent,
    };

    // The climb's commands sent before the scene is up: a host may start the
    // ceremony the moment it mounts this. Each runs in order once the scene
    // is up, or is dropped — its promise settled — by a reset or the end
    const queued = useRef<{run: (instance: PackOpenerInstance) => void; drop: () => void}[]>([]);
    // No scene is coming — unmounted, or the mount failed: a command is
    // dropped as it is sent rather than left waiting, until a mount begins
    const noScene = useRef(false);
    const whenUp = useCallback(
      (run: (instance: PackOpenerInstance) => void, drop: () => void = () => {}) => {
        const instance = instanceRef.current;
        if (instance) run(instance);
        else if (noScene.current) drop();
        else queued.current.push({run, drop});
      },
      [],
    );
    const dropQueued = useCallback(() => {
      const waiting = queued.current;
      queued.current = [];
      for (const command of waiting) command.drop();
    }, []);
    // In order; one that throws is settled and its error thrown again on its
    // own, so the commands after it still run
    const runQueued = useCallback((instance: PackOpenerInstance) => {
      const waiting = queued.current;
      queued.current = [];
      for (const command of waiting) {
        try {
          command.run(instance);
        } catch (error) {
          command.drop();
          setTimeout(() => {
            throw error;
          });
        }
      }
    }, []);
    useEffect(
      () => () => {
        noScene.current = true;
        dropQueued();
      },
      [dropQueued],
    );

    const onSceneEvent = useCallback((event: PackOpenerEvent) => {
      const h = handlers.current;
      h.onEvent?.(event);
      switch (event.type) {
        case MESSAGES.READY:
        case MESSAGES.LAYOUT:
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
          h.onInteractionCancel?.();
          break;
        case MESSAGES.ERROR:
          h.onError?.(String(event.message ?? 'scene error'));
          break;
        case MESSAGES.PHASE:
          h.onPhase?.(String(event.name), Number(event.durationMs) || 0);
          break;
        case MESSAGES.TIMELINE: {
          const {type: _type, ...timeline} = event;
          h.onTimeline?.(timeline as PackOpenerTimeline);
          break;
        }
        case MESSAGES.CARD_SETTLED:
          h.onCardSettled?.(Number(event.index));
          break;
        case MESSAGES.CARD_REVEALED:
          h.onCardRevealed?.(Number(event.index), event.card as Rect);
          break;
        case MESSAGES.HITS_REVEALED:
          h.onHitsRevealed?.();
          break;
        case MESSAGES.ALL_REVEALED:
          h.onAllRevealed?.((event.cards as Rect[] | undefined) ?? []);
          break;
        case MESSAGES.CARD_TAP:
          h.onCardTap?.(Number(event.index));
          break;
        default:
          break;
      }
    }, []);

    // Compared by value: an options object rebuilt on every render must not
    // remount the scene
    const optionsKey = JSON.stringify(options);
    // Only a different mechanic or different pack artwork needs a new scene;
    // every other option is applied to the running one
    const bootKey = `${options.variant ?? ''}|${options.assets?.pack?.url ?? ''}`;
    const latestOptions = useRef(options);
    latestOptions.current = options;

    useEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return undefined;
      }
      let cancelled = false;
      const bootOptions = latestOptions.current;
      noScene.current = false;

      createPackOpener(host, bootOptions, {onEvent: onSceneEvent})
        .then(instance => {
          if (cancelled) {
            instance.destroy();
            return;
          }
          instanceRef.current = instance;
          // Options that changed while the scene was coming up — a band the
          // host measured, a stand it fetched — reached no instance; they are
          // applied now rather than lost until the next change
          const latest = latestOptions.current;
          if (latest !== bootOptions && JSON.stringify(latest) !== JSON.stringify(bootOptions)) {
            if (instance.setOptions(latest) === 'deferred') {
              handlers.current.onOptionsDeferred?.();
            }
          }
          runQueued(instance);
        })
        .catch(error => {
          if (!cancelled) {
            noScene.current = true;
            dropQueued();
            handlers.current.onError?.(String(error?.message || error));
          }
        });

      return () => {
        cancelled = true;
        instanceRef.current?.destroy();
        instanceRef.current = null;
      };
      // `latestOptions` is deliberately not a dependency: the scene is mounted
      // from whatever the options are at that moment, and later changes go
      // through the effect below instead of remounting
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bootKey, onSceneEvent, dropQueued, runQueued]);

    // Retune the running scene. `scene` means the change needs a fresh one,
    // which the mount effect above is already doing; `deferred` is the host's
    // to act on
    useEffect(() => {
      const result = instanceRef.current?.setOptions(JSON.parse(optionsKey));
      if (result === 'deferred') handlers.current.onOptionsDeferred?.();
    }, [optionsKey]);

    useImperativeHandle(
      ref,
      () => ({
        autoSlice: () => instanceRef.current?.autoSlice(),
        shuffle: () => instanceRef.current?.shuffle(),
        start: () => whenUp(instance => instance.start()),
        setCards: (cards: ClimbCard[], extras?: {combo?: string | null}) =>
          new Promise<void>(resolve => {
            whenUp(
              instance => {
                instance.setCards(cards, extras).then(
                  () => resolve(),
                  () => resolve(),
                );
              },
              () => resolve(),
            );
          }),
        setSpeed: (multiplier: number) => whenUp(instance => instance.setSpeed(multiplier)),
        skipToEnd: () => whenUp(instance => instance.skipToEnd()),
        markSold: (indices: number[]) => whenUp(instance => instance.markSold(indices)),
        // Of the moment: a blow that waited for a scene would land on another one
        shake: (strength?: number) => instanceRef.current?.shake(strength),
        cue: (name: string) => instanceRef.current?.cue(name),
        // A scene not up yet is at its start already: what waited for it is dropped
        reset: () => {
          if (instanceRef.current) instanceRef.current.reset();
          else dropQueued();
        },
        setEnabled: (value: boolean) => instanceRef.current?.setEnabled(value),
      }),
      [whenUp, dropQueued],
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
