const { register, getAdapter, getAllAdapters, getConfigDefaults, getPlatformInfo } = require('./shared/registry')
const IfoodAdapter = require('./ifood/adapter')
const NinetyNineFoodAdapter = require('./ninetyNineFood/adapter')

function setup() {
  register(new IfoodAdapter())
  register(new NinetyNineFoodAdapter())
  return { getAdapter, getAllAdapters, getConfigDefaults, getPlatformInfo }
}

module.exports = setup
