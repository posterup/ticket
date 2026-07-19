import { chromium } from "playwright";
const SP = "/tmp/claude-0/-home-user-ticket/78e8c376-9e2d-55fe-8a75-949362a6874c/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1000, height: 1500 } });
const errors=[]; p.on("pageerror",e=>errors.push(String(e)));
await p.goto("http://localhost:9091/tickets/create", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
await p.fill("#title","تست"); await p.fill("#venue","سالن"); await p.fill("#city","تهران");
await p.locator("button:has-text('مرحلهٔ بعد')").click(); await p.waitForTimeout(500);
await p.click("#date-session-1"); await p.waitForTimeout(400);
const day = p.locator(".rmdp-day:not(.rmdp-disabled) span").filter({hasText:/^۱۵$/}); if(await day.count()) await day.first().click();
await p.keyboard.press("Escape"); await p.waitForTimeout(200);
for (const id of ["#start-session-1","#end-session-1"]){await p.click(id);await p.waitForTimeout(300);const inp=p.locator(".rmdp-time-picker input");if(await inp.count()){await inp.nth(0).fill(id.includes("start")?"18":"21");await inp.nth(1).fill("0");}await p.keyboard.press("Escape");await p.waitForTimeout(150);}
await p.locator("button:has-text('مرحلهٔ بعد')").click(); await p.waitForTimeout(600);
// open advanced, enable early-bird + دربستی
await p.locator("button:has-text('گزینه‌های پیشرفته')").first().click(); await p.waitForTimeout(300);
await p.locator("button[role='switch'][aria-label='فروش زودهنگام']").first().click(); await p.waitForTimeout(200);
await p.locator("button[role='switch'][aria-label='فروش دربستی']").first().click(); await p.waitForTimeout(300);
const checks = {
  mainCapacity: await p.locator("label:has-text('ظرفیت')").first().isVisible().catch(()=>false),
  mainDesc: await p.locator("label:has-text('توضیحات')").first().isVisible().catch(()=>false),
  salesInAdvanced: await p.locator("label:has-text('شروع فروش')").first().isVisible().catch(()=>false),
  ebPrice: await p.locator("label:has-text('قیمت زودهنگام')").first().isVisible().catch(()=>false),
  buyoutBase: await p.locator("label:has-text('قیمت پایهٔ دربست')").first().isVisible().catch(()=>false),
  buyoutPP: await p.locator("label:has-text('هزینه به‌ازای هر نفر')").first().isVisible().catch(()=>false),
  buyoutMin: await p.locator("label:has-text('حداقل نفرات')").first().isVisible().catch(()=>false),
};
console.log(JSON.stringify(checks), "errors:", errors.length?errors.slice(0,2):"none");
await p.screenshot({ path: `${SP}/step3-final.png`, fullPage:true });
await b.close(); console.log("done");
