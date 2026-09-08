export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
