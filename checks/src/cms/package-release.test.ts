import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('Public CMS release integrity', () => {
  it('accepts a clean export and rejects modified, extra or unsafe files', () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'cms-release-'));
    const output = path.join(temporary, 'package');
    const verify = () => execFileSync('node', ['scripts/verify-cms-release.mjs', output], { stdio: 'pipe' });
    try {
      execFileSync('node', ['scripts/export-cms-package.mjs', '--output', output]);
      expect(verify().toString()).toContain('Verified CMS');
      const file = path.join(output, 'README.md');
      const original = readFileSync(file);
      writeFileSync(file, 'tampered');
      expect(verify).toThrow();
      writeFileSync(file, original);
      writeFileSync(path.join(output, '.env'), 'unexpected');
      expect(verify).toThrow();
      rmSync(path.join(output, '.env'));
      const releasePath = path.join(output, 'release.json');
      const release = JSON.parse(readFileSync(releasePath, 'utf8'));
      release.files.push({ file: '../outside', sha256: '0'.repeat(64) });
      writeFileSync(releasePath, JSON.stringify(release));
      expect(verify).toThrow();
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }, 30000);
});