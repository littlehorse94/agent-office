// The tycoon view's roles and art (see shared/tycoon.ts). Roles are read from every floor's `roles/`
// folder, fresh on each ask, so a role pushed to a repo shows up on the next page load; the art is
// whatever PNGs are in the office's `.agent-office/tycoon-art/` folder.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isArtName, parseRole, type TycoonRole } from '../shared/tycoon.js';

/** A floor, as far as roles go. */
export interface RoleSource {
  name: string;
  dir: string;
}

const read = (file: string) => {
  try {
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return undefined;
  }
};

/** Every role on every floor, in floor order then by file name. A role id two floors share is the first floor's. */
export function listRoles(floors: Iterable<RoleSource>): TycoonRole[] {
  const roles: TycoonRole[] = [];
  const seen = new Set<string>();
  for (const floor of floors) {
    const dir = path.join(floor.dir, 'roles');
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.md'))
        .sort();
    } catch {
      continue;
    }
    const shared = read(path.join(dir, '_shared.md'))?.trim();
    for (const file of files) {
      const text = read(path.join(dir, file));
      const role = text && parseRole(file, text);
      if (!role || seen.has(role.id)) continue;
      seen.add(role.id);
      // The role says "read _shared.md first": it's put in front, so the worker needn't go looking.
      roles.push({ ...role, floor: floor.name, brief: shared ? `${shared}\n\n${text.trim()}` : text.trim() });
    }
  }
  return roles;
}

/** Where the art goes. */
export const artDir = (dataDir: string) => path.join(dataDir, 'tycoon-art');

/** The art that's there, by name without `.png`. */
export function listArt(dataDir: string): string[] {
  try {
    return readdirSync(artDir(dataDir))
      .filter((f) => f.toLowerCase().endsWith('.png'))
      .map((f) => f.slice(0, -4).toLowerCase())
      .filter(isArtName)
      .sort();
  } catch {
    return [];
  }
}

/** One art file, or undefined when the name isn't one or it isn't there. */
export function artFile(dataDir: string, name: string): string | undefined {
  if (!isArtName(name)) return undefined;
  const dir = artDir(dataDir);
  // The name is lowercase, the file mightn't be (Windows doesn't mind, Linux does).
  let file = path.join(dir, `${name}.png`);
  if (!existsSync(file)) {
    try {
      const found = readdirSync(dir).find((f) => f.toLowerCase() === `${name}.png`);
      if (!found) return undefined;
      file = path.join(dir, found);
    } catch {
      return undefined;
    }
  }
  return statSync(file).isFile() ? file : undefined;
}
