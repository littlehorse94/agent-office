# The tycoon view

Back to the [README](../README.md).

The office (`/`, also at `/tycoon`) is the floor you're on as an isometric office, the way a tycoon game draws it: a room per division, a desk per minion, and every minion a real worker. On this branch it replaces the 3D office, whose code is kept but no longer served; the 2D list view is still at `/lite`. It loads no three.js.

- **Rooms.** One per division of the roles on the building's floors (see [Roles](#roles)), and an **Open plan** for workers hired without one. Each room has a desk per minion in it and one spare.
- **Minions.** Posed by how they're doing: idle, working, needs you (hand up, hopping, and a 🙋 on its tag) and done (arms up). Click one, or its desk, for its terminal. One that's asleep is woken up.
- **Hiring.** **Hire** in the toolbar, a room's sign or a free desk: pick a role, say what it should do first, and a worker is hired with the role's brief in front of your task.
- **The toolbar.** Hire, Issues, PRs and Queue, as on the 2D view. The bar on top has the floor, how many minions are working, need you or are done, and today's spend against the daily budget (`--budget`).
- **Zoom** with **−** and **+**; the floor scrolls both ways.

## Roles

A role is a Markdown file in a `roles/` folder at the top of any floor's repository. Its title names the role and, in brackets, its division (the room it works in):

```markdown
# Role: Chief of Staff (Leadership)

**You are** ...
```

`roles/_shared.md`, when there is one, is the rules every role on that floor follows: it goes in front of each role's brief. Every floor's roles are offered on every floor of the office, so one repository (an HQ or notes repo) can hold the roles for the whole building. When two floors have a role of the same file name, the first floor's is used. They're read each time the page loads, so a role pushed to the repo is there on the next reload (after a `git pull` in that floor's checkout).

A worker hired into a role is told:

```
[role: chief-of-staff]
You are the Chief of Staff in this office. Follow this brief for the whole session.

<_shared.md>

<chief-of-staff.md>

---
Your first task:
<what you typed>
```

The `[role: …]` tag is how the view knows which room to seat it in, so a worker keeps its room after a restart.

## Art

Everything is drawn as a placeholder until there's art for it, except the decoration (rug, whiteboard, coffee machine, water cooler, sofa), which only appears once its file is there. Put PNGs with a transparent background in the office's `.agent-office/tycoon-art/` folder (`~/agent-office/.agent-office/tycoon-art/`, or under the `--home` you start it with) and reload the page: no restart, and a missing file falls back to its placeholder.

Draw everything at **2x**: the page shows it at half the size. The grid is 2:1 isometric (a tile is twice as wide as it is tall), light from the top left.

| File | Size (px) | What it is |
| --- | --- | --- |
| `floor.png` | 256 × 128 | A floor tile: a diamond filling the image. |
| `floor-<division>.png` | 256 × 128 | A room's own floor, e.g. `floor-leadership.png`, `floor-strategy-growth.png` (lowercase, dashes for spaces and `&`). `floor-corridor.png` is the floor between rooms. |
| `wall.png` | 256 × 384 | A wall on the tile's **back-left** edge: the bottom 128 px is the tile's diamond, the wall rises from its left corner to its top corner. It's mirrored for the back-right edge. |
| `desk.png` | 256 × 256 | A desk with a laptop. Its bottom edge sits on the tile's bottom corner. Mirrored for desks facing the other way. |
| `plant.png` | 256 × 256 | A plant, in each room's back corner. |
| `shelf.png` | 256 × 256 | A bookshelf, against the wall. |
| `rug.png` | 512 × 256 | A rug under each room's desks, covering about 2 × 2 tiles. |
| `whiteboard.png` | 256 × 256 | On the back wall of the rooms along it. |
| `coffee-machine.png`, `water-cooler.png` | 256 × 256 | By each room's door. |
| `sofa.png` | 384 × 256 | In the first room. |
| `sign.png` | 512 × 128 | A room's sign: the room's name is written over it, so leave the middle plain. |
| `minion-idle.png` | 128 × 192 | A minion standing, facing front-right. Its feet at the bottom center. |
| `minion-working.png` | 128 × 192 | Typing, facing front-right. |
| `minion-needs-you.png` | 128 × 192 | A hand up, facing front-right. |
| `minion-done.png` | 128 × 192 | Arms up, cheering, facing front-right. |
| `minion-<role>-<pose>.png` | 128 × 192 | A role's own look, e.g. `minion-chief-of-staff-working.png`. Wins over the plain one; any pose it hasn't got falls back. |
| `icon-hire.png`, `icon-issues.png`, `icon-prs.png`, `icon-queue.png` | 128 × 128 | The toolbar's buttons. |
| `icon-working.png`, `icon-needs-you.png`, `icon-done.png` | 128 × 128 | On a minion's name tag. |

Minions face front-right only: the ones sitting the other way are the same image mirrored.

## Running two offices on one machine

An office keeps everything under its `--home`, so two homes are two offices that share nothing:

```bash
agent-office --home ~/office-a --projects ~/office-a --port 4700
agent-office --home ~/office-b --projects ~/office-b --port 4701
```

`agent-office setup --home <dir> --projects <dir> --project owner/repo …` clones the floors first, without asking anything.
