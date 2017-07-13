const Stumble = require('stumble')

const s = new Stumble(require('data/config.json'))
s.use(require('./extension'))

s.connect()
module.exports = s
