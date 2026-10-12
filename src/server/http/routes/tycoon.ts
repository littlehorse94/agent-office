// The tycoon view (/tycoon): its page, the roles and art it's drawn from, and the art files.
import path from 'node:path';
import { serveFile } from '../static.js';
import { send } from '../util.js';
import { artDir, artFile, listArt, listRoles } from '../../tycoon.js';
import type { Route } from '../router.js';
import type { TycoonInfo } from '../../../shared/tycoon.js';

export const tycoonRoutes = {
  page: { path: ['/tycoon', '/tycoon.html'], auth: 'session', handle: (ctx, { res }) => serveFile(res, path.join(ctx.publicDir, 'tycoon.html'), false) },
  info: {
    path: '/api/tycoon',
    method: 'GET',
    auth: 'session',
    handle(ctx, { res }) {
      const floors = [...ctx.floors.values()].map((f) => ({ name: f.def.name, dir: f.dir }));
      send(res, 200, { roles: listRoles(floors), art: listArt(ctx.cfg.dataDir), artDir: artDir(ctx.cfg.dataDir) } satisfies TycoonInfo);
    },
  },
  // Not cached, so new art shows on the next load.
  art: {
    prefix: '/tycoon-art/',
    auth: 'session',
    handle(ctx, { res, path: p }) {
      const file = artFile(ctx.cfg.dataDir, p.slice('/tycoon-art/'.length).replace(/\.png$/i, '').toLowerCase());
      if (file) return serveFile(res, file, false);
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    },
  },
} satisfies Record<string, Route>;
