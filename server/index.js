/*
 * Server Mathfia, Langkah 2: satu room, dua pemain, Socket.IO.
 *   node index.js                 -> http://127.0.0.1:3024
 *   HOST=0.0.0.0 node index.js    -> bisa dibuka dari HP di Wi-Fi yang sama (jalankan sendiri)
 *
 * Klien -> server: join({nickname}), toggle(bool), pick(pid), submit(tokens). Semua pakai ack(reply).
 * Server -> klien: state(snapshot), event({type, data}), fail({error}).
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var SocketIO = require('socket.io');
var G = require('./engine');
var Room = require('./room').Room;

var TICK_MS = 100;
var DEV_CLIENT = path.join(__dirname, 'dev-client.html');

function createServer(opts) {
  opts = opts || {};
  var httpServer = http.createServer(function (req, res) {
    // Hanya satu halaman uji. Tidak ada folder statis, jadi tidak ada risiko path traversal.
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      fs.readFile(DEV_CLIENT, function (err, buf) {
        if (err) { res.writeHead(500); res.end('dev-client tidak ada'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });

  var io = new SocketIO.Server(httpServer, { maxHttpBufferSize: 10000, serveClient: true });
  var room = new Room({ G: G, observeMs: opts.observeMs, rng: opts.rng, clock: opts.clock });

  io.on('connection', function (socket) {
    function send(ev, data) { socket.emit(ev, data); }
    function reply(ack, r) {
      if (typeof ack === 'function') ack(r);
      else if (r && !r.ok) socket.emit('fail', { error: r.error });
    }
    socket.on('join', function (p, ack) {
      var name = p && typeof p === 'object' ? p.nickname : null;
      reply(ack, room.join(socket.id, name, send));
    });
    ['toggle', 'pick', 'submit'].forEach(function (type) {
      socket.on(type, function (payload, ack) { reply(ack, room.action(socket.id, type, payload)); });
    });
    socket.on('disconnect', function () { room.leave(socket.id); });
  });

  var timer = setInterval(function () { room.tick(); }, TICK_MS);

  return {
    httpServer: httpServer, io: io, room: room,
    listen: function (port, host, cb) { httpServer.listen(port, host, cb); },
    close: function (cb) { clearInterval(timer); io.close(); httpServer.close(function () { if (cb) cb(); }); }
  };
}

if (require.main === module) {
  var HOST = process.env.HOST || '127.0.0.1';
  var PORT = parseInt(process.env.PORT, 10) || 3024;
  var srv = createServer();
  srv.listen(PORT, HOST, function () {
    console.log('Mathfia server jalan di http://' + HOST + ':' + PORT);
    if (HOST === '0.0.0.0') console.log('Peringatan: server terbuka untuk semua perangkat di jaringan ini.');
  });
}

module.exports = { createServer: createServer };
