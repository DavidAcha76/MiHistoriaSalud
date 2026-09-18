import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

/** React Native Alert no presenta diálogos en web. Conserva la confirmación en ambas plataformas. */
export const AppAlert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    if (Platform.OS !== 'web') return Alert.alert(title, message, buttons, options);
    const content = [title, message].filter(Boolean).join('\n\n');
    const action = buttons?.find((button) => button.style !== 'cancel');
    if (buttons && buttons.length > 1) {
      if (window.confirm(content)) action?.onPress?.();
      else buttons.find((button) => button.style === 'cancel')?.onPress?.();
    } else {
      window.alert(content);
      action?.onPress?.();
    }
  }
};
