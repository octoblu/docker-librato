const _              = require('lodash')
const envalid        = require('envalid')
const librato        = require('librato-node')
const allcontainers  = require('docker-allcontainers')
const dockerstats    = require('docker-stats')
const through        = require('through2')
const SigtermHandler = require('sigterm-handler')
const debug          = require('debug')('docker-librato')

const {
  str,
  email,
  num,
} = envalid

const env = envalid.cleanEnv(process.env, {
  LIBRATO_EMAIL : email(),
  LIBRATO_TOKEN : str(),
  LIBRATO_PERIOD: num({ default: 1000 * 60 * 3 }),
  CLUSTER_NAME  : str(),
});

console.log('Starting Librato...');

librato.configure({
  email: env.LIBRATO_EMAIL,
  token: env.LIBRATO_TOKEN,
  period: env.LIBRATO_PERIOD,
});

librato.start();

librato.on('error', function(error) {
  console.error('Librato Error', error)
})

console.log('Starting Docker event stream...');
const stats = dockerstats({
  docker: null,
  events: allcontainers({ preheat: true, docker:null })
});

sigtermHandler = new SigtermHandler({ events: ['SIGINT', 'SIGTERM']})

sigtermHandler.register(librato.stop)
sigtermHandler.register(function(callback) {
  stats.destroy()
  callback()
})

stats.pipe(through.obj(update));

function update(chunk, enc, callback) {
  var info
  const { name, image } = chunk

  try {
    info = {
      pcpu: chunk.stats.cpu_stats.cpu_usage.cpu_percent,
      memory: chunk.stats.memory_stats.stats.total_rss,
      memory_usage: chunk.stats.memory_stats.usage,
      memory_limit: chunk.stats.memory_stats.limit,
      memory_cached: chunk.stats.memory_stats.stats.total_cache,
    }

    if (chunk.stats.network) {
      info.network_rx = chunk.stats.network.rx_bytes
      info.network_tx = chunk.statsr.network.tx_bytes
    }

  } catch(error) {
    console.error('Docker Usage Error', error)
    callback(error)
    return
  }

  updateContainer({ name, image }, info)
  callback()
}

function getSourceName({ image, name }) {
  const imageName = _.tail(_.split(image, '/'))
  return `${env.CLUSTER_NAME}:${imageName}:${name}`;
}

function updateContainer({ image, name }, info) {
  debug(`Updating stats for ${getSourceName({ image, name })}`, info)
  _.each(info, function(value, key) {
    librato.measure(`docker-container-${key}`, value, { source: getSourceName({ image, name }) })
  })
}
