// The isometric office's toolbar, as the tycoon view has it: Hire, Issues, PRs and Queue along the
// bottom, with Ma's icons from the office's tycoon-art folder (or the office's own emoji), and the
// floor's theme name over the top.
import type { Net } from '../../net';
import { store } from '../../state';
import { h } from '../../ui/dom';
import { openBoard } from '../../ui/boards';
import type { BoardActions } from '../../ui/github/prompts';
import { openQueue } from '../../ui/queue';
import { tycoonInfo } from '../../tycoon/hire';

export interface ToolbarDeps {
  net: Net;
  hire(): void;
  music(): void;
  boardActions(): BoardActions;
  openTerminal(id: string): void;
}

const ICONS = { hire: ['icon-hire', '🧑‍💼', 'Hire'], issues: ['icon-issues', '📌', 'Issues'], pulls: ['icon-prs', '🔀', 'PRs'], queue: ['icon-queue', '📋', 'Queue'] } as const;

export function isoToolbar(deps: ToolbarDeps) {
  const counts = new Map<string, HTMLElement>();
  const button = (id: keyof typeof ICONS, run: () => void, primary = false) => {
    const [, emoji, label] = ICONS[id];
    const icon = h('span.iso-icon', {}, emoji);
    const n = h('span.n');
    counts.set(id, n);
    const b = h(`button.btn${primary ? '.primary' : ''}`, { type: 'button', onclick: run }, icon, h('span', {}, label), n);
    return { b, icon };
  };
  const hire = button('hire', deps.hire, true);
  const issues = button('issues', () => openBoard('issues', deps.net, deps.boardActions()));
  const pulls = button('pulls', () => openBoard('pulls', deps.net, deps.boardActions()));
  const queue = button('queue', () => openQueue(deps.net, { openTerminal: deps.openTerminal }));
  const music = h('button.btn', { type: 'button', title: 'Focus music (Spotify)', onclick: deps.music }, h('span.iso-icon', {}, '🎧'), h('span', {}, 'Music'));
  const bar = h('nav.iso-bar', { 'aria-label': 'Office' }, hire.b, issues.b, pulls.b, queue.b, music);
  const title = h('div.iso-title');
  document.body.append(bar, title);

  // Ma's icons, where there are any.
  void tycoonInfo().then(({ art }) => {
    for (const [id, { icon }] of Object.entries({ hire, issues, pulls, queue })) {
      const name = ICONS[id as keyof typeof ICONS][0];
      if (art.includes(name)) icon.replaceChildren(h('img', { src: `/tycoon-art/${name}.png`, alt: '', width: 28, height: 28 }));
    }
  });

  function render() {
    const set = (id: string, v: number) => (counts.get(id)!.textContent = v ? String(v) : '');
    set('issues', store.issues.items.filter((i) => i.state === 'OPEN').length);
    set('pulls', store.pulls.items.filter((p) => p.state === 'OPEN').length);
    set('queue', store.queue.tasks.filter((t) => t.status !== 'done').length);
  }
  store.on('issues', render);
  store.on('pulls', render);
  store.on('queue', render);
  render();

  return { setTitle: (t: string) => (title.textContent = t) };
}
