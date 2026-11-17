import { describe, expect, it } from 'vitest';
import { ADMIN_ONLY_PERMISSIONS, defaultRolePermissions, roleAssignment, rolePermissionAllowed } from './roles';
describe('Afgesproken standaardrollen', () => {
  it('Klant Basis mag tekst, foto’s, formulieren en statistieken, geen structuur', () => {
    expect(defaultRolePermissions('basic')).toEqual({ text:true, images:true, forms:true, stats:true, blocks:false, translate:false, activity:false, pages:false, settings:false, backups:false, users:false, dns:false, updates:false, restore:false, buttonColors:false });
  });
  it('Klant Advanced krijgt blokken, vertalingen en activiteit, geen pagina- of instellingenbeheer', () => {
    expect(defaultRolePermissions('advanced')).toEqual({ text:true, images:true, forms:true, stats:true, blocks:true, translate:true, activity:true, pages:false, settings:false, backups:false, users:false, dns:false, updates:false, restore:false, buttonColors:false });
  });
  it('Webbouwer mag pagina’s, instellingen, knopkleuren en back-ups maken en herstellen', () => {
    expect(defaultRolePermissions('webbuilder')).toEqual({ text:true, images:true, forms:true, stats:true, blocks:true, translate:true, activity:true, pages:true, settings:true, backups:true, users:false, dns:false, updates:false, restore:true, buttonColors:true });
  });
  it('Alleen Administrator en Webbouwer krijgen knopkleuren en herstel in de standaardrollen', () => {
    for (const key of ['buttonColors', 'restore']) {
      expect(defaultRolePermissions('webbuilder')[key]).toBe(true);
      expect(defaultRolePermissions('basic')[key]).toBe(false);
      expect(defaultRolePermissions('advanced')[key]).toBe(false);
      expect(rolePermissionAllowed(true, {}, key)).toBe(true);
    }
  });
  for (const key of ADMIN_ONLY_PERMISSIONS) {
    it(`Alleen Administrator krijgt ${key}, ook niet via een extra rol`, () => {
      expect(rolePermissionAllowed(false, { [key]:true }, key)).toBe(false);
      expect(rolePermissionAllowed(true, {}, key)).toBe(true);
    });
  }
  it('Eén rolkeuze levert een eenduidige toekenning op', () => {
    expect(roleAssignment('admin')).toEqual({role:'admin',cmsRoleId:null});
    expect(roleAssignment('basis-id')).toEqual({role:'editor',cmsRoleId:'basis-id'});
    expect(() => roleAssignment('')).toThrow();
  });
});