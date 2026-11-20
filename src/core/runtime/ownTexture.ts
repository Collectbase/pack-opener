import {Texture} from 'pixi.js';

/**
 * Artwork as a texture of the caller's own, never put in Pixi's cache. That
 * cache is shared by every scene on the page and keeps what it holds until
 * someone unloads it — and nobody can safely unload a URL another scene may
 * be showing — so artwork that comes batch after batch (the climb's cards)
 * would pile up there for the life of the page. A texture of one's own is
 * let go of with `releaseTexture` and nothing is left behind.
 *
 * Decoded off the main thread where the browser can: fetched and made a
 * bitmap, as Pixi's own loader does. A fetch that is refused is asked again
 * past the browser's cache: a page that has shown the same URL in a plain
 * `<img>` — a preload, a list of the same cards — may have left it cached
 * without the CORS header, and then every request that needs the header is
 * refused from the cache, though the server would give it. Refused still (a
 * blocking extension, a corporate proxy), it is read through an `<img>`
 * instead, the way `loadTexture` falls back. Taller than `maxHeight` px, it is scaled
 * down to that height, its shape kept, and the full-size pixels let go of at
 * once: a phone photo is many times the size a card is shown at, and a batch
 * holds every card's artwork for as long as it is on show.
 */
export async function loadOwnTexture(url: string, maxHeight = Infinity): Promise<Texture> {
  if (typeof createImageBitmap === 'function') {
    let bitmap = await fetchedBitmap(url, 'default');
    // Only a fetch that was refused is asked again: an answer that is not the picture would be the same again
    if (bitmap === 'refused') bitmap = await fetchedBitmap(url, 'reload');
    if (bitmap && bitmap !== 'refused') return Texture.from(await scaledDown(bitmap, maxHeight), true);
  }
  const image = new Image();
  // WebGL refuses to sample an image fetched without CORS
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
  // Decoded now rather than on the frame that first draws it
  await image.decode().catch(() => {});
  return Texture.from(await scaledDown(image, maxHeight), true);
}

/**
 * The picture at `url`, fetched the way `cache` says and decoded: `'refused'`
 * when the fetch itself is refused (the network, CORS, a blocker), null when
 * it answers with something that is not the picture.
 */
async function fetchedBitmap(url: string, cache: RequestCache): Promise<ImageBitmap | 'refused' | null> {
  let response: Response;
  try {
    response = await fetch(url, {cache});
  } catch {
    return 'refused';
  }
  if (!response.ok) return null;
  try {
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

/**
 * `source` no taller than `maxHeight` px: as it is when it is not, otherwise
 * a copy scaled down to that height, its shape kept — resized by the browser,
 * or drawn smaller on a canvas where the browser cannot (one that ignores the
 * resize hands the whole size back). A bitmap scaled down is closed.
 */
async function scaledDown(
  source: ImageBitmap | HTMLImageElement,
  maxHeight: number,
): Promise<ImageBitmap | HTMLImageElement | HTMLCanvasElement> {
  const image = source instanceof HTMLImageElement;
  const width = image ? source.naturalWidth : source.width;
  const height = image ? source.naturalHeight : source.height;
  if (!(height > maxHeight) || !(width > 0)) return source;
  const h = Math.max(1, Math.floor(maxHeight));
  const w = Math.max(1, Math.round((width * h) / height));
  const smaller = <T>(copy: T): T => {
    if (!image) source.close();
    return copy;
  };
  if (typeof createImageBitmap === 'function') {
    try {
      const copy = await createImageBitmap(source, {resizeWidth: w, resizeHeight: h, resizeQuality: 'high'});
      if (copy.height === h) return smaller(copy);
      copy.close();
    } catch {
      // Drawn smaller below
    }
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, w, h);
      return smaller(canvas);
    }
  } catch {
    // Kept at its own size
  }
  return source;
}

/** Lets go of a texture of one's own (`loadOwnTexture`): off the GPU, and a bitmap's pixels now, not at the next collection. */
export function releaseTexture(texture: unknown): void {
  const owned = texture as Texture | null | undefined;
  if (!owned || owned.destroyed) return;
  const resource = owned.source?.resource as {close?: () => void} | undefined;
  owned.destroy(true);
  resource?.close?.();
}
