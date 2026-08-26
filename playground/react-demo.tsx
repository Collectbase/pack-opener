import React, {useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import PackOpener, {type PackOpenerHandle} from '../src/react';

/** Smallest possible host for the React wrapper — the same engine, 30 lines. */
function Demo() {
  const ref = useRef<PackOpenerHandle>(null);
  const [events, setEvents] = useState<string[]>([]);
  const note = (line: string) => setEvents(prev => [line, ...prev].slice(0, 30));

  const options = useMemo(
    () => ({
      assets: {pack: {url: placeholder('PACK', '#2b4c9b', '#8b1e3f')}},
      theme: {glow: '#8be36a'},
    }),
    [],
  );

  return (
    <main>
      <section id="stage">
        <PackOpener
          ref={ref}
          options={options}
          onReady={() => note('ready')}
          onInteractionStart={() => note('interactionStart')}
          onProgress={p => note(`progress ${p.toFixed(2)}`)}
          onCommitted={() => note('committed')}
          onOpenComplete={() => note('opened')}
          onRevealComplete={() => note('revealed')}
          onError={message => note(`error: ${message}`)}
        />
      </section>
      <aside id="panel">
        <header>
          <h1>react wrapper</h1>
          <div className="row">
            <button onClick={() => ref.current?.reset()}>Replay</button>
            <button onClick={() => ref.current?.autoSlice()}>Auto slice</button>
          </div>
        </header>
        <footer>
          <h2>Events</h2>
          <ol id="log">
            {events.map((line, i) => (
              <li key={`${line}-${i}`}>{line}</li>
            ))}
          </ol>
        </footer>
      </aside>
    </main>
  );
}

function placeholder(label: string, from: string, to: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 68px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL();
}

createRoot(document.querySelector('#root')!).render(<Demo />);
