const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const {
  getBundleModeMetroConfig,
} = require('react-native-worklets/bundleMode');

const root = path.resolve(__dirname, '..');

let config = getDefaultConfig(__dirname);

config.watchFolders = [root];
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(root, 'node_modules'),
  ],
};

config = getBundleModeMetroConfig(config);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      inlineRequires: true,
    },
  }),
};

module.exports = config;
