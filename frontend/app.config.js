module.exports = ({ config }) => {
  const local = process.env.APP_VARIANT === 'local' || process.env.EAS_BUILD_PROFILE === 'development';
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!local && apiUrl && !apiUrl.startsWith('https://')) {
    throw new Error('Las compilaciones publicadas deben usar HTTPS. Para una app local usa APP_VARIANT=local.');
  }
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(local ? {
          NSLocalNetworkUsageDescription: 'Permite conectar con el backend de pruebas en tu computadora.',
          NSAppTransportSecurity: { NSAllowsArbitraryLoads: true }
        } : {})
      }
    },
    plugins: [
      ...(config.plugins || []),
      '@react-native-community/datetimepicker',
      ['expo-build-properties', { android: { usesCleartextTraffic: local } }]
    ]
  };
};
