/**
 * Wire protocol between the scene and its host. The scene runs in a WebView on
 * React Native, so these strings cross a bridge — they are part of the public
 * contract and must stay in step with any host that speaks to the scene.
 */

/** Messages the scene posts out. */
export const MESSAGES = {
  READY: 'ready',
  INTERACTION_START: 'interactionStart',
  TICK: 'tick',
  COMMITTED: 'committed',
  OPENED: 'opened',
  /** Card reveal finished — the host may move on to its result screen. */
  REVEALED: 'revealed',
  RETRACTED: 'retracted',
  ERROR: 'error',
} as const;

/** Commands the host sends in. */
export const COMMANDS = {
  AUTO_SLICE: 'autoSlice',
  RESET: 'reset',
  SET_ENABLED: 'setEnabled',
} as const;

export type MessageType = (typeof MESSAGES)[keyof typeof MESSAGES];
export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];
