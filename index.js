var env = require('envalid');
var librato = require('librato-node');
var allcontainers = require('docker-allcontainers');
var dockerstats = require('docker-stats');
var through = require('through2');

env.validate(process.env, {
  LIBRATO_EMAIL: {required: true},
  LIBRATO_TOKEN: {required: true},
});

librato.configure({
  email: env.get('LIBRATO_EMAIL'),
  token: env.get('LIBRATO_TOKEN'),
});

// start librato
librato.start();

var stats = dockerstats({
  docker: null,
  events: allcontainers({docker:null})
});

stats.pipe(through.obj(update));

function update(chunk, enc, callback) {
  var name = chunk.name;
  var info = {
    pcpu: chunk.stats.cpu_stats.cpu_usage.cpu_percent,
    memory: chunk.stats.memory_stats.stats.total_rss,
    memory_usage: chunk.stats.memory_stats.usage,
    memory_limit: chunk.stats.memory_stats.limit,
    memory_cached: chunk.stats.memory_stats.stats.total_cache,
    network_rx: chunk.stats.network.rx_bytes,
    network_tx: chunk.stats.network.tx_bytes,
  };

  updateContainer(name, info)
  callback();
}

function updateContainer (name, info) {
  for (var prop in info) {
    if(info.hasOwnProperty(prop)) {
      librato.measure('docker-container-' + prop, info[prop], { source: name });
    }
  }
}
