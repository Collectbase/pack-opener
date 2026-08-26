import type {PackOpenerOptions} from '../core/config/types';
import sceneBundle from './sceneBundle';

// A stray "</script>" inside the bundle would close our tag early
const safeBundle = sceneBundle.replace(/<\/script/gi, '<\\/script');

/** Self-contained page: Pixi and the scene are inlined, nothing is fetched. */
export default function buildSceneHtml(options: PackOpenerOptions): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    background: transparent;
    overflow: hidden;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  canvas { display: block; background: transparent; touch-action: none; }
</style>
</head>
<body>
<script>window.__PACK_CONFIG__ = ${JSON.stringify(options)};</script>
<script>${safeBundle}</script>
</body>
</html>`;
}
