import { describe, expect, it } from 'vitest';
import { showPreviewAccess } from './preview-access';

describe('preview-only CMS access', () => {
  it('shows access in local development', () => {
    expect(showPreviewAccess(true, 'localhost', '/', null)).toBe(true);
  });
  it('shows access in the Lovable development preview', () => {
    expect(showPreviewAccess(false, 'id-preview--163c7967-d238-4f84-b24c-278935268606.lovable.app', '/', null)).toBe(true);
  });
  it('hides access on the published master', () => {
    expect(showPreviewAccess(false, 'pagecraft-foundry.lovable.app', '/', null)).toBe(false);
  });
  it('hides access on client domains', () => {
    expect(showPreviewAccess(false, 'www.oldskool-outdoor.nl', '/', null)).toBe(false);
  });
  it('hides the shortcut inside CMS management', () => {
    expect(showPreviewAccess(true, 'localhost', '/smart-websites/sites', null)).toBe(false);
  });
  it('hides the shortcut in the editor and read-only preview', () => {
    expect(showPreviewAccess(true, 'localhost', '/', 'edit')).toBe(false);
    expect(showPreviewAccess(true, 'localhost', '/', 'preview')).toBe(false);
  });
});