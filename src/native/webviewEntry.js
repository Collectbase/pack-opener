/**
 * Entry point for the bundle that runs inside react-native-webview.
 *
 * Everything real lives in `core` — this only wires the engine's events onto
 * the bridge and parks the handle where the React Native side can reach it
 * with `injectJavaScript`.
 */
import {createPackOpener} from '../core';
import {MESSAGES} from '../core/config/protocol';

const post = message => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
};

createPackOpener(document.body, window.__PACK_CONFIG__ || {}, {onEvent: post})
  .then(instance => {
    window.__packScene = instance;
  })
  .catch(error => {
    post({type: MESSAGES.ERROR, message: String(error?.message || error)});
  });
