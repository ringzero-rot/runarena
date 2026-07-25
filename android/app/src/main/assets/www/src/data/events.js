// @ts-check
/**
 * Race event feed. In production this comes from the backend / organiser feeds;
 * here it is seeded static data. URLs open in a new tab with rel="noopener".
 * @typedef {{ d:string, m:string, name:string, loc:string, dist:string, reg:string, race:string, fee:string, status:'open'|'soon', url:string }} RaceEvent
 */

/** @type {RaceEvent[]} */
export const EVENTS = [
  { d:'12', m:'ก.ค.', name:'Bangkok Midnight Run 2026', loc:'สวนเบญจกิติ', dist:'5 / 10 / 21 กม.', reg:'1 มิ.ย.', race:'12 ก.ค.', fee:'650.-', status:'open', url:'https://www.google.com/search?q=Bangkok+Midnight+Run+2026' },
  { d:'03', m:'ส.ค.', name:'เชียงใหม่ Trail Challenge', loc:'ดอยสุเทพ', dist:'16 / 32 กม.', reg:'15 มิ.ย.', race:'3 ส.ค.', fee:'1,200.-', status:'open', url:'https://www.google.com/search?q=Chiang+Mai+Trail+Challenge' },
  { d:'21', m:'ก.ย.', name:'Amazing Thailand Marathon', loc:'หัวหิน', dist:'10 / 21 / 42 กม.', reg:'1 ก.ค.', race:'21 ก.ย.', fee:'900.-', status:'soon', url:'https://www.google.com/search?q=Amazing+Thailand+Marathon' },
  { d:'09', m:'พ.ย.', name:'Khon Kaen Night Run', loc:'บึงแก่นนคร', dist:'5 / 10 กม.', reg:'20 ส.ค.', race:'9 พ.ย.', fee:'500.-', status:'soon', url:'https://www.google.com/search?q=Khon+Kaen+Night+Run' },
];
