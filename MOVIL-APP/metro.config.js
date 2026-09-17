const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Admins use web heavily — keep module resolution stable for Expo packages.
const topLevelCore = path.resolve(projectRoot, 'node_modules/expo-modules-core');
const nestedCore = path.resolve(
  projectRoot,
  'node_modules/expo/node_modules/expo-modules-core'
);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'expo-modules-core': fs.existsSync(topLevelCore) ? topLevelCore : nestedCore,
};

module.exports = config;
