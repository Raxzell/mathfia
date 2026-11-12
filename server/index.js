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
var ROOT = path.join(__dirname, '..');
var TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

// Daftar file yang boleh dikirim ke browser (mode dev). Hosting statis terpisah baru di Langkah 4.
var STATIC = { '/dev': path.join(__dirname, 'dev-client.html') };
['index.html', 'style.css'].forEach(function (f) { STATIC['/' + f] = path.join(ROOT, f); });
STATIC['/'] = STATIC['/index.html'];
['fraction', 'cards', 'deck', 'solver', 'parser', 'bot', 'game', 'i18n', 'sound', 'net', 'ui'].forEach(function (f) {
  STATIC['/js/' + f + '.js'] = path.join(ROOT, 'js', f + '.js');
});

function createServer(opts) {
  opts = opts || {};
  var httpServer = http.createServer(function (req, res) {
    // Hanya file di daftar putih STATIC. Tidak ada folder bebas, jadi tidak ada path traversal.
    var url = (req.url || '').split('?')[0];
    var file = req.method === 'GET' && STATIC.hasOwnProperty(url) ? STATIC[url] : null;
    if (file) {
      fs.readFile(file, function (err, buf) {
        if (err) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('file tidak ada'); return; }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
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
