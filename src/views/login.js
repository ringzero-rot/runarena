// @ts-check
import { VERSION, BUILD } from '../version.js';

export function loginView() {
  return `<div class="loginwrap">
    <div class="loginhero"><div class="big">RUN<span style="color:var(--sunrise)">ARENA</span></div>
      <div class="tag">ทุกเส้นทางคือสนาม • ทุกการวิ่งคือการท้าชิง</div></div>
    <div style="background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:22px">
      <label for="loginName" style="color:var(--mid);font-size:12px;font-weight:600;margin-bottom:8px;display:block;font-family:var(--disp)">ชื่อที่จะใช้ในสนาม</label>
      <input class="input" id="loginName" placeholder="เช่น ตี๋ขาแรง" autocomplete="nickname" data-action="loginEnter">
      <button class="btn" data-action="login">⚡ เข้าสู่สนาม</button>
      <div class="hint">เดโม: ของจริงต่อ Sign in with Apple / Google / Supabase Auth</div>
    </div>
    <div class="verline">RunArena v${VERSION} · build ${BUILD}</div></div>`;
}
