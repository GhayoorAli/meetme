import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "meetme_token";

function hostKey(code: string) {
  return `meetme_host_${code}`;
}

function admitKey(code: string) {
  return `meetme_admit_${code}`;
}

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getHostToken(code: string) {
  return SecureStore.getItemAsync(hostKey(code));
}

export async function setHostToken(code: string, token: string) {
  await SecureStore.setItemAsync(hostKey(code), token);
}

export async function getAdmitToken(code: string) {
  return SecureStore.getItemAsync(admitKey(code));
}

export async function setAdmitToken(code: string, token: string) {
  await SecureStore.setItemAsync(admitKey(code), token);
}

export async function clearAdmitToken(code: string) {
  await SecureStore.deleteItemAsync(admitKey(code));
}
