// Hiring a minion into a role (see shared/tycoon.ts): pick the role, then say what it should do
// first, and it's hired with its role's brief in front of that. Shared by the tycoon view and the
// isometric office.
import { DESK_BY_ID, nextFreeSeat } from '../../shared/layout';
import { OPEN_PLAN, roleBrief, type TycoonInfo, type TycoonRole } from '../../shared/tycoon';
import type { Net } from '../net';
import { repoChoices } from '../shared/hiring';
import { store } from '../state';
import { openAsk } from '../ui/ask';
import { h, openModal, toast } from '../ui/dom';

let info: TycoonInfo | null = null;

/** The roles the building's floors have, and the art there is (cached after the first ask). */
export async function tycoonInfo(): Promise<TycoonInfo> {
  if (info) return info;
  try {
    const res = await fetch('/api/tycoon', { cache: 'no-store' });
    if (res.ok) return (info = (await res.json()) as TycoonInfo);
  } catch {
    // no roles to offer: anyone, no role
  }
  return { roles: [], art: [], artDir: '' };
}

/** The roles grouped by the room they work in. */
export function byDivision(roles: readonly TycoonRole[]): Map<string, TycoonRole[]> {
  const divisions = new Map<string, TycoonRole[]>();
  for (const r of roles) divisions.set(r.division, [...(divisions.get(r.division) ?? []), r]);
  return divisions;
}

export interface HireOptions {
  /** The desk to hire at; the next free one when missing. */
  deskId?: string;
  /** Only this room's roles. */
  division?: string;
  /** Picks the desk for a role, when none was given (the isometric office seats each room together). */
  deskFor?(role: TycoonRole | undefined): string | undefined;
}

/** Which role to hire, then what it should do first. */
export async function openHire(net: Net, opts: HireOptions = {}) {
  if (!store.project) return toast('Pick a floor first', 'warn');
  const { roles } = await tycoonInfo();
  const offered = opts.division ? roles.filter((r) => r.division === opts.division) : roles;
  if (opts.division === OPEN_PLAN || !offered.length) return hire(net, undefined, opts);
  const choose = (r?: TycoonRole) => {
    modal.close();
    hire(net, r, opts);
  };
  const form = h(
    'div.modal.ty-hire',
    {},
    h('header', {}, h('h2', {}, opts.division ? `🧑‍💼 Hire into ${opts.division}` : '🧑‍💼 Hire a minion')),
    h(
      'div.body',
      {},
      ...[...byDivision(offered)].map(([division, rs]) =>
        h('section', {}, h('h3', {}, division), h('div.ty-roles', {}, ...rs.map((r) => h('button.btn', { type: 'button', title: `From ${r.floor}/roles/${r.id}.md`, onclick: () => choose(r) }, r.name)))),
      ),
      opts.division ? null : h('section', {}, h('h3', {}, OPEN_PLAN), h('div.ty-roles', {}, h('button.btn', { type: 'button', onclick: () => choose() }, 'Anyone, no role'))),
    ),
  );
  const modal = openModal(form, { closeButton: true });
}

function hire(net: Net, role: TycoonRole | undefined, opts: HireOptions) {
  if (!store.project) return;
  const free = (id: string) => !store.workerAtDesk(id);
  const desk = (opts.deskId && free(opts.deskId) ? opts.deskId : undefined) ?? opts.deskFor?.(role) ?? nextFreeSeat((id) => !free(id), store.floorPlan.wing)?.id;
  if (!desk) return toast('Every desk is taken: send a minion home first', 'warn');
  openAsk({
    title: role ? `🧑‍💼 Hire a ${role.name}` : '🧑‍💼 Hire a minion',
    context: role ? roleBrief(role) : undefined,
    placeholder: role ? `What should the ${role.name} do first?` : 'What should the minion do?',
    newDesk: DESK_BY_ID.get(desk)?.label ?? desk,
    workers: [],
    worktreeOption: !!store.project.branch,
    providerOption: true,
    repoOptions: repoChoices(),
    onSubmit: (prompt, _to, worktree, provider, model, effort, repos) =>
      net.send({ t: 'worker.spawn', deskId: desk, prompt, worktree, provider, model, effort, repos: repos?.length ? repos : undefined }),
  });
}
