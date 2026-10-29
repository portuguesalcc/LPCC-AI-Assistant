import { JWT } from "google-auth-library";
import { requireEnv } from "./config";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  /** Bytes; Google Docs/Sheets/Slides don't report a size. */
  size?: string;
};

// Larger files are skipped: they would not fit comfortably in the sync function's memory.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

// Google Workspace files can't be downloaded directly; they are exported instead.
const EXPORTS: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};

const SUPPORTED_UPLOADS = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
]);

let auth: JWT | null = null;

function driveAuth(): JWT {
  if (!auth) {
    const creds = JSON.parse(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
    auth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
  }
  return auth;
}

export function isSupported(file: DriveFile): boolean {
  return file.mimeType in EXPORTS || SUPPORTED_UPLOADS.has(file.mimeType);
}

export function isTooLarge(file: DriveFile): boolean {
  return Number(file.size ?? 0) > MAX_FILE_BYTES;
}

/** Lists every file in the folder and its subfolders (trashed files excluded). */
export async function listFolderRecursive(folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  const pending = [folderId];

  while (pending.length > 0) {
    const parent = pending.pop()!;
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: `'${parent.replace(/['\\]/g, "\\$&")}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
        pageSize: "200",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);

      const res = await driveAuth().request<{ files: DriveFile[]; nextPageToken?: string }>({
        url: `${DRIVE_API}?${params}`,
      });
      for (const file of res.data.files ?? []) {
        if (file.mimeType === FOLDER_MIME) pending.push(file.id);
        else files.push(file);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  }

  return files;
}

/** Downloads (or exports) a Drive file and returns it as a Blob ready for upload. */
export async function downloadFile(file: DriveFile): Promise<Blob> {
  const exportMime = EXPORTS[file.mimeType];
  const url = exportMime
    ? `${DRIVE_API}/${file.id}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `${DRIVE_API}/${file.id}?alt=media&supportsAllDrives=true`;

  const res = await driveAuth().request<ArrayBuffer>({ url, responseType: "arraybuffer" });
  return new Blob([res.data], { type: exportMime ?? file.mimeType });
}
