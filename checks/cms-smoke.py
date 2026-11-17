"""CMS smoke test: visible icons and side padding in dashboard/editor text buttons.
Run after every CMS update: python3 scripts/cms-smoke.py  (dev server on :8080, signed-in session minted)."""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("CMS_BASE", "http://localhost:8080")
PAGES = ["/smart-websites"]
CHECK = """() => [...document.querySelectorAll('.sw-admin button, .sw-admin a[data-slot=button], [data-cms-toolbar] button, [data-cms-toolbar] a[data-slot=button]')]
 .filter(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden')
 .flatMap(b => {
   const label = b.getAttribute('aria-label') || b.textContent.trim().slice(0,30);
   const failures = [];
   for (const svg of b.querySelectorAll('svg')) {
     const s = svg.getBoundingClientRect();
     if (s.width < 1 || s.height < 1) failures.push({label, issue:'invisible icon', w:s.width, h:s.height});
   }
   if (b.matches('[data-slot="button"]') && b.textContent.trim() && !b.classList.contains('size-icon')) {
     const s = getComputedStyle(b);
     if (parseFloat(s.paddingLeft) < 12 || parseFloat(s.paddingRight) < 12)
       failures.push({label, issue:'missing text padding', left:s.paddingLeft, right:s.paddingRight});
   }
   if (b.matches('.bg-cms-action, .bg-cms-brand')) {
     const s = getComputedStyle(b);
     const probe = document.createElement('span');
     probe.style.backgroundColor = b.classList.contains('bg-cms-action') ? 'var(--cms-blue)' : 'var(--cms-brand)';
     probe.style.color = 'var(--cms-brand-foreground)';
     b.appendChild(probe);
     const expected = getComputedStyle(probe);
     if (s.backgroundColor !== expected.backgroundColor || s.color !== expected.color)
       failures.push({label, issue:'client reset overrides brand button', background:s.backgroundColor, color:s.color});
     probe.remove();
   }
   return failures;
 })"""

def session():
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
        return os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    m = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    return m["storage_key"], json.dumps(m["session"])

async def main():
    key, sess = session(); failures = []
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for w in (1280, 770, 390):
            page = await (await b.new_context(viewport={"width": w, "height": 1800})).new_page()
            await page.goto(BASE); await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [key, sess])
            for path in PAGES:
                await page.goto(BASE + path); await page.wait_for_selector(".sw-admin button svg", timeout=20000)
                await page.wait_for_timeout(800)
                # Reproduce the unlayered button reset on existing client websites.
                await page.add_style_tag(content='button { background-color: transparent; border-width: 0; }')
                assert await page.locator('.sw-admin a[aria-label="Helpdesk"]').count() == 1, 'Helpdesk ontbreekt in paginaoverzicht'
                for f in await page.evaluate(CHECK): failures.append((w, path, f))
                edit = page.locator('a[title="Bewerken"]').first
                if await edit.count() == 0:
                    raise AssertionError('Geen pagina gevonden om de editor te controleren')
                await edit.click()
                await page.wait_for_selector('[data-cms-toolbar]', timeout=20000)
                await page.wait_for_timeout(800)
                await page.add_style_tag(content='button { background-color: transparent; border-width: 0; }')
                assert await page.locator('[data-cms-toolbar] a[aria-label="Helpdesk"]').count() == 1, 'Helpdesk ontbreekt in editor'
                for f in await page.evaluate(CHECK): failures.append((w, page.url, f))
        await b.close()
    for f in failures: print("KNOPFOUT:", f)
    print("OK" if not failures else f"{len(failures)} fout(en)"); sys.exit(1 if failures else 0)

asyncio.run(main())
