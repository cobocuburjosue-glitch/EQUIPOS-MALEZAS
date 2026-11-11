/**
 * CATÁLOGO DE EQUIPOS · Malezas y Madurantes (Ingenio Madre Tierra)
 * Backend en Apps Script para la hoja "EQUIPOS TALLER MALEZAS".
 *
 * Pestañas que usa:
 *   Hoja 1     -> Excel de malezas (equipos, fechas de taller). Se reemplaza al "Cargar Excel".
 *   CATALOGO   -> datos propios de la app por equipo (fotos, boquillas, bajantes, filtros, ubicación, observaciones).
 *   USUARIOS   -> USUARIO | CONTRASEÑA | ROL (ADMINISTRADOR / PUBLICO) | NOMBRE
 *   RESPALDO   -> copia de Hoja 1 antes de cada carga de Excel (se crea sola).
 *
 * Fotos: carpeta de Drive "EQUIPOS MALEZAS" / <GRUPO> / <CÓDIGO> /
 */

const SHEET_ID  = '1nodO0-XaXXS-LFMHDaH9HmFjpwG9JjiiVR2XSE4W4zc';
const FOLDER_ID = '12MquXd4mkJdpxkQWW5rFb6ZfF-_gd_bw';   // EQUIPOS MALEZAS
const HOJA_DATOS = 'Hoja 1';
const TZ = 'America/Guatemala';
const TOKEN_DIAS = 30;

const CAT_COLS = ['CODIGO DE EQUIPO', 'DESCRIPCION', 'FOTO EQUIPO', 'BOQUILLAS', 'FOTO BOQUILLAS', 'BAJANTES', 'FOTO BAJANTES',
  'FILTROS', 'FOTO FILTROS', 'LATITUD', 'LONGITUD', 'UBICACION', 'OBSERVACIONES', 'ACTUALIZADO POR', 'FECHA ACTUALIZACION', 'CARPETA DRIVE'];
const TIPOS_FOTO = { EQUIPO: 'FOTO EQUIPO', BOQUILLAS: 'FOTO BOQUILLAS', BAJANTES: 'FOTO BAJANTES', FILTROS: 'FOTO FILTROS' };

/* ============================== utilidades ============================== */

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function norm_(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function ahora_() { return Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'); }
function texto_(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 500); }

function celda_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}

function hojaDatos_() {
  const ss = ss_();
  let sh = ss.getSheetByName(HOJA_DATOS);
  if (sh) return sh;
  // si cambiaron el nombre, busca la pestaña que tenga "CODIGO DE EQUIPO" en el encabezado
  return ss.getSheets().find(s => {
    if (['CATALOGO', 'USUARIOS', 'RESPALDO'].indexOf(s.getName()) >= 0) return false;
    const h = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0].map(norm_);
    return h.indexOf('CODIGO DE EQUIPO') >= 0;
  }) || ss.insertSheet(HOJA_DATOS);
}

function hojaCatalogo_() {
  const ss = ss_();
  let sh = ss.getSheetByName('CATALOGO');
  if (!sh) { sh = ss.insertSheet('CATALOGO'); sh.setFrozenRows(1); }
  const n = Math.max(sh.getLastColumn(), 1);
  const h = sh.getRange(1, 1, 1, n).getValues()[0].map(norm_);
  CAT_COLS.forEach(c => { if (h.indexOf(norm_(c)) < 0) { sh.getRange(1, h.length + 1).setValue(c).setFontWeight('bold'); h.push(norm_(c)); } });
  return sh;
}

function mapa_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(norm_);
  const m = {}; h.forEach((c, i) => { if (c && m[c] == null) m[c] = i; });
  return m;
}

/* ============================== web app ============================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'diag') {
    const sh = hojaDatos_();
    return json_({ ok: true, hoja: sh.getName(), filas: sh.getLastRow() - 1, carpeta: DriveApp.getFolderById(FOLDER_ID).getName() });
  }
  return json_({ ok: true, app: 'Catálogo de equipos · Malezas y Madurantes' });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'Solicitud no válida.' }); }
  try {
    switch (p.action) {
      case 'login':     return json_(login_(p.usuario, p.clave));
      case 'datos':     return json_(conSesion_(p.token, false, u => datos_(u)));
      case 'foto':      return json_(conSesion_(p.token, true, u => subirFoto_(u, p)));
      case 'catalogo':  return json_(conSesion_(p.token, true, u => guardarCatalogo_(u, p)));
      case 'excel':     return json_(conSesion_(p.token, true, u => cargarExcel_(u, p)));
      case 'logout':    PropertiesService.getScriptProperties().deleteProperty('tok_' + p.token); return json_({ ok: true });
      default:          return json_({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ============================== sesión ============================== */

function leerUsuarios_() {
  const sh = ss_().getSheetByName('USUARIOS');
  if (!sh || sh.getLastRow() < 2) return [];
  const m = mapa_(sh);
  const cu = m['USUARIO'], cc = m['CONTRASENA'] != null ? m['CONTRASENA'] : m['CLAVE'], cr = m['ROL'], cn = m['NOMBRE'];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    .filter(r => String(r[cu]).trim())
    .map(r => ({
      usuario: String(r[cu]).trim(),
      clave: String(r[cc]).trim(),
      rol: norm_(cr != null ? r[cr] : '') === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'PUBLICO',
      nombre: String(cn != null && r[cn] ? r[cn] : r[cu]).trim()
    }));
}

function login_(usuario, clave) {
  const u = leerUsuarios_().find(x => norm_(x.usuario) === norm_(usuario) && x.clave === String(clave || '').trim());
  if (!u) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  const props = PropertiesService.getScriptProperties();
  limpiarTokens_(props);
  const token = Utilities.getUuid();
  props.setProperty('tok_' + token, JSON.stringify({ u: u.usuario, exp: Date.now() + TOKEN_DIAS * 864e5 }));
  return { ok: true, token: token, usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol } };
}

function conSesion_(token, soloAdmin, fn) {
  if (!token) return { ok: false, sesion: false, error: 'Sesión no válida.' };
  const raw = PropertiesService.getScriptProperties().getProperty('tok_' + token);
  if (!raw) return { ok: false, sesion: false, error: 'La sesión venció. Vuelva a entrar.' };
  const t = JSON.parse(raw);
  if (t.exp < Date.now()) return { ok: false, sesion: false, error: 'La sesión venció. Vuelva a entrar.' };
  const u = leerUsuarios_().find(x => norm_(x.usuario) === norm_(t.u));
  if (!u) return { ok: false, sesion: false, error: 'Usuario no encontrado.' };
  if (soloAdmin && u.rol !== 'ADMINISTRADOR') return { ok: false, error: 'Solo el administrador puede hacer esto.' };
  return fn(u);
}

function limpiarTokens_(props) {
  const all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(k => {
    if (k.indexOf('tok_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/* ============================== datos ============================== */

function datos_(u) {
  const sh = hojaDatos_();
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  let encabezados = [], filas = [];
  if (lr >= 1 && lc >= 1) {
    const v = sh.getRange(1, 1, lr, lc).getValues();
    encabezados = v[0].map(x => String(x).trim());
    filas = v.slice(1).map(r => r.map(celda_)).filter(r => r.some(x => x !== ''));
  }
  const cat = hojaCatalogo_();
  const catalogo = {};
  if (cat.getLastRow() > 1) {
    const h = cat.getRange(1, 1, 1, cat.getLastColumn()).getValues()[0].map(x => String(x).trim());
    cat.getRange(2, 1, cat.getLastRow() - 1, cat.getLastColumn()).getValues().forEach(r => {
      const cod = String(r[0]).trim(); if (!cod) return;
      const o = {}; h.forEach((c, i) => { o[c] = celda_(r[i]); });
      catalogo[cod] = o;
    });
  }
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol },
    encabezados: encabezados, filas: filas, catalogo: catalogo,
    ultimaCarga: props.getProperty('ultimaCarga') || ''
  };
}

/* ============================== catálogo ============================== */

function filaCatalogo_(sh, codigo, crear) {
  const lr = sh.getLastRow();
  if (lr > 1) {
    const cods = sh.getRange(2, 1, lr - 1, 1).getValues();
    for (let i = 0; i < cods.length; i++) if (String(cods[i][0]).trim() === codigo) return i + 2;
  }
  if (!crear) return 0;
  sh.getRange(lr + 1, 1).setNumberFormat('@').setValue(codigo);
  return lr + 1;
}

function guardarCatalogo_(u, p) {
  const codigo = texto_(p.codigo, 80);
  if (!codigo) return { ok: false, error: 'Falta el código del equipo.' };
  const sh = hojaCatalogo_(), m = mapa_(sh);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const fila = filaCatalogo_(sh, codigo, true);
    const d = p.datos || {};
    const set = (col, val) => { const c = m[norm_(col)]; if (c != null) sh.getRange(fila, c + 1).setValue(val); };
    if ('descripcion' in d)   set('DESCRIPCION', texto_(d.descripcion, 1000));
    ['boquillas', 'bajantes', 'filtros'].forEach(k => {
      if (k in d) { const n = d[k] === '' || d[k] == null ? '' : Math.max(0, Math.round(Number(d[k]) || 0)); set(k.toUpperCase(), n); }
    });
    if ('lat' in d)           set('LATITUD', d.lat === '' || d.lat == null ? '' : Number(d.lat));
    if ('lng' in d)           set('LONGITUD', d.lng === '' || d.lng == null ? '' : Number(d.lng));
    if ('ubicacion' in d)     set('UBICACION', texto_(d.ubicacion, 200));
    if ('observaciones' in d) set('OBSERVACIONES', texto_(d.observaciones, 2000));
    set('ACTUALIZADO POR', u.nombre);
    set('FECHA ACTUALIZACION', ahora_());
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function carpetaEquipo_(codigo, grupo) {
  const raiz = DriveApp.getFolderById(FOLDER_ID);
  const g = texto_(grupo || 'SIN GRUPO', 80).replace(/[\/\\]/g, '-');
  const it = raiz.getFoldersByName(g);
  const fg = it.hasNext() ? it.next() : raiz.createFolder(g);
  const c = codigo.replace(/[\/\\]/g, '-');
  const it2 = fg.getFoldersByName(c);
  return it2.hasNext() ? it2.next() : fg.createFolder(c);
}

function subirFoto_(u, p) {
  const codigo = texto_(p.codigo, 80);
  const tipo = norm_(p.tipo);
  if (!codigo || !TIPOS_FOTO[tipo]) return { ok: false, error: 'Datos de foto incompletos.' };
  const b64 = String(p.base64 || '').replace(/^data:[^,]+,/, '');
  if (!b64) return { ok: false, error: 'No llegó la foto.' };
  const carpeta = carpetaEquipo_(codigo, p.grupo);
  const nombre = codigo + '_' + tipo + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', nombre);
  const f = carpeta.createFile(blob);
  f.setDescription(codigo + ' · ' + tipo + ' · ' + (p.descripcion || '') + ' · subida por ' + u.nombre);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  const sh = hojaCatalogo_(), m = mapa_(sh);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const fila = filaCatalogo_(sh, codigo, true);
    sh.getRange(fila, m[norm_(TIPOS_FOTO[tipo])] + 1).setValue(f.getId());
    sh.getRange(fila, m['CARPETA DRIVE'] + 1).setValue(carpeta.getUrl());
    sh.getRange(fila, m['ACTUALIZADO POR'] + 1).setValue(u.nombre);
    sh.getRange(fila, m['FECHA ACTUALIZACION'] + 1).setValue(ahora_());
  } finally { lock.releaseLock(); }
  return { ok: true, id: f.getId(), carpeta: carpeta.getUrl() };
}

/* ============================== carga de Excel ============================== */

function cargarExcel_(u, p) {
  const enc = (p.encabezados || []).map(x => texto_(x, 200));
  const filas = p.filas || [];
  if (enc.map(norm_).indexOf('CODIGO DE EQUIPO') < 0) return { ok: false, error: 'El Excel no tiene la columna "CODIGO DE EQUIPO".' };
  if (!filas.length) return { ok: false, error: 'El Excel no tiene filas.' };

  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = ss_(), sh = hojaDatos_();
    // respaldo de lo que había
    let rsp = ss.getSheetByName('RESPALDO');
    if (rsp) rsp.clear(); else rsp = ss.insertSheet('RESPALDO');
    if (sh.getLastRow() > 0) {
      const old = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
      rsp.getRange(1, 1, old.length, old[0].length).setValues(old);
    }
    rsp.hideSheet();

    const n = enc.length;
    const valores = [enc].concat(filas.map(r => {
      const out = [];
      for (let i = 0; i < n; i++) {
        let v = r[i] == null ? '' : r[i];
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) { const q = v.split('-'); v = new Date(+q[0], +q[1] - 1, +q[2]); }
        out.push(v);
      }
      return out;
    }));
    sh.clearContents();
    if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
    if (sh.getMaxRows() < valores.length) sh.insertRowsAfter(sh.getMaxRows(), valores.length - sh.getMaxRows());
    sh.getRange(1, 1, valores.length, n).setValues(valores);
    // fechas con el mismo formato de la hoja original
    enc.forEach((c, i) => { if (/FECHA/.test(norm_(c))) sh.getRange(2, i + 1, valores.length - 1, 1).setNumberFormat('dddd, mmmm dd, yyyy'); });

    // guarda el archivo original en Drive
    let url = '';
    if (p.archivoBase64) {
      const raiz = DriveApp.getFolderById(FOLDER_ID);
      const it = raiz.getFoldersByName('EXCEL CARGADOS');
      const fx = it.hasNext() ? it.next() : raiz.createFolder('EXCEL CARGADOS');
      const nom = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmm') + '_' + texto_(p.archivoNombre || 'equipos.xlsx', 120);
      url = fx.createFile(Utilities.newBlob(Utilities.base64Decode(p.archivoBase64), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', nom)).getUrl();
    }
    PropertiesService.getScriptProperties().setProperty('ultimaCarga', ahora_() + ' · ' + u.nombre + ' · ' + texto_(p.archivoNombre, 120));
  } finally { lock.releaseLock(); }
  return { ok: true, filas: filas.length };
}

/* ============================== permisos ============================== */

/** Ejecútela una vez desde el editor para aceptar permisos de Hojas y Drive. */
function autorizar() {
  Logger.log(ss_().getName());
  Logger.log(DriveApp.getFolderById(FOLDER_ID).getName());
  hojaCatalogo_();
}
