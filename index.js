var env = require('envalid');
var librato = require('librato-node');
var allcontainers = require('docker-allcontainers');
var dockerstats = require('docker-stats');
var through = require('through2');

env.validate(process.env, {
  LIBRATO_EMAIL: {required: true},
  LIBRATO_TOKEN: {required: true},
});

console.log('Starting Librato...');
librato.configure({
  email: env.get('LIBRATO_EMAIL'),
  token: env.get('LIBRATO_TOKEN'),
});

librato.start();

console.log('Starting Docker event stream...');
var stats = dockerstats({
  docker: null,
  events: allcontainers({preheat: true, docker:null})
});

process.on('SIGTERM', function () {
  console.log('Shutting down gracefully...');
  librato.stop();
  stats.destroy();
  process.exit(0);
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
  };

  if(chunk.stats.network) {
    info.network_rx = chunk.stats.network.rx_bytes;
    info.network_tx = chunk.statsr.network.tx_bytes;
  }

  updateContainer(name, info)
  callback();
}

function updateContainer (name, info) {
  console.log('updating stats for ' + name, info);
  for (var prop in info) {
    if(info.hasOwnProperty(prop)) {
      librato.measure('docker-container-' + prop, info[prop], { source: name });
    }
  }
}
