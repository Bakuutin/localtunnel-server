// @flow

import Koa from 'koa';
import Debug from 'debug';
import http from 'http';

import ClientManager from './lib/ClientManager';
import { getClientId, generateClientId } from './lib/clientId';

/*::
import type { ClientManagerOptions } from './lib/ClientManager';

type ServerOptions = {
  secure?: boolean,
  homepage?: string,
  level?: number,
}

type Opts = ClientManagerOptions & ServerOptions
*/

const debug = Debug('localtunnel:server');

module.exports = function(opt /*: Opts */ = {}) {
  const manager = new ClientManager(opt);

  const schema = opt.secure ? 'https' : 'http';

  const app = new Koa();

  // api status endpoint
  app.use(async (ctx, next) => {
    const path = ctx.request.path;
    if (path !== '/api/status') {
      await next();
      return;
    }

    const stats = manager.stats;

    ctx.body = {
      tunnels: stats.tunnels,
      mem: process.memoryUsage(),
    };
  });

  // root endpoint
  app.use(async (ctx, next) => {
    const path = ctx.request.path;

    // skip anything not on the root path
    if (path !== '/') {
      await next();
      return;
    }

    const isNewClientRequest = ctx.query['new'] !== undefined;
    if (isNewClientRequest) {
      const req_id = generateClientId();
      debug('making new client with id %s', req_id);
      const info = await manager.newClient(req_id);

      const url = schema + '://' + info.id + '.' + ctx.request.host;
      info.url = url;
      ctx.body = info;
      return;
    }

    // no new client request, send to homepage
    ctx.redirect(opt.homepage || 'https://localtunnel.github.io/www/');
  });

  // anything after the / path is a request for a specific client name
  // This is a backwards compat feature
  app.use(async (ctx, next) => {
    const parts = ctx.request.path.split('/');

    // any request with several layers of paths is not allowed
    // rejects /foo/bar
    // allow /foo
    if (parts.length !== 2) {
      await next();
      return;
    }

    const req_id = parts[1];

    // limit requested hostnames to 63 characters
    if (!/^[a-z0-9]{4,63}$/.test(req_id)) {
      const msg =
        'Invalid subdomain. Subdomains must be lowercase and between 4 and 63 alphanumeric characters.';
      ctx.status = 403;
      ctx.body = {
        message: msg,
      };
      return;
    }

    debug('making new client with id %s', req_id);
    const info = await manager.newClient(req_id);

    const url = schema + '://' + info.id + '.' + ctx.request.host;
    info.url = url;
    ctx.body = info;
    return;
  });

  const server = http.createServer();

  const appCallback = app.callback();
  server.on('request', (req, res) => {
    // without a hostname, we won't know who the request is for
    const hostname = req.headers.host;
    if (!hostname) {
      res.statusCode = 400;
      debug('missing host header');
      res.end('Host header is required');
      return;
    }

    const clientId = getClientId(hostname, opt.level);
    if (!clientId) {
      appCallback(req, res);
      return;
    }

    if (manager.hasClient(clientId)) {
      manager.handleRequest(clientId, req, res);
      return;
    }

    debug('unknown client', clientId);
    res.statusCode = 404;
    res.end('404');
  });

  server.on('upgrade', (req, socket) => {
    const hostname = req.headers.host;
    debug('upgrade', hostname);
    if (!hostname) {
      socket.destroy();
      return;
    }

    const clientId = getClientId(hostname, opt.level);
    if (!clientId) {
      debug('missing clientId');
      socket.destroy();
      return;
    }

    if (manager.hasClient(clientId)) {
      manager.handleUpgrade(clientId, req, socket);
      return;
    }

    debug('no such client', clientId);
    socket.destroy();
  });

  return server;
};
