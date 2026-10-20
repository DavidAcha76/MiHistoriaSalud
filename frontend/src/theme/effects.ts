import { Platform, type ViewStyle } from 'react-native';

/**
 * Degradado CSS: en web usa background-image y en la nueva arquitectura nativa
 * experimental_backgroundImage. Siempre se combina con un backgroundColor de respaldo.
 */
export function gradient(value: string): ViewStyle {
  return (Platform.OS === 'web' ? { backgroundImage: value } : { experimental_backgroundImage: value }) as ViewStyle;
}

/** Sombra con la sintaxis CSS que aceptan React Native y react-native-web. */
export function shadow(value: string): ViewStyle {
  return { boxShadow: value };
}
