// The tycoon view (/tycoon): what the page and the server both need to know about roles and art.
// A role is a Markdown file in a floor's `roles/` folder, `# Role: Chief of Staff (Leadership)`, and a
// worker hired into one carries a `[role: <id>]` tag at the top of its first prompt, which is how the
// view knows which room to seat it in. Pure code: no Node, no DOM.

/** A role a minion can be hired into, from `<floor>/roles/<id>.md`. */
export interface TycoonRole {
  /** The file's name without `.md`: `chief-of-staff`. */
  id: string;
  /** From the file's title: `Chief of Staff`. */
  name: string;
  /** The room it works in, from the brackets in the title: `Leadership`. `Team` when it has none. */
  division: string;
  /** The floor whose `roles/` folder it's in. */
  floor: string;
  /** What the worker is told before its first task: the floor's `_shared.md` (if any), then the role. */
  brief: string;
}

/** What /api/tycoon answers. */
export interface TycoonInfo {
  roles: TycoonRole[];
  /** The art files Ma has dropped in, by name without `.png`; everything else is drawn as a placeholder. */
  art: string[];
  /** Where to put them, to say so on the page. */
  artDir: string;
}

/** The room for workers hired without a role. */
export const OPEN_PLAN = 'Open plan';

const ROLE_ID = /^[a-z0-9][a-z0-9-]*$/;

/** A role's id and title from its file, or undefined when the file isn't a role (`_shared.md`, a README). */
export function parseRole(file: string, markdown: string): { id: string; name: string; division: string } | undefined {
  const id = file.replace(/\.md$/i, '').toLowerCase();
  if (!ROLE_ID.test(id)) return undefined;
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1].trim();
  if (!title) return undefined;
  const m = /^(?:Role:\s*)?(.+?)(?:\s*\(([^)]+)\))?$/i.exec(title);
  if (!m) return undefined;
  return { id, name: m[1].trim(), division: m[2]?.trim() || 'Team' };
}

const TAG = /\[role:\s*([a-z0-9][a-z0-9-]*)\]/;

/** What a new worker in `role` is told, ahead of the task you give it. */
export function roleBrief(role: Pick<TycoonRole, 'id' | 'name' | 'brief'>): string {
  return `[role: ${role.id}]\nYou are the ${role.name} in this office. Follow this brief for the whole session.\n\n${role.brief.trim()}\n\n---\nYour first task:`;
}

/** The role a worker was hired into, from its first prompt. */
export function roleOf(prompt: string | undefined): string | undefined {
  return prompt ? TAG.exec(prompt)?.[1] : undefined;
}

/** A worker's pose, from its status. */
export type MinionPose = 'idle' | 'working' | 'needs-you' | 'done';

export function poseOf(status: string): MinionPose {
  if (status === 'working' || status === 'starting') return 'working';
  if (status === 'needs_input') return 'needs-you';
  if (status === 'done') return 'done';
  return 'idle';
}

export const POSES: readonly MinionPose[] = ['idle', 'working', 'needs-you', 'done'];

/**
 * Every art file the view looks for, by name without `.png`, with its size (drawn at 2x, shown at
 * half). A minion can also have art of its own role, `minion-<role id>-<pose>`, which wins over the
 * plain one; a room can have its own floor, `floor-<division>` (lowercase, dashes for spaces).
 */
export const ART: Readonly<Record<string, readonly [number, number]>> = {
  floor: [256, 128],
  wall: [256, 384],
  desk: [256, 256],
  plant: [256, 256],
  shelf: [256, 256],
  sign: [512, 128],
  // Decoration, drawn only when there's art for it: no placeholders.
  whiteboard: [256, 256],
  'water-cooler': [256, 256],
  'coffee-machine': [256, 256],
  sofa: [384, 256],
  rug: [512, 256],
  'minion-idle': [128, 192],
  'minion-working': [128, 192],
  'minion-needs-you': [128, 192],
  'minion-done': [128, 192],
  'icon-hire': [128, 128],
  'icon-issues': [128, 128],
  'icon-prs': [128, 128],
  'icon-queue': [128, 128],
  'icon-needs-you': [128, 128],
  'icon-done': [128, 128],
  'icon-working': [128, 128],
};

/** `Strategy & Growth` -> `strategy-growth`, for a room's own floor art. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** An art file's name is safe to look for: lowercase letters, digits and dashes. */
export const isArtName = (name: string) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(name);

/** What a worker hired into a role was asked to do, without the role's brief in front of it. */
export function taskOfPrompt(prompt: string): string {
  if (!TAG.test(prompt)) return prompt;
  const i = prompt.lastIndexOf('Your first task:');
  return i >= 0 ? prompt.slice(i + 'Your first task:'.length).trim() || prompt : prompt;
}
