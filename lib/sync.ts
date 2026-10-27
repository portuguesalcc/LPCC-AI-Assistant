import { DocumentState, type Document } from "@google/genai";
import { requireEnv } from "./config";
import { downloadFile, isSupported, listFolderRecursive } from "./drive";
import { gemini, getStoreName } from "./gemini";

const DRIVE_ID_KEY = "drive_file_id";
const DRIVE_MODIFIED_KEY = "drive_modified_time";

export type SyncReport = {
  added: string[];
  updated: string[];
  removed: string[];
  unchanged: number;
  skipped: string[];
  errors: string[];
  finished: boolean;
};

function metadata(doc: Document, key: string): string | undefined {
  return doc.customMetadata?.find((m) => m.key === key)?.stringValue;
}

/**
 * Makes the File Search store mirror the Drive folder.
 * Each uploaded document carries its Drive file ID and modified time as metadata,
 * so the store itself records what has already been synced.
 * Stops early (finished: false) if the time budget runs out; the next run continues.
 */
export async function syncDriveToFileSearch(deadline: number): Promise<SyncReport> {
  const report: SyncReport = {
    added: [],
    updated: [],
    removed: [],
    unchanged: 0,
    skipped: [],
    errors: [],
    finished: false,
  };

  const storeName = (await getStoreName({ create: true }))!;
  const allFiles = await listFolderRecursive(requireEnv("GOOGLE_DRIVE_FOLDER_ID"));
  const files = allFiles.filter((f) => {
    if (isSupported(f)) return true;
    report.skipped.push(f.name);
    return false;
  });
  const driveIds = new Set(files.map((f) => f.id));

  const docsByDriveId = new Map<string, Document[]>();
  const pager = await gemini().fileSearchStores.documents.list({ parent: storeName });
  for await (const doc of pager) {
    const driveId = metadata(doc, DRIVE_ID_KEY) ?? "";
    docsByDriveId.set(driveId, [...(docsByDriveId.get(driveId) ?? []), doc]);
  }

  const deleteDoc = (doc: Document) =>
    gemini().fileSearchStores.documents.delete({ name: doc.name!, config: { force: true } });

  // Files removed from Drive (or documents without a Drive ID) are removed from the store.
  for (const [driveId, docs] of docsByDriveId) {
    if (driveIds.has(driveId)) continue;
    for (const doc of docs) {
      try {
        await deleteDoc(doc);
        report.removed.push(doc.displayName ?? doc.name!);
      } catch (err) {
        report.errors.push(`Remover ${doc.displayName}: ${String(err)}`);
      }
    }
  }

  for (const file of files) {
    if (Date.now() > deadline) return report;

    const existing = docsByDriveId.get(file.id) ?? [];
    const current = existing.find(
      (d) =>
        metadata(d, DRIVE_MODIFIED_KEY) === file.modifiedTime &&
        d.state !== DocumentState.STATE_FAILED,
    );
    if (current) {
      report.unchanged++;
      continue;
    }

    try {
      // Upload the new version first, then remove old ones, so the bot never goes blank.
      await gemini().fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName,
        file: await downloadFile(file),
        config: {
          displayName: file.name,
          customMetadata: [
            { key: DRIVE_ID_KEY, stringValue: file.id },
            { key: DRIVE_MODIFIED_KEY, stringValue: file.modifiedTime },
          ],
        },
      });
      for (const old of existing) await deleteDoc(old);
      (existing.length > 0 ? report.updated : report.added).push(file.name);
    } catch (err) {
      report.errors.push(`${file.name}: ${String(err)}`);
    }
  }

  report.finished = true;
  return report;
}
