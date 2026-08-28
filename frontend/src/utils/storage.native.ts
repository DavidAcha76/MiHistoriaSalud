import * as SecureStore from 'expo-secure-store';

export const getItem = SecureStore.getItemAsync;
export const setItem = SecureStore.setItemAsync;
export const deleteItem = SecureStore.deleteItemAsync;
