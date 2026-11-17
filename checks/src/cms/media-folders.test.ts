import { describe, expect, it } from 'vitest';
import { belongsToMediaFolder, mediaFolderName } from './media-folders';

describe('media folder choices', () => {
  it('shows all files in the main folder, including files in extra folders', () => {
    expect(belongsToMediaFolder({ folderId: null }, 'all')).toBe(true);
    expect(belongsToMediaFolder({ folderId: 'photos' }, 'all')).toBe(true);
    expect(belongsToMediaFolder({}, 'all')).toBe(true);
  });
  it('shows only assigned files in an extra folder', () => {
    expect(belongsToMediaFolder({ folderId: 'photos' }, 'f:photos')).toBe(true);
    expect(belongsToMediaFolder({ folderId: null }, 'f:photos')).toBe(false);
    expect(belongsToMediaFolder({ folderId: 'other' }, 'f:photos')).toBe(false);
  });
  it('uses the main folder as the default destination', () => {
    expect(mediaFolderName(null, [{ id: 'photos', name: 'Fotos' }])).toBe('Mijn Bestanden');
  });
  it('reports the selected file’s current extra folder', () => {
    expect(mediaFolderName('photos', [{ id: 'photos', name: 'Fotos' }])).toBe('Fotos');
  });
});