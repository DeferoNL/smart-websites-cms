export type MediaFolder = { id: string; name: string };
export type MediaFolderKey = 'all' | 'icons' | `f:${string}`;

export function belongsToMediaFolder(item: { folderId?: string | null }, folder: MediaFolderKey) {
  return folder === 'all' || (folder.startsWith('f:') && item.folderId === folder.slice(2));
}

export function mediaFolderName(folderId: string | null | undefined, folders: MediaFolder[]) {
  return folders.find(folder => folder.id === folderId)?.name ?? 'Mijn Bestanden';
}