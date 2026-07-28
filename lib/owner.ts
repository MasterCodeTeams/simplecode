// Username GitHub yang jadi pemilik resmi Master Code — cuma akun ini yang
// boleh buka Owner Panel (statistik user, dsb). Sengaja di-hardcode (bukan
// env var) karena ini identitas tetap si owner, bukan konfigurasi per-deploy.
export const OWNER_LOGIN = "MasterCodeTeams";

export function isOwner(login?: string | null): boolean {
  if (!login) return false;
  return login.toLowerCase() === OWNER_LOGIN.toLowerCase();
}
