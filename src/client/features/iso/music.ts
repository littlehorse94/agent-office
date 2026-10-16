// Focus music in the isometric office: Spotify playlists in a little player that stays up while you
// work (the jukebox and the toolbar's 🎧 open it). It's Spotify's own embedded player, so it plays
// whole tracks for whoever's signed in to Spotify in that browser, and previews otherwise. Each
// browser keeps its own list: Ma's two focus playlists to start, and any playlist link added.
import { h, toast } from '../../ui/dom';

const KEY = 'agent-office.focus-playlists';
const DEFAULTS = [
  { id: '2Wo1IvZKfpuZttkB8xQAXz', name: 'Focus 1' },
  { id: '5S6OirGcCwyd1X9TBOQsw2', name: 'Focus 2' },
];

type Playlist = { id: string; name: string };

function load(): Playlist[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Playlist[] | null;
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // storage blocked or garbled
  }
  return [...DEFAULTS];
}

function save(list: Playlist[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: the list lasts as long as the page
  }
}

/** A Spotify playlist's id from its link (open.spotify.com/playlist/<id>?si=…), or the id itself. */
export function playlistId(link: string): string | null {
  const m = /playlist[/:]([A-Za-z0-9]{22})/.exec(link) ?? /^([A-Za-z0-9]{22})$/.exec(link.trim());
  return m ? m[1] : null;
}

export function isoMusic() {
  let list = load();
  let playing: string | null = null;
  const tabs = h('div.iso-music-tabs');
  const player = h('div.iso-music-player');
  const input = h('input', { type: 'url', placeholder: 'Paste a Spotify playlist link', 'aria-label': 'Spotify playlist link' }) as HTMLInputElement;
  const add = h('form.iso-music-add', {}, input, h('button.btn', { type: 'submit' }, 'Add'));
  const close = h('button.btn.iso-music-close', { type: 'button', title: 'Hide (keeps playing)', 'aria-label': 'Hide the player' }, '–');
  const panel = h('aside.iso-music.hidden', { 'aria-label': 'Focus music' }, h('header', {}, h('strong', {}, '🎧 Focus music'), close), tabs, player, add);
  document.body.append(panel);

  function play(id: string) {
    playing = id;
    player.replaceChildren(
      h('iframe', {
        src: `https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`,
        width: '100%',
        height: '352',
        frameborder: '0',
        allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
        loading: 'lazy',
        title: 'Spotify playlist',
      }),
    );
    render();
  }

  function render() {
    tabs.replaceChildren(
      ...list.map((p) =>
        h(
          'span.iso-music-tab',
          { class: p.id === playing ? 'on' : '' },
          h('button.btn', { type: 'button', onclick: () => play(p.id) }, `🎵 ${p.name}`),
          h('button.iso-music-x', { type: 'button', title: `Remove ${p.name}`, 'aria-label': `Remove ${p.name}`, onclick: () => remove(p.id) }, '×'),
        ),
      ),
    );
  }

  function remove(id: string) {
    list = list.filter((p) => p.id !== id);
    save(list);
    if (playing === id) {
      playing = null;
      player.replaceChildren();
    }
    render();
  }

  add.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = playlistId(input.value);
    if (!id) return toast('That isn’t a Spotify playlist link', 'warn');
    if (!list.some((p) => p.id === id)) list.push({ id, name: `Focus ${list.length + 1}` });
    save(list);
    input.value = '';
    play(id);
  });
  close.addEventListener('click', () => panel.classList.add('hidden'));

  render();
  return {
    /** Shows the player, starting on the first playlist the first time. */
    open() {
      panel.classList.remove('hidden');
      if (!playing && list[0]) play(list[0].id);
    },
    toggle() {
      if (panel.classList.contains('hidden')) this.open();
      else panel.classList.add('hidden');
    },
  };
}
