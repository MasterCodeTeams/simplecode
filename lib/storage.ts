import { getSupabaseAdmin } from "./supabase";

const BUCKET = "community-uploads";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// Terima gambar dalam bentuk base64 data URL (dari <input type="file"> di
// browser), upload ke Supabase Storage, balikin URL publiknya.
export async function uploadCommunityImage(
  login: string,
  dataUrl: string
): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Format gambar gak valid");

  const mimeType = match[1];
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Tipe gambar gak didukung (cuma PNG/JPEG/GIF/WEBP)");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error("Ukuran gambar maksimal 5MB");
  }

  const ext = mimeType.split("/")[1];
  const filename = `${login.replace(/[^a-zA-Z0-9_-]/g, "_")}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(
      `Gagal upload gambar: ${error.message}. Pastikan bucket "${BUCKET}" udah dibuat di Supabase Storage (public).`
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}
