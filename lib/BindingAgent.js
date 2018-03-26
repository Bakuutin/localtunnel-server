// @flow

import http from 'http';
import assert from 'assert';

/*::
import net from 'net';
type Options = http$agentOptions & { socket: net.Socket }
*/

// binding agent will return a given options.socket as the socket for the agent
// this is useful if you already have a socket established and want the request
// to use that socket instead of making a new one
export default class BindingAgent extends http.Agent {
  socket /*: net.Socket */;

  constructor(options /*: Options */) {
    assert(options.socket, 'socket is required for BindingAgent');
    super(options);
    this.socket = options.socket;
  }

  createConnection() {
    return this.socket;
  }
}
