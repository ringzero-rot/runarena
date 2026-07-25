// @ts-check
import { esc } from '../ui/dom.js';
import { EVENTS } from '../data/events.js';

export function eventsView() {
  return `<div class="eyebrow">อัปเดตทั่วไทย</div><h1 class="title">ฟีดงานวิ่ง</h1>
    <div class="sub">งานที่เปิดรับสมัครและใกล้จัด — ดูวันสมัคร/วันวิ่ง แล้วกดไปหน้าสมัคร</div>
    ${EVENTS.map((e) => `<div class="ev"><div class="evtop">
      <div class="evdate"><div class="d">${esc(e.d)}</div><div class="m">${esc(e.m)}</div></div>
      <div style="flex:1"><div class="evname">${esc(e.name)}</div><div class="evloc">${esc(e.loc)} • ${esc(e.dist)}</div>
        <div class="evdates"><div>เปิดรับสมัคร<b>${esc(e.reg)}</b></div><div>วันวิ่ง<b>${esc(e.race)}</b></div></div>
        <span class="status ${e.status}">${e.status === 'open' ? '● เปิดรับสมัครแล้ว' : '● ใกล้เปิดรับสมัคร'}</span></div></div>
      <div class="evbar"><div class="x">ค่าสมัครเริ่ม<b>${esc(e.fee)}</b></div>
        <button class="go" data-action="openEvent" data-arg="${esc(e.url)}">ดูรายละเอียด ↗</button></div></div>`).join('')}
    <div class="hint">เดโม: ของจริงดึงฟีดจากผู้จัด/เพจงานวิ่ง แล้วลิงก์ไปเว็บปลายทาง</div>`;
}
