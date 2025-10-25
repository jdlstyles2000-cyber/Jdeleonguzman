// assets/app.js — lógica de 7 espacios
const SLOTS = 7;
const MANIFEST_URL = './assets/files.json';
const LS_KEY = 'jjdg-local-files-v1';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmtBytes = (n)=>{ const u=['B','KB','MB','GB']; let i=0,v=n; while(v>=1024&&i<u.length-1){v/=1024;i++;} return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`; };

function loadLocal(){ try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}'); } catch { return {}; } }
function saveLocal(st){ localStorage.setItem(LS_KEY, JSON.stringify(st)); }

let manifest = [];
let localState = loadLocal();
let admin = false;

function slotTemplate(i, rec){
  const hasPublic = !!(rec && rec.url);
  const local = localState[i];
  const hasLocal = !!local;
  const status = hasLocal ? `Local: ${local.name} (${fmtBytes(local.size)})` : (hasPublic ? 'Publicado' : 'Vacío');
  return `
  <article class="slot" data-slot="${i}">
    <div class="slot__row">
      <div class="slot__title">Archivo ${i}</div>
      <div class="slot__status muted small">${status}</div>
    </div>
    <div class="slot__actions">
      ${hasPublic ? `<a class="btn" href="${rec.url}" target="_blank" rel="noopener">Ver</a>
                     <a class="btn" href="${rec.url}" download>Descargar</a>` : `<button class="btn" disabled title="Sin archivo publicado">Ver</button><button class="btn" disabled>Descargar</button>`}
      ${hasLocal ? `<a class="btn" href="${local.blobUrl}" target="_blank" rel="noopener">Ver (local)</a>
                   <a class="btn" href="${local.blobUrl}" download="${local.name}">Descargar (local)</a>` : ''}
      ${admin ? `<label class="btn"><input type="file" hidden data-file for="slot-${i}" />Subir/Reemplazar</label>
                 <button class="btn danger" data-del="${i}">Eliminar</button>` : ''}
    </div>
  </article>`;
}

function render(){
  const slotsEl = $('#slots');
  let html = '';
  for(let i=1;i<=SLOTS;i++){
    const rec = manifest.find(r=>r.id===i);
    html += slotTemplate(i, rec);
  }
  slotsEl.innerHTML = html;

  if(admin){
    $$('input[type=file][data-file]').forEach(input=>{
      input.addEventListener('change', ()=>{
        const slotId = Number(input.getAttribute('for').split('-')[1]);
        const f = input.files && input.files[0];
        if(!f) return;
        const url = URL.createObjectURL(f);
        localState[slotId] = { name: f.name, type: f.type, size: f.size, mtime: f.lastModified, blobUrl: url };
        saveLocal(localState);
        render();
      });
    });
    $$('button[data-del]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const slotId = Number(btn.getAttribute('data-del'));
        const cur = localState[slotId];
        if(cur && cur.blobUrl) URL.revokeObjectURL(cur.blobUrl);
        delete localState[slotId];
        saveLocal(localState);
        render();
      });
    });
  }
}

async function loadManifest(){
  try{
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    manifest = Array.isArray(data) ? data.filter(x=>x && typeof x.id==='number') : [];
  }catch{ manifest = []; }
}

function setAdmin(on){
  admin = on;
  const t = document.getElementById('adminToggle');
  if(t){
    t.setAttribute('aria-pressed', on ? 'true' : 'false');
    t.textContent = on ? '🔓 Admin' : '🔒 Admin';
  }
  const panel = document.getElementById('adminPanel');
  if(panel) panel.classList.toggle('hidden', !on);
  render();
}

window.addEventListener('DOMContentLoaded', async ()=>{
  await loadManifest();
  render();
  const toggle = document.getElementById('adminToggle');
  if(toggle){
    toggle.addEventListener('click', ()=>{
      if(!admin){
        const pin = prompt('PIN admin (sugerido: 2468)');
        if(pin && pin.trim()==='2468') setAdmin(true);
      } else setAdmin(false);
    });
  }
  const exp = document.getElementById('exportManifest');
  if(exp){
    exp.addEventListener('click', ()=>{
      const out = [];
      for(let i=1;i<=SLOTS;i++){
        const local = localState[i];
        const pub = manifest.find(r=>r.id===i);
        if(local){
          const ext = (local.name.split('.').pop()||'bin').toLowerCase();
          const fname = `slot${i}.${ext}`;
          out.push({ id:i, title:`Archivo ${i}`, filename: fname, url: `./uploads/${fname}` });
        } else if (pub){
          out.push(pub);
        } else {
          out.push({ id:i, title:`Archivo ${i}`, filename: '', url: '' });
        }
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type:'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'assets-files.json';
      a.click();
      setTimeout(()=> URL.revokeObjectURL(a.href), 1500);
      alert('Descargado manifest. Sube este archivo como assets/files.json y coloca los archivos en /uploads/.');
    });
  }
  const clr = document.getElementById('clearLocal');
  if(clr){
    clr.addEventListener('click', ()=>{
      if(confirm('Esto borrará tus archivos locales y estados.')){
        Object.values(localState).forEach(v=>{ if(v.blobUrl) URL.revokeObjectURL(v.blobUrl); });
        localState = {}; saveLocal(localState); render();
      }
    });
  }
});
