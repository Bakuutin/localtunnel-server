// @flow

import net from 'net';
import EventEmitter from 'events';
import Debug from 'debug';

export default class Proxy extends EventEmitter {
  id /*: string */;
  debug /*: Function */;
  connTimeout /*: TimeoutID */;
  max_tcp_sockets /*: number */;
  server /*: net.Server */;
  sockets = [];
  waiting = [];
  started = false;
  activeSockets = 0;

  constructor(opt /*: Object */) {
    super();
    this.id = opt.id;
    this.max_tcp_sockets = opt.max_tcp_sockets || 10;

    // new tcp server to service requests for this client
    this.server = net.createServer();
    this.debug = Debug(`localtunnel:server:${this.id}`);
  }

  cleanup = () => {
    this.debug('closed tcp socket for client(%s)', this.id);
    clearTimeout(this.connTimeout);
    // clear waiting by ending responses, (requests?)
    this.waiting.forEach(handler => handler(null));
    this.emit('end');
  };

  // new socket connection from client for tunneling requests to client
  handleSocket = (socket /*: net.Socket */) => {
    // no more socket connections allowed
    if (this.activeSockets >= this.max_tcp_sockets) {
      return socket.end();
    }

    this.activeSockets++;

    this.debug(
      'new connection from: %s:%s',
      socket.address().address,
      socket.address().port
    );

    // a single connection is enough to keep client id slot open
    clearTimeout(this.connTimeout);

    socket.once('close', hadError => {
      this.activeSockets--;
      this.debug('closed socket (error: %s)', hadError);

      // what if socket was servicing a request at this time?
      // then it will be put back in available after right?
      // we need a list of sockets servicing requests?

      // remove this socket
      const idx = this.sockets.indexOf(socket);
      if (idx >= 0) {
        this.sockets.splice(idx, 1);
      }

      // need to track total sockets, not just active available
      this.debug('remaining client sockets: %s', this.sockets.length);

      // no more sockets for this ident
      if (this.sockets.length === 0) {
        this.debug('all sockets disconnected');
        this.maybeDestroy();
      }
    });

    // close will be emitted after this
    socket.on('error', () => {
      // we don't log here to avoid logging crap for misbehaving clients
      socket.destroy();
    });

    this.sockets.push(socket);
    this.processWaiting();
  };

  start(cb /*: Function */) {
    if (this.started) {
      cb(new Error('already started'));
      return;
    }
    this.started = true;

    const server = this.server;
    server.on('close', this.cleanup);
    server.on('connection', this.handleSocket);

    server.on('error', err => {
      // where do these errors come from?
      // other side creates a connection and then is killed?
      if (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT') {
        return;
      }
      console.error(err);
    });

    server.listen(() => {
      const port = server.address().port;
      this.debug('tcp server listening on port: %d', port);

      cb(null, {
        // port for lt client tcp connections
        port: port,
        // maximum number of tcp connections allowed by lt client
        max_conn_count: this.max_tcp_sockets,
      });
    });

    this.maybeDestroy();
  }

  maybeDestroy() {
    clearTimeout(this.connTimeout);

    // After last socket is gone, we give opportunity to connect again quickly
    this.connTimeout = setTimeout(() => {
      // sometimes the server is already closed but the event has not fired?
      try {
        clearTimeout(this.connTimeout);
        this.server.close();
      } catch (err) {
        this.cleanup();
      }
    }, 1000);
  }

  processWaiting() {
    const fn = this.waiting.shift();
    if (fn) {
      this.debug('handling queued request');
      this.nextSocket(fn);
    }
  }

  async nextSocket(fn /*: Function */) {
    // socket is a tcp connection back to the user hosting the site
    const sock = this.sockets.shift();
    if (!sock) {
      this.debug('no more clients, queue callback');
      this.waiting.push(fn);
      return;
    }

    this.debug('processing request');
    await fn(sock);

    // $FlowFixMe https://github.com/facebook/flow/issues/4520
    if (!sock.destroyed) {
      this.debug('retuning socket');
      this.sockets.push(sock);
    }

    // no sockets left to process waiting requests
    if (this.sockets.length === 0) {
      return;
    }

    this.processWaiting();
  }
}
