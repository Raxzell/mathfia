/* Memuat mesin game dari ../js ke dalam proses server. Hanya modul yang dibutuhkan server. */
'use strict';
var path = require('path');
['fraction', 'cards', 'deck', 'solver', 'parser', 'bot', 'game'].forEach(function (f) {
  require(path.join(__dirname, '..', 'js', f + '.js'));
});
module.exports = globalThis.G24;
