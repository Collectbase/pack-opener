import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {Dimensions, Image, StyleSheet, View} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {WebView, type WebViewMessageEvent} from 'react-native-webview';
import buildSceneHtml from './html';
import {COMMANDS, MESSAGES} from '../core/config/protocol';
import type {PackOpenerOptions} from '../core/config/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Gap between the hint and the top edge of the pack
const HINT_GAP = 92;

// Breathing room between the revealed card and the UI that settles around it
const SLOT_GAP = 20;

/** Where the scene drew something, in css px from the top-left of the stage. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** What the scene asks the host to feel, mapped to its own haptics library. */
export type HapticIntent = 'light' | 'heavy' | 'success';

export interface PackOpenerHandle {
  /** Cut the pack without a gesture — for a "tap to open" fallback. */
  autoSlice: () => void;
  /** Put the pack back together and rearm the swipe. */
  reset: () => void;
}

export interface PackOpenerProps {
  /** Assets, theme, motion, interaction — see PackOpenerOptions. */
  options: PackOpenerOptions;
  /** Blocks the gesture without unmounting the scene. */
  disabled?: boolean;
  /** Caption above the pack. Rendered by the host, positioned by the scene. */
  hint?: ReactNode;
  /** Ride on the revealed card: above it and directly below it. */
  topSlot?: ReactNode;
  bottomSlot?: ReactNode;
  /** Shown when the scene cannot start at all (no WebGL, texture failed). */
  renderFallback?: () => ReactNode;
  onHaptic?: (intent: HapticIntent) => void;
  onInteractionStart?: () => void;
  /** The cut was let go of before it finished — the pack is untouched again. */
  onInteractionCancel?: () => void;
  /** The lid is off — the pack counts as opened from here. */
  onOpenComplete?: () => void;
  /** The whole ceremony has played out. */
  onRevealComplete?: () => void;
  onError?: (message: string) => void;
}

const originOf = (url?: string) => {
  const match = /^(https?:\/\/[^/]+)/i.exec(url || '');
  return match ? `${match[1]}/` : undefined;
};

/**
 * Interactive "slice the seal" pack opening rendered by PixiJS inside a WebView.
 *
 * The gesture lives in the scene next to the renderer, so the cut follows the
 * finger without crossing the bridge; the bridge carries only discrete events
 * (interaction started, haptic tick, animation finished). Business logic stays
 * outside — the component just reports that its animation is over.
 *
 * Everything the host owns is a prop: the hint, the slots that ride on the
 * revealed card, the fallback artwork and the haptics. The package itself
 * depends on nothing but React Native, reanimated and the WebView.
 */
const PackOpener = forwardRef<PackOpenerHandle, PackOpenerProps>(
  function PackOpenerScene(
    {
      options,
      disabled = false,
      hint,
      topSlot,
      bottomSlot,
      renderFallback,
      onHaptic,
      onInteractionStart,
      onInteractionCancel,
      onOpenComplete,
      onRevealComplete,
      onError,
    },
    ref,
  ) {
    // The library declares `class WebView<P = undefined>` extending
    // `Component<WebViewProps & P>`, so leaving the generic implicit collapses
    // its props to `never`. Naming it restores them.
    const webRef = useRef<WebView<{}>>(null);
    const [failed, setFailed] = useState(false);
    const [ready, setReady] = useState(false);
    // Where the scene actually drew the pack — the hint sits right above it
    const [packRect, setPackRect] = useState<Rect | null>(null);
    // Where the revealed card came to rest — the slots hang off its edges
    const [cardRect, setCardRect] = useState<Rect | null>(null);
    // Chrome around the pack fades out the moment the cut begins
    const [cutting, setCutting] = useState(false);

    // `options` arrives as a fresh object on every render, so it is compared by
    // value — an identity change must not reload the WebView and restart the
    // animation mid-gesture. Only a different mechanic or different pack
    // artwork needs a new page; every other option is pushed into the running
    // scene further down.
    const optionsKey = JSON.stringify(options);
    const bootKey = `${options.variant ?? ''}|${options.assets?.pack?.url ?? ''}`;
    const latestOptions = useRef(options);
    latestOptions.current = options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const html = useMemo(() => buildSceneHtml(latestOptions.current), [bootKey]);
    const packUrl = options.assets?.pack?.url;
    const baseUrl = useMemo(() => originOf(packUrl), [packUrl]);

    const send = useCallback((command: string) => {
      webRef.current?.injectJavaScript(
        `window.__packScene && window.__packScene.${command};true;`,
      );
    }, []);

    // The page boots with the options it was built from, so only later changes
    // have to cross the bridge
    const applied = useRef(optionsKey);
    useEffect(() => {
      if (!ready || applied.current === optionsKey) {
        return;
      }
      applied.current = optionsKey;
      send(`${COMMANDS.SET_OPTIONS}(${optionsKey})`);
    }, [optionsKey, ready, send]);

    useImperativeHandle(
      ref,
      () => ({
        autoSlice: () => send(`${COMMANDS.AUTO_SLICE}()`),
        reset: () => {
          setCutting(false);
          setCardRect(null);
          send(`${COMMANDS.RESET}()`);
        },
      }),
      [send],
    );

    const chromeStyle = useAnimatedStyle(() => ({
      opacity: withTiming(cutting ? 0 : 1, {duration: 220}),
    }));

    // The WebView paints white before its first frame — keep it invisible until
    // the scene reports in, and let the pack fade itself in from there
    const stageStyle = useAnimatedStyle(() => ({
      opacity: withTiming(ready ? 1 : 0, {duration: 160}),
    }));

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        let data;
        try {
          data = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }

        switch (data.type) {
          case MESSAGES.READY:
            setReady(true);
            if (data.rect) {
              setPackRect(data.rect);
            }
            break;
          case MESSAGES.LAYOUT:
            // The pack was re-derived for a new stage size — the hint follows it
            if (data.rect) {
              setPackRect(data.rect);
            }
            break;
          case MESSAGES.INTERACTION_START:
            setCutting(true);
            onInteractionStart?.();
            break;
          case MESSAGES.TICK:
            onHaptic?.('light');
            break;
          case MESSAGES.COMMITTED:
            onHaptic?.('heavy');
            break;
          case MESSAGES.OPENED:
            onHaptic?.('success');
            onOpenComplete?.();
            break;
          case MESSAGES.REVEALED:
            if (data.card) {
              setCardRect(data.card);
            }
            onRevealComplete?.();
            break;
          case MESSAGES.RETRACTED:
            setCutting(false);
            onInteractionCancel?.();
            break;
          case MESSAGES.ERROR:
            setFailed(true);
            onError?.(String(data.message));
            break;
          default:
            break;
        }
      },
      [
        onError,
        onHaptic,
        onInteractionCancel,
        onInteractionStart,
        onOpenComplete,
        onRevealComplete,
      ],
    );

    const fail = useCallback(
      (message: string) => {
        setFailed(true);
        onError?.(message);
      },
      [onError],
    );

    // Scene could not start (no WebGL, texture failed) — plain artwork instead
    if (failed) {
      return (
        <View style={styles.root}>
          <View style={styles.stage}>
            {renderFallback ? (
              renderFallback()
            ) : (
              <Image
                source={{uri: packUrl}}
                resizeMode="contain"
                style={styles.plainImage}
              />
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.root}>
        <Animated.View style={[styles.stage, stageStyle]}>
          <WebView<{}>
            ref={webRef}
            source={{html, baseUrl}}
            originWhitelist={['*']}
            onMessage={onMessage}
            style={styles.webview}
            containerStyle={styles.webview}
            androidLayerType="hardware"
            javaScriptEnabled
            domStorageEnabled={false}
            scrollEnabled={false}
            overScrollMode="never"
            bounces={false}
            setSupportMultipleWindows={false}
            allowsInlineMediaPlayback
            pointerEvents={disabled ? 'none' : 'auto'}
            onError={() => fail('webview error')}
            onRenderProcessGone={() => fail('render process gone')}
          />

          {!!hint && (
            <Animated.View
              style={[
                styles.hintWrap,
                !!packRect && {top: Math.max(12, packRect.top - HINT_GAP)},
                chromeStyle,
              ]}
              pointerEvents="none">
              {hint}
            </Animated.View>
          )}

          {!!cardRect && !!topSlot && (
            <View
              style={[
                styles.topSlot,
                {height: Math.max(0, cardRect.top - SLOT_GAP)},
              ]}
              pointerEvents="box-none">
              {topSlot}
            </View>
          )}
          {!!cardRect && !!bottomSlot && (
            <View
              style={[styles.bottomSlot, {top: cardRect.bottom}]}
              pointerEvents="box-none">
              {bottomSlot}
            </View>
          )}
        </Animated.View>
      </View>
    );
  },
);

export default memo(PackOpener);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 12,
  },
  stage: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hintWrap: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
  },
  // Both slots ride on the card the scene drew, so the UI keeps its distance
  // from the artwork whatever the screen size
  topSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
  },
  // Straight under the artwork, so the rarity badge hangs off its edge exactly
  // as it does on the result screen
  bottomSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  plainImage: {
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH,
    backgroundColor: 'transparent',
  },
});
