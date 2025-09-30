module.exports = function override(config) {
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    crypto: false,
  };
  return config;
};
