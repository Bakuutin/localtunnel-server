# localtunnel-server

This is a fork of [localtunnel/server](https://github.com/localtunnel/server) that supports second-level as well as third-level domains.

## Additional Options

In addition to the original CLI this fork adds the following options:

* `--level` The level of the domain that contains the client-id (defaults to 2). Set it to `3` to use a domain like `<client-id>.tunnel.example.com`.
* `--homepage` The URL of a documentation page that is displayed when no new client is request.

Alternatively you can provide these options by setting the `LEVEL` and `HOMEPAGE` environment variables.

## Changes

* `/api/status` can be requested without a (valid) host header to support AWS health checks.
* The server port defaults to `process.env.PORT`.
* Static typings have been added via flow.
* Code is formatted with prettier and refactored to ES6.
