const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase no React Native: com o campo "exports" o Metro mistura arquivos
// cjs e esm do Firebase, carregando duas cópias de @firebase/component, e o
// app quebra com "Component auth has not been registered yet".
// Para os pacotes do Firebase (e só para eles) o Metro ignora "exports" e usa
// o campo "react-native" do package.json, como o Firebase espera.
config.resolver.sourceExts.push('cjs');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('firebase/') || moduleName.startsWith('@firebase/')) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
