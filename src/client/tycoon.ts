// The tycoon view (/tycoon): the floor as an isometric office, a room per division of the roles the
// building's floors keep in `roles/` (see shared/tycoon.ts). Every minion is a worker, posed by how
// it's doing; click one for its terminal, a free desk or a room's sign to hire into that room. Like
// the 2D view at /lite, it loads no three.js and nothing of the 3D office.

import { Net } from './net';
import { AVATAR_COLORS, loadProfile, store } from './state';
import { randomLook } from '../shared/avatar';
import { cloneLabel } from '../shared/floors';
import { ROOF } from '../shared/rooftop';
import { DESK_BY_ID, nextFreeSeat } from '../shared/layout';
import { isAsleep } from '../shared/status';
import { OPEN_PLAN, roleBrief, roleOf, type TycoonInfo, type TycoonRole } from '../shared/tycoon';
import type { FloorInfo } from '../shared/protocol';
import { $, closeAllModals, h, openModal, toast } from './ui/dom';
import { openTerminal, openTerminalFor, routeTerminalMessage } from './ui/terminal';
import { openChanges, routeChangesMessage } from './ui/changes';
import { routeWorktreeMessage } from './ui/prompt';
import { openBoard } from './ui/boards';
import type { BoardActions } from './ui/github/prompts';
import { routePullMessage } from './ui/pull';
import { openQueue } from './ui/queue';
import { openAsk } from './ui/ask';
import { waitingOnSomeone } from './notify';
import { repoChoices } from './shared/hiring';
import { renderTitle } from './shared/title';
import { drawScene, layoutRooms, type Room } from './tycoon/scene';
import * as art from './tycoon/art';
import { openMinion } from './tycoon/minion';

const saved = loadProfile();
store.profile = { name: saved?.name ?? 'Guest', color: saved?.color ?? AVATAR_COLORS[1], look: saved?.look ?? randomLook() };
const net = new Net(() => store.profile, () => null, true);

let info: TycoonInfo = { roles: [], art: [], artDir: '' };
let bootVersion = '';

net.onStatus((up) => $('conn').classList.toggle('hidden', up));
net.onMessage((msg) => {
  store.apply(msg);
  routeTerminalMessage(msg);
  routeChangesMessage(msg);
  routePullMessage(msg);
  routeWorktreeMessage(msg);
  switch (msg.t) {
    case 'welcome': {
      if (!bootVersion) bootVersion = msg.version;
      else if (msg.version !== bootVersion) return location.reload();
      offTheRoof();
      const openId = openTerminalFor();
      if (openId && store.workers.has(openId)) net.send({ t: 'worker.attach', workerId: openId });
      break;
    }
    case 'floor.enter':
      offTheRoof();
      break;
    case 'toast':
      toast(msg.text, msg.level);
      break;
  }
});

/** Nothing to see on the roof from here: down to the first floor instead. */
function offTheRoof() {
  if (store.floor !== ROOF) return;
  const to = store.floors.find((f) => !f.cloning);
  if (to) net.send({ t: 'floor.go', floor: to.id });
}

// ---- The top bar: the floor, and how the office is doing ----------------------------------------
const floorSelect = $('floor') as HTMLSelectElement;
const floorLabel = (f: FloorInfo) => `${f.name}${f.cloning ? ` (${cloneLabel(f.clone)})` : f.waiting ? ` · 🙋 ${f.waiting}` : ''}`;

function renderFloors() {
  const options = store.floors.map((f) => h('option', { value: f.id, disabled: !!f.cloning }, floorLabel(f)));
  if (!store.floors.length) options.push(h('option', { value: '' }, 'No floors yet'));
  floorSelect.replaceChildren(...options);
  floorSelect.value = store.floor ?? '';
  floorSelect.disabled = store.floors.length < 2;
  renderTitle();
}
floorSelect.addEventListener('change', () => {
  if (floorSelect.value && floorSelect.value !== store.floor) net.send({ t: 'floor.go', floor: floorSelect.value });
});
store.on('floors', renderFloors);
store.on('floor', renderFloors);

function renderStats() {
  const ws = [...store.workers.values()];
  const count = (f: (s: string) => boolean) => ws.filter((w) => f(w.status)).length;
  const { today, budget } = store.usage;
  const chips = [
    `👥 ${ws.length} minion${ws.length === 1 ? '' : 's'}`,
    `💬 ${count((s) => s === 'working' || s === 'starting')} working`,
    `🙋 ${count((s) => s === 'needs_input')} need you`,
    `✅ ${count((s) => s === 'done')} done`,
    `💰 $${today.cost.toFixed(2)}${budget ? ` / $${budget}` : ''} today`,
  ];
  $('stats').replaceChildren(...chips.map((c) => h('span.ty-chip', {}, c)));
}
store.on('usage', renderStats);

// ---- The floor ----------------------------------------------------------------------------------
const view = $('view');
const sizer = $('sizer');
const world = $('world');
let natural = { width: 1, height: 1 };
let zoom = 0;
const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25];

const roleById = () => new Map(info.roles.map((r) => [r.id, r]));

function renderWorld() {
  const roles = roleById();
  const rooms = layoutRooms(info.roles, store.workers.values());
  natural = drawScene(world, rooms, {
    open: (id) => openMinion(id, { net, openTerminal: openWorker, boardActions, roleName: (w) => roles.get(roleOf(w.prompt) ?? '')?.name }),
    hire: (room) => pickRole(room),
    roleName: (id) => roles.get(roleOf(store.workers.get(id)?.prompt) ?? '')?.name,
  });
  applyZoom();
  renderStats();
  renderTitle();
}

/** The fitting zoom the first time, then whatever was picked. */
function applyZoom() {
  if (!zoom) {
    const fit = Math.min(1, (view.clientWidth - 16) / natural.width, (view.clientHeight - 16) / natural.height);
    zoom = ZOOMS.filter((z) => z <= fit).pop() ?? ZOOMS[0];
  }
  world.style.transform = `scale(${zoom})`;
  sizer.style.width = `${natural.width * zoom}px`;
  sizer.style.height = `${natural.height * zoom}px`;
}
const zoomBy = (step: number) => {
  const i = Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + step));
  zoom = ZOOMS[i];
  applyZoom();
};
$('zoom-in').addEventListener('click', () => zoomBy(1));
$('zoom-out').addEventListener('click', () => zoomBy(-1));

/** A minion just started waiting on someone: a ding of a toast. */
const lastStatus = new Map<string, string>();
function noticeWorkers() {
  for (const w of store.workers.values()) {
    const before = lastStatus.get(w.id);
    lastStatus.set(w.id, w.status);
    if (before !== undefined && before !== w.status && waitingOnSomeone(w)) toast(w.status === 'needs_input' ? `🙋 ${w.name} needs you` : `✅ ${w.name} is done`);
  }
}
store.on('workers', () => {
  noticeWorkers();
  renderWorld();
});
store.on('project', renderWorld);

function openWorker(id: string) {
  const w = store.workers.get(id);
  if (!w) return;
  if (isAsleep(w.status)) net.send({ t: 'worker.resume', workerId: id });
  openTerminal(net, id, () => openChanges(net, id, () => openWorker(id)), undefined, { keypad: true });
}

// ---- Hiring -------------------------------------------------------------------------------------
/** Which role to hire, from all of them or one room's. */
function pickRole(room?: Room) {
  if (!store.project) return toast('Pick a floor first', 'warn');
  const roles = room ? room.roles : info.roles;
  if (room?.name === OPEN_PLAN || !roles.length) return hire();
  const divisions = new Map<string, TycoonRole[]>();
  for (const r of roles) divisions.set(r.division, [...(divisions.get(r.division) ?? []), r]);
  const choose = (r?: TycoonRole) => {
    modal.close();
    hire(r);
  };
  const form = h(
    'div.modal.ty-hire',
    {},
    h('header', {}, h('h2', {}, room ? `🧑‍💼 Hire into ${room.name}` : '🧑‍💼 Hire a minion')),
    h(
      'div.body',
      {},
      ...[...divisions].map(([division, rs]) =>
        h('section', {}, h('h3', {}, division), h('div.ty-roles', {}, ...rs.map((r) => h('button.btn', { type: 'button', title: `From ${r.floor}/roles/${r.id}.md`, onclick: () => choose(r) }, r.name)))),
      ),
      room ? null : h('section', {}, h('h3', {}, OPEN_PLAN), h('div.ty-roles', {}, h('button.btn', { type: 'button', onclick: () => choose() }, 'Anyone, no role'))),
    ),
  );
  const modal = openModal(form, { closeButton: true });
}

/** A new minion, in `role` when there's one. */
function hire(role?: TycoonRole) {
  if (!store.project) return;
  const desk = nextFreeSeat((id) => !!store.workerAtDesk(id), store.floorPlan.wing)?.id;
  if (!desk) return toast('Every desk is taken: send a minion home first', 'warn');
  openAsk({
    title: role ? `🧑‍💼 Hire a ${role.name}` : '🧑‍💼 Hire a minion',
    context: role ? roleBrief(role) : undefined,
    placeholder: role ? `What should the ${role.name} do first?` : 'What should the minion do?',
    newDesk: DESK_BY_ID.get(desk)!.label,
    workers: [],
    worktreeOption: !!store.project.branch,
    providerOption: true,
    repoOptions: repoChoices(),
    onSubmit: (prompt, _to, worktree, provider, model, effort, repos) =>
      net.send({ t: 'worker.spawn', deskId: desk, prompt, worktree, provider, model, effort, repos: repos?.length ? repos : undefined }),
  });
}

// ---- The toolbar --------------------------------------------------------------------------------
function boardActions(): BoardActions {
  return {
    queue: (prompt, title, issue, provider, model, effort) => net.send({ t: 'queue.add', prompt, title, issue, provider, model, effort }),
    assign: (prompt, title, issue) => {
      const desk = nextFreeSeat((id) => !!store.workerAtDesk(id), store.floorPlan.wing)?.id;
      if (!desk) return toast('Every desk is taken: send a minion home first', 'warn');
      net.send({ t: 'worker.spawn', deskId: desk, prompt, worktree: !!store.project?.branch, issue });
      toast(`🧑‍💼 Hiring someone for "${title}"`);
    },
    ask: () => pickRole(),
    goToDesk: (deskId) => {
      const w = store.workerAtDesk(deskId);
      if (!w) return;
      closeAllModals();
      openWorker(w.id);
    },
    meeting: () => toast("Meetings aren't in the tycoon view yet", 'warn'),
  };
}

function toolButton(id: string, iconName: string, label: string, run: () => void) {
  const b = $(id);
  b.prepend(h('img.ty-icon', { src: art.src([iconName], () => art.icon(iconName)), alt: '', width: 28, height: 28 }));
  b.querySelector('.ty-label')!.textContent = label;
  b.addEventListener('click', run);
}

function renderNav() {
  const count = (id: string, n: number) => ($(id).querySelector('.n')!.textContent = n ? String(n) : '');
  count('btn-issues', store.issues.items.filter((i) => i.state === 'OPEN').length);
  count('btn-pulls', store.pulls.items.filter((p) => p.state === 'OPEN').length);
  count('btn-queue', store.queue.tasks.filter((t) => t.status !== 'done').length);
}
store.on('issues', renderNav);
store.on('pulls', renderNav);
store.on('queue', renderNav);

// ---- In -----------------------------------------------------------------------------------------
void (async () => {
  try {
    const who = await fetch('/api/whoami', { cache: 'no-store' });
    if (who.status === 401) return void (location.href = '/login');
    const { me } = (await who.json()) as { me?: typeof store.me };
    if (me) store.me = me;
    const res = await fetch('/api/tycoon', { cache: 'no-store' });
    if (res.ok) info = (await res.json()) as TycoonInfo;
  } catch {
    toast("Couldn't load the roles and art: showing the open plan", 'warn');
  }
  art.setArt(info.art);
  if (store.me.account) store.profile.name = store.me.account.name;
  toolButton('btn-hire', 'icon-hire', 'Hire', () => pickRole());
  toolButton('btn-issues', 'icon-issues', 'Issues', () => openBoard('issues', net, boardActions()));
  toolButton('btn-pulls', 'icon-prs', 'PRs', () => openBoard('pulls', net, boardActions()));
  toolButton('btn-queue', 'icon-queue', 'Queue', () => openQueue(net, { openTerminal: openWorker }));
  renderFloors();
  renderWorld();
  renderNav();
  net.connect();
})();

addEventListener('resize', () => applyZoom());

// Debug handle for quick checks from the console / headless screenshots.
(window as any).__tycoon = { store, net, info: () => info };
