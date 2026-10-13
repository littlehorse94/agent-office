// What you can do with a minion in the tycoon view, from the card a click on it opens: its terminal,
// a prompt, its changes, its pull request, and sending it home. The 3D office does these with keys
// at the desk (features/workers/actions.ts); this is the same, as buttons.
import type { WorkerInfo } from '../../shared/protocol';
import { isAsleep, isBusy } from '../../shared/status';
import type { Net } from '../net';
import { store } from '../state';
import { clip, h, openModal, STATUS_LABEL, timeAgo, toast } from '../ui/dom';
import { confirmDialog, openPrompt, sendHomeDialog } from '../ui/prompt';
import { openChanges } from '../ui/changes';
import { openPull } from '../ui/pull';
import type { BoardActions } from '../ui/github/prompts';

export interface MinionDeps {
  net: Net;
  openTerminal(id: string): void;
  boardActions(): BoardActions;
  roleName(w: WorkerInfo): string | undefined;
}

/** The card for a minion. One that's asking something goes straight to its terminal, where the question is. */
export function openMinion(id: string, deps: MinionDeps) {
  const w = store.workers.get(id);
  if (!w) return;
  if (w.status === 'needs_input') return deps.openTerminal(id);
  const role = deps.roleName(w);
  const task = w.task?.name ?? w.title ?? (w.prompt ? clip(w.prompt.replace(/^\[role:[^\]]*\][\s\S]*?Your first task:\s*/, ''), 140) : undefined);
  const now = w.status === 'done' ? (w.task?.summary && `✅ ${w.task.summary}`) : (w.task?.summary ?? w.activity);
  const act = (label: string, title: string, run: () => void, cls = '') => h(`button.btn${cls}`, { type: 'button', title, onclick: () => (modal.close(), run()) }, label);
  const buttons = [
    act('💻 Terminal', 'Its live terminal', () => deps.openTerminal(id), '.primary'),
    isAsleep(w.status) ? null : act('✍️ Prompt', 'Tell it what to do next', () => promptMinion(w, deps)),
    act('🔍 Changes', 'What it has changed', () => openChanges(deps.net, id, () => deps.openTerminal(id))),
    w.worktree || w.pr ? act(w.pr ? `🔀 PR #${w.pr.number}` : '🔀 Open PR', w.pr ? 'Its pull request' : 'Push its branch and open a pull request', () => pullRequest(w, deps)) : null,
    act('🏠 Send home', 'Stop it and free its desk', () => sendHome(w, deps), '.danger'),
  ];
  const card = h(
    'div.modal.ty-minion-card',
    {},
    h('header', {}, h('h2', {}, h('span.dot', { style: `background:${w.color}` }), ` ${w.name}`, role ? h('small', {}, ` · ${role}`) : null)),
    h(
      'div.body',
      {},
      h('p.ty-status', {}, h('span.pill', { class: w.status }, STATUS_LABEL[w.status] ?? w.status), w.waitingSince ? ` ${timeAgo(w.waitingSince)}` : ''),
      task ? h('p.ty-task', {}, task) : null,
      now ? h('p.ty-now', {}, now) : null,
      w.worktree ? h('p.ty-sub', {}, `🌿 ${w.worktree.branch}`) : null,
      h('div.ty-actions', {}, ...buttons),
    ),
  );
  const modal = openModal(card, { closeButton: true });
}

function promptMinion(w: WorkerInfo, deps: MinionDeps) {
  openPrompt({
    title: `✍️ Prompt ${w.name}`,
    subtitle: w.status === 'working' ? `${w.name} is busy, so this waits in its input box until it's done.` : undefined,
    placeholder: 'What should it do next?',
    submitLabel: 'Send',
    onSubmit: (text) => deps.net.send({ t: 'worker.prompt', workerId: w.id, prompt: text }),
  });
}

function pullRequest(w: WorkerInfo, deps: MinionDeps) {
  if (w.pr) {
    const it = store.pulls.items.find((p) => p.number === w.pr!.number);
    if (it) openPull(it, deps.net, deps.boardActions());
    else window.open(w.pr.url, '_blank', 'noopener');
    return;
  }
  if (!w.worktree) return toast(`${w.name} works in the main checkout: only a minion with its own worktree can open a PR`, 'warn');
  if (w.prOpening) return;
  if (w.lost || isBusy(w.status)) return toast(`${w.name} is still ${STATUS_LABEL[w.status] ?? w.status}: wait until it's done`, 'warn');
  toast(`Pushing ${w.worktree.branch} and opening a pull request…`);
  deps.net.send({ t: 'worker.pr', workerId: w.id });
}

function sendHome(w: WorkerInfo, deps: MinionDeps) {
  const { net } = deps;
  if (w.worktree) {
    sendHomeDialog({
      workerId: w.id,
      name: w.name,
      where: 'its desk',
      worktree: w.worktree,
      repos: w.repos?.length ? [w.worktree.path.split(/[\\/]/).pop() ?? 'its own', ...w.repos.map((r) => r.name)] : undefined,
      ask: () => net.send({ t: 'worker.worktree', workerId: w.id }),
      onConfirm: (cleanup) => net.send({ t: 'worker.kill', workerId: w.id, cleanup }),
    });
    return;
  }
  confirmDialog(`Send ${w.name} home?`, `This stops its session for everyone and frees its desk. It forgets what it was asked.`, 'Send home', () => net.send({ t: 'worker.kill', workerId: w.id }));
}
