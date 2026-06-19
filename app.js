/* ── INSTANCE SUPABASE UNIQUE ── */
var _sbClient = null;
function getSb() {
  if (!_sbClient && window.supabase) {
    _sbClient = window.supabase.createClient(
      'https://ycakrdaxsvxbdcvpfygq.supabase.co',
      'sb_publishable_GL4Ad1Su5zfZo-K5ocqtSw_4I7j_fdy'
    );
  }
  return _sbClient;
}
/* ── DÉCONNEXION ── */
async function handleLogout() {
  closeAvatarMenu();
  showToast('Déconnexion...');
  var _db = getSb();
  await _db.auth.signOut();
  window.location.href = '/connexion';
}

/* ── ÉTAT GLOBAL ── */
var riskData = [];

/* ── PERFORMANCE : debounce renderDashboard ── */
var _rdTimer = null;
var _renderDashboardFn = null; // sera assigné après la définition de renderDashboard
function renderDashboard() {
  if(_renderDashboardFn) {
    clearTimeout(_rdTimer);
    _rdTimer = setTimeout(_renderDashboardFn, 120);
  }
}

/* ── COULEURS CENTRALISÉES PAR NIVEAU ── */
/* LEVEL_COLORS supprimé — utiliser levelColors, levelBadge, levelLabel à la place */

/* ── SÉCURITÉ : échappe les caractères HTML pour éviter les injections ── */
function escHtml(str) {
  if(!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


/* ── UTILITAIRE DATE EN FRANÇAIS ── */
function formatDateFr(date) {
  var d = date || new Date();
  var ms = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return d.getDate() + ' ' + ms[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + ('0'+d.getHours()).slice(-2) + 'h' + ('0'+d.getMinutes()).slice(-2);
}

/* ── NAMESPACE CK — évite la pollution du scope global ── */
var CK = window.CK || {};
CK.levelColors = {critique:'#E24B4A',eleve:'#EF9F27',modere:'#4A90D9',faible:'#1D9E75'};
CK.levelBadge  = {critique:'bc',eleve:'bh',modere:'bm',faible:'bl'};
CK.levelLabel  = {critique:'Critique',eleve:'Élevé',modere:'Modéré',faible:'Faible'};
CK.statusDot   = {'En cours':'#E24B4A','À traiter':'#EF9F27','Surveillé':'#94A3B8','Traité':'#1D9E75'};

/* Aliases globaux conservés pour compatibilité avec le reste du code */
var levelColors = CK.levelColors;
var levelBadge  = CK.levelBadge;
var levelLabel  = CK.levelLabel;
var statusDot   = CK.statusDot;

/* ── MAPS GLOBALES (évite les redéclarations locales) ── */
var levelColors2 = levelColors;
var levelLabel2  = levelLabel;
var levelBg2     = {critique:'#FDEAEA',eleve:'#FEF3E2',modere:'#EBF4FF',faible:'#EAFAF3'};
var statusDot2   = statusDot;
var STATUT_LABEL = {conforme:'Conforme',averifier:'À vérifier',retard:'En retard',nonconforme:'Non conforme',nonplanifie:'Non planifié'};
var STATUT_COLOR = {conforme:'#1D9E75',averifier:'#EF9F27',retard:'#E24B4A',nonconforme:'#E24B4A',nonplanifie:'#94A3B8'};
var DOT_CTRL     = {retard:'#E24B4A',nonconforme:'#E24B4A',averifier:'#EF9F27',conforme:'#1D9E75',nonplanifie:'#94A3B8'};
var SCOL_CTRL    = {retard:'#A32D2D',nonconforme:'#A32D2D',averifier:'#D97706',conforme:'#0F6E56',nonplanifie:'#94A3B8'};
var SLBL_CTRL    = STATUT_LABEL;

/* ── NAVIGATION ── */
function showPage(page,el){
  closeMobileMenu();
  ['page-overview','page-risques','page-carto','page-actions','page-histo','page-controles','page-compte','page-factures'].forEach(function(id){
    var p=document.getElementById(id); if(p) p.style.display='none';
  });
  document.getElementById('page-'+page).style.display='block';
  document.querySelectorAll('.sb-item').forEach(function(i){i.classList.remove('active');});
  if(el)el.classList.add('active');
  if(page==='risques')renderRiskTable();
  if(page==='carto')renderCarto();
  if(page==='actions')renderActions();
  if(page==='histo')renderHisto();
  if(page==='controles'){if(typeof renderCtrl==='function')renderCtrl();}

  if(page==='factures')loadFactures();
  if(page==='compte'){loadProfilData();loadSubscriptionData();}
}

/* ── TABLE RISQUES ── */
var currentFilter='tous';
var currentFicheId=null;

function calcRiskScore(r){
  var p=Math.round((r.proba||0)/3*100);
  var i=Math.round((r.impact||0)/3*100);
  return Math.round(p*0.45+i*0.55);
}

function renderRiskTable(filterLevel,search){
  // filterLevel param kept for backward compat but we now use rtFilter* vars
  var s = search !== undefined ? search : (document.querySelector('.search-box') ? document.querySelector('.search-box').value : '');
  var body=document.getElementById('riskBody');
  body.innerHTML='';
  riskData.forEach(function(r){
    // Apply dropdown filters
    if(typeof rtFilterNiveau !== 'undefined' && rtFilterNiveau !== 'tous' && r.level !== rtFilterNiveau) return;
    if(typeof rtFilterCat !== 'undefined' && rtFilterCat !== 'tous' && r.cat !== rtFilterCat) return;
    if(typeof rtFilterStatut !== 'undefined' && rtFilterStatut !== 'tous' && r.status !== rtFilterStatut) return;
    if(s&&r.name.toLowerCase().indexOf(s.toLowerCase())===-1)return;
    var meta=modalMeta[r.id]||{};
    var initiales=meta.initiales||'';
    var responsableHTML=initiales
      ?'<span class="rt-resp-val">'+initiales+'</span>'
      :'<span class="rt-resp-empty">—</span>';
    var tr=document.createElement('tr');
    tr.dataset.level=r.level; tr.dataset.rid=r.id;
    tr.style.cursor='pointer';
    if(currentFicheId===r.id)tr.style.fontWeight='500';
    tr.onclick=function(e){if(e.target.closest('button'))return; openRiskModal(r.id);};
    tr.innerHTML='<td>'+escHtml(r.name)+'</td>'
      +'<td class="rt-cat">'+escHtml(r.cat)+'</td>'
      +'<td><span class="ri-badge '+CK.levelBadge[r.level]+'">'+CK.levelLabel[r.level]+'</span></td>'
      +'<td>'+responsableHTML+'</td>'
      +'<td><span class="rt-status">'+escHtml(r.status)+'</span></td>';
    body.appendChild(tr);
  });
  var crit=riskData.filter(function(r){return r.level==='critique';}).length;
  if(body.innerHTML===''){
    var tr=document.createElement('tr');
    tr.innerHTML='<td colspan="5" class="rt-empty">Aucun risque pour le moment.</td>';
    body.appendChild(tr);
  }
  var sub=document.getElementById('risques-sub');
  if(sub)sub.textContent=riskData.length+' risque'+(riskData.length>1?'s':'')+(crit?' · '+crit+' critique'+(crit>1?'s':''):'')+' · mis à jour le '+formatDateFr();
  var badge=document.querySelector('#badge-risques');
  if(badge)badge.textContent=crit;
}

/* ── MODALE FICHE RISQUE ENRICHIE ── */
var currentRiskModalId = null;

// État local des plans d'action et contrôles supprimés par l'utilisateur pour ce risque
var deletedActions = {};   // {riskId: [index, ...]}
var deletedControles = {}; // {riskId: [index, ...]}

function openRiskModal(rid) {
  currentRiskModalId = rid;
  currentModalKey = rid; // synchro pour addModalAction
  var r = riskData.find(function(x){ return x.id === rid; });
  if(!r) return;
  var meta = modalMeta[rid] || {};
  var dbRef = (CLEARISK_DB[ACCOUNT_SECTOR]||[]).find(function(d){ return d.id === rid; });
  var allActions = dbRef && dbRef.actions ? dbRef.actions : [];
  var allControles = dbRef && dbRef.controles ? dbRef.controles : [];
  var delA = deletedActions[rid] || [];
  var delC = deletedControles[rid] || [];

  // Header
  document.getElementById('rm-title').textContent = r.name;
  document.getElementById('rm-cat').textContent = r.cat;
  var lb = document.getElementById('rm-level-badge');
  lb.className = 'ri-badge ' + levelBadge[r.level];
  lb.textContent = levelLabel[r.level];

  // Champs édition
  document.getElementById('rm-inp-name').value = meta.title || r.name;
  document.getElementById('rm-inp-resp').value = meta.initiales || '';
  document.getElementById('rm-sel-level').value = r.level;
  document.getElementById('rm-sel-statut').value = r.status;
  document.getElementById('rm-inp-desc').value = meta.desc || (dbRef ? dbRef.description : '') || '';

  // ── PLANS D'ACTION ─────────────────────────────────────────────
  // 1. PA de actionData liés à ce risque (source de vérité partagée)
  // BUG#3 FIX — liaison par riskId (FK) en priorité, fallback par nom pour compatibilité données existantes
  var linkedPA = actionData.filter(function(a){
    if(a.riskId) return a.riskId === rid;
    return a.risk === r.name || (meta.title && a.risk === meta.title);
  });
  // 2. PA de CLEARISK_DB (bibliothèque) non encore dans actionData
  var dbPATitles = linkedPA.map(function(a){ return a.name; });
  var libPA = allActions.filter(function(a, idx){
    if(delA.indexOf(idx) > -1) return false;
    return dbPATitles.indexOf(a.titre) === -1;
  });

  var actHTML = '';
  var dueColors = {late:'#E24B4A', week:'#EF9F27', month:'#94A3B8', quarter:'#94A3B8', done:'#1D9E75'};
  var dueBg    = {late:'#FDEAEA', week:'#FEF3E2', month:'#EBF4FF', quarter:'#F4F6F9', done:'#EAFAF3'};
  var dueText  = {late:'En retard', week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre', done:'Fait'};

  // PA liés depuis actionData
  linkedPA.forEach(function(a){
    var dc = dueColors[a.due] || '#71869A';
    var db = dueBg[a.due] || '#F4F6F9';
    var dl = a.dueLabel || dueText[a.due] || a.due;
    var checked = a.done ? 'checked' : '';
    var nameStyle = a.done ? 'text-decoration:line-through;color:#94A3B8;' : '';
    actHTML += '<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:8px;border:1px solid #E2E8F0;margin-bottom:6px;background:#fff;">'
      + '<div style="padding-top:1px;">'
      + '<select onchange="updateActionStatus(\''+a.id+'\',this.value)" style="font-size:10px;border:1px solid #E2E8F0;border-radius:5px;padding:2px 6px;color:'+dc+';background:'+db+';cursor:pointer;outline:none;">'
      + '<option value="late"'+(a.due==='late'?' selected':'')+'>En retard</option>'
      + '<option value="week"'+(a.due==='week'?' selected':'')+'>Cette semaine</option>'
      + '<option value="month"'+(a.due==='month'?' selected':'')+'>Ce mois</option>'
      + '<option value="quarter"'+(a.due==='quarter'?' selected':'')+'>Ce trimestre</option>'
      + '<option value="done"'+(a.due==='done'?' selected':'')+'>Fait ✓</option>'
      + '</select>'
      + '</div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:12px;font-weight:500;color:#1A1A1A;'+nameStyle+'margin-bottom:3px;">'+escHtml(a.name)+'</div>'
      + (a.desc ? '<div style="font-size:11px;color:#71869A;line-height:1.5;">'+a.desc+'</div>' : '')
      + '</div>'
      + '<button onclick="deleteLinkedAction(\''+a.id+'\',\''+rid+'\')" style="background:none;border:none;color:#CBD5E1;font-size:14px;cursor:pointer;padding:2px 5px;border-radius:4px;flex-shrink:0;line-height:1;" onmouseover="this.style.background=\'#FDEAEA\';this.style.color=\'#E24B4A\'" onmouseout="this.style.background=\'none\';this.style.color=\'#CBD5E1\'">✕</button>'
      + '</div>';
  });

  // PA de la bibliothèque (suggestions non encore ajoutées)
  if(libPA.length > 0){
    actHTML += '<div style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px;">Suggestions pour ce risque</div>';
    libPA.forEach(function(a, idx){
      var urgBg = a.priorite==='urgent' ? '#FEF3E2' : '#F4F6F9';
      var urgCol = a.priorite==='urgent' ? '#7A4500' : '#71869A';
      actHTML += '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;border:1px dashed #E2E8F0;margin-bottom:5px;background:#FAFBFC;">'
        + '<div style="flex:1;">'
        + '<div style="font-size:12px;color:#1A1A1A;margin-bottom:3px;">'+a.titre+'</div>'
        + '<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:'+urgBg+';color:'+urgCol+';">'+a.delai+'</span>'
        + '</div>'
        + '<button onclick="addLibActionToRisk(\''+rid+'\','+allActions.indexOf(a)+')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;white-space:nowrap;">Ajouter</button>'
        + '</div>';
    });
  }

  // Bouton ajouter action manuelle
  actHTML += '<button onclick="openAddActionFromRisk(\''+rid+'\')" style="width:100%;margin-top:8px;padding:9px;border:1px dashed #CBD5E1;border-radius:8px;background:#fff;color:#71869A;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;" onmouseover="this.style.borderColor=\'#0A1F3D\';this.style.color=\'#0A1F3D\'" onmouseout="this.style.borderColor=\'#CBD5E1\';this.style.color=\'#71869A\'">Ajouter un plan d\'action personnalisé</button>';

  if(!linkedPA.length && !libPA.length) actHTML = '<div style="font-size:12px;color:#94A3B8;padding:8px 0;">Aucun plan d\'action pour ce risque.</div>';
  document.getElementById('rm-actions-body').innerHTML = actHTML;

  // ── CONTRÔLES PERMANENTS ────────────────────────────────────────
  // 1. Contrôles de ctrlData liés à ce risque
  var linkedCtrl = ctrlData.filter(function(c){
    return c.riskId === rid || c.risk === r.name;
  });
  // 2. Contrôles de la bibliothèque non encore dans ctrlData
  var ctrlTitres = linkedCtrl.map(function(c){ return c.nom; });
  var libCtrl = allControles.filter(function(c, idx){
    if(delC.indexOf(idx) > -1) return false;
    return ctrlTitres.indexOf(c.titre) === -1;
  });

  var DOT_CTRL = {conforme:'#1D9E75', averifier:'#EF9F27', retard:'#E24B4A', nonconforme:'#E24B4A', nonplanifie:'#94A3B8'};
  var LBL_CTRL = {conforme:'Conforme', averifier:'À vérifier', retard:'En retard', nonconforme:'Non conforme', nonplanifie:'Non planifié'};

  var ctrlHTML = '';
  linkedCtrl.forEach(function(c){
    var dot = DOT_CTRL[c.statut] || '#94A3B8';
    var lbl = LBL_CTRL[c.statut] || 'Non planifié';
    var proch = typeof ctrl_calcProchaine === 'function' ? ctrl_calcProchaine(c) : null;
    var prochaineStr = proch ? (typeof proch === 'string' ? proch : proch.label) : 'À planifier';
    ctrlHTML += '<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:8px;border:1px solid #E2E8F0;margin-bottom:6px;background:#fff;">'
      + '<div style="width:8px;height:8px;border-radius:50%;background:'+dot+';flex-shrink:0;margin-top:4px;"></div>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:12px;font-weight:500;color:#1A1A1A;margin-bottom:4px;">'+escHtml(c.nom)+'</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
      + '<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:#F4F6F9;color:#71869A;">'+(typeof FREQ_LABEL!=='undefined'?FREQ_LABEL[c.freq]:c.freq)+'</span>'
      + '<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:'+(DOT_CTRL[c.statut]==='#1D9E75'?'#EAFAF3':DOT_CTRL[c.statut]==='#EF9F27'?'#FEF3E2':'#FDEAEA')+';color:'+dot+';">'+lbl+'</span>'
      + '<span style="font-size:10px;color:#94A3B8;">Prochain : '+prochaineStr+'</span>'
      + '</div>'
      + '</div>'
      + '<button onclick="ctrl_openVal(\''+c.id+'\')" style="font-size:10px;padding:3px 9px;border-radius:5px;border:1px solid #E2E8F0;background:#fff;color:#0A1F3D;cursor:pointer;white-space:nowrap;flex-shrink:0;">Valider</button>'
      + '</div>';
  });

  if(libCtrl.length > 0){
    ctrlHTML += '<div style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:uppercase;letter-spacing:.08em;margin:12px 0 6px;">Contrôles recommandés</div>';
    libCtrl.forEach(function(c, idx){
      ctrlHTML += '<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;border:1px dashed #E2E8F0;margin-bottom:5px;background:#FAFBFC;">'
        + '<div style="flex:1;">'
        + '<div style="font-size:12px;color:#1A1A1A;margin-bottom:3px;">'+c.titre+'</div>'
        + '<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:#F4F6F9;color:#71869A;">'+c.frequence+'</span>'
        + '</div>'
        + '<button onclick="addLibCtrlToRisk(\''+rid+'\','+allControles.indexOf(c)+')" style="font-size:10px;padding:3px 10px;border-radius:5px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;white-space:nowrap;">Activer</button>'
        + '</div>';
    });
  }

  ctrlHTML += '<button onclick="openAddCtrlFromRisk(\''+rid+'\')" style="width:100%;margin-top:8px;padding:9px;border:1px dashed #CBD5E1;border-radius:8px;background:#fff;color:#71869A;font-size:12px;cursor:pointer;font-family:inherit;transition:all .15s;" onmouseover="this.style.borderColor=\'#0A1F3D\';this.style.color=\'#0A1F3D\'" onmouseout="this.style.borderColor=\'#CBD5E1\';this.style.color=\'#71869A\'">Ajouter un contrôle permanent</button>';

  if(!linkedCtrl.length && !libCtrl.length) ctrlHTML = '<div style="font-size:12px;color:#94A3B8;padding:8px 0;">Aucun contrôle permanent pour ce risque.</div>' + ctrlHTML;
  document.getElementById('rm-controles-body').innerHTML = ctrlHTML;

  // Reset onglet sur Informations
  switchRmTab('info');

  // Ouvrir
  var overlay = document.getElementById('riskModalOverlay');
  overlay.style.display = 'flex';
}

function closeRiskModal() {
  document.getElementById('riskModalOverlay').style.display = 'none';
  currentRiskModalId = null;
}

function closeRiskModalOutside(e) {
  if(e.target === document.getElementById('riskModalOverlay')) closeRiskModal();
}

function deleteRiskAction(rid, idx) {
  if(!confirm('Supprimer ce plan d\'action ?')) return;
  if(!deletedActions[rid]) deletedActions[rid] = [];
  deletedActions[rid].push(idx);
  var currentTab = document.querySelector('.rm-tab.active');
  var tabName = currentTab ? currentTab.id.replace('rm-tab-','') : 'actions';
  openRiskModal(rid);
  switchRmTab('actions');
}

function deleteRiskControle(rid, idx) {
  if(!confirm('Supprimer ce contrôle permanent ?')) return;
  if(!deletedControles[rid]) deletedControles[rid] = [];
  deletedControles[rid].push(idx);
  openRiskModal(rid);
  switchRmTab('controles');
}

function saveRiskModal() {
  var rid = currentRiskModalId;
  if(!rid) return;
  var r = riskData.find(function(x){ return x.id === rid; });
  if(!r) return;
  var newName = document.getElementById('rm-inp-name').value.trim();
  var newLevel = document.getElementById('rm-sel-level').value;
  var newStatut = document.getElementById('rm-sel-statut').value;
  var newDesc = document.getElementById('rm-inp-desc').value.trim();
  var newResp = document.getElementById('rm-inp-resp').value.trim().toUpperCase().slice(0,3);
  if(!newName){ showToast('L\'intitulé est obligatoire', true); return; }
  r.name = newName;
  r.level = newLevel;
  r.status = newStatut;
  r.color = levelColors[newLevel];
  if(!modalMeta[rid]) modalMeta[rid] = {};
  modalMeta[rid].title = newName;
  modalMeta[rid].desc = newDesc;
  modalMeta[rid].initiales = newResp;
  r.desc = newDesc;
  closeRiskModal();
  renderRiskTable();
  renderDashboard();
  sbSaveRisk(r);
  if(newDesc) sbSaveModalMeta(rid, newDesc);
  sbSaveHistory({type:'risque', title:'Risque modifié — '+newName, desc:'Catégorie '+r.cat+' · Niveau '+levelLabel[newLevel]+' · Statut '+newStatut});
  showToast('Risque mis à jour');
}

function deleteRiskFromModal() {
  var rid = currentRiskModalId;
  if(!rid) return;
  var r = riskData.find(function(x){ return x.id === rid; });
  var nm = r ? r.name : rid;
  closeRiskModal();
  pendingDeleteId = rid;
  document.getElementById('confirmRiskName').textContent = '"' + nm + '"';
  document.getElementById('confirmOverlay').classList.add('open');
}

function switchRmTab(tab) {
  ['info','actions','controles'].forEach(function(t) {
    document.getElementById('rm-tab-'+t).classList.toggle('active', t===tab);
    document.getElementById('rm-panel-'+t).classList.toggle('active', t===tab);
  });
}

/* ── SYNCHRO PA / CTRL depuis modale risque ── */

function updateActionStatus(aid, newDue) {
  var a = actionData.find(function(x){ return x.id === aid; });
  if(!a) return;
  a.due = newDue;
  a.done = (newDue === 'done');
  var dueLabels = {late:'En retard', week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre', done:'Fait'};
  a.dueLabel = dueLabels[newDue] || newDue;
  // Rafraîchir les compteurs sans fermer la modale
  if(typeof renderActions === 'function') renderActions();
  showToast('Statut mis à jour');
}

function deleteLinkedAction(aid, rid) {
  if(!confirm('Supprimer ce plan d\'action ?')) return;
  actionData = actionData.filter(function(x){ return x.id !== aid; });
  var sb = getSb(); if(sb) sb.from('actions').delete().eq('id', aid);
  if(typeof renderActions === 'function') renderActions();
  openRiskModal(rid);
  switchRmTab('actions');
}

function addLibActionToRisk(rid, idx) {
  var r = riskData.find(function(x){ return x.id === rid; });
  var dbRef = (CLEARISK_DB[ACCOUNT_SECTOR]||[]).find(function(d){ return d.id === rid; });
  if(!dbRef || !dbRef.actions[idx]) return;
  var a = dbRef.actions[idx];
  var dueMap = {urgent:'week', normal:'month', planif:'quarter'};
  var due = dueMap[a.priorite] || 'month';
  var dueLabels = {week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre'};
  var newAct = {
    id: genId(),
    name: a.titre,
    riskId: rid, // BUG#3 FIX — liaison par ID
    risk: r.name,
    cat: r.cat,
    riskColor: r.color,
    due: due,
    dueLabel: dueLabels[due] || 'Ce mois',
    done: false,
    desc: '',
    note: '',
    createdAt: new Date().toISOString()
  };
  actionData.push(newAct);
  sbSaveAction(newAct);
  if(typeof renderActions === 'function') renderActions();
  renderDashboard();
  openRiskModal(rid);
  switchRmTab('actions');
  showToast('Plan d\'action ajouté');
}

function openAddActionFromRisk(rid) {
  var r = riskData.find(function(x){ return x.id === rid; });
  closeRiskModal();
  openAddAction();
  // Pré-remplir le risque si possible
  setTimeout(function(){
    var sel = document.getElementById('pa-f-risk');
    if(sel && r) {
      for(var i=0; i<sel.options.length; i++){
        if(sel.options[i].text === r.name){ sel.selectedIndex=i; break; }
      }
    }
  }, 100);
}

function addLibCtrlToRisk(rid, idx) {
  var r = riskData.find(function(x){ return x.id === rid; });
  var dbRef = (CLEARISK_DB[ACCOUNT_SECTOR]||[]).find(function(d){ return d.id === rid; });
  if(!dbRef || !dbRef.controles[idx]) return;
  var c = dbRef.controles[idx];
  var freqMap = {'Quotidien':'quotidien','Hebdomadaire':'hebdomadaire','Mensuel':'mensuel','Trimestriel':'trimestriel','Semestriel':'semestriel','Annuel':'annuel','À chaque livraison':'mensuel','À chaque service':'quotidien','Continu':'quotidien','À chaque modification':'mensuel','Après chaque pic':'trimestriel','À chaque acquisition':'annuel','À chaque changement de carte':'mensuel'};
  var freq = freqMap[c.frequence] || 'mensuel';
  var today = new Date();
  var dateStr = ('0'+today.getDate()).slice(-2)+'/'+('0'+(today.getMonth()+1)).slice(-2)+'/'+today.getFullYear();
  ctrlData.push({
    id: genId(),
    nom: c.titre,
    cat: r.cat,
    niveau: '1',
    freq: freq,
    resp: '—',
    statut: 'nonplanifie',
    dernierDate: '—',
    note: '',
    riskId: rid,
    risk: r.name
  });
  var _newCtrl = ctrlData[ctrlData.length-1];
  sbSaveControl(_newCtrl);
  if(typeof renderCtrl === 'function') renderCtrl();
  renderDashboard();
  openRiskModal(rid);
  switchRmTab('controles');
  showToast('Contrôle permanent activé');
}

function openAddCtrlFromRisk(rid) {
  closeRiskModal();
  ctrl_openAdd();
}

// Legacy — kept for backward compat with other pages
function openFicheEnrichie(rid){ openRiskModal(rid); }
function closeFicheEnrichie(){ closeRiskModal(); }

function toggleFicheAction(item){
  var check=item.querySelector('.fiche-check');
  var text=item.querySelector('.fiche-action-text');
  check.classList.toggle('done');
  text.classList.toggle('done');
  check.innerHTML=check.classList.contains('done')?'<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':'';
}

/* ── FILTRES TABLEAU RISQUES — DROPDOWNS EN-TÊTE ── */
var rtFilterCat = 'tous';
var rtFilterNiveau = 'tous';
var rtFilterStatut = 'tous';
var rtOpenDD = null; // currently open dropdown id

var rtCatOptions = [
  {val:'tous', label:'Toutes les catégories'},
  {val:'Approvisionnement', label:'Approvisionnement'},
  {val:'Autre', label:'Autre'},
  {val:'Commercial', label:'Commercial'},
  {val:'Conformité réglementaire', label:'Conformité réglementaire'},
  {val:'Financier', label:'Financier'},
  {val:'Juridique', label:'Juridique'},
  {val:'Numérique', label:'Numérique'},
  {val:'Opérationnel', label:'Opérationnel'},
  {val:'Réputation', label:'Réputation'},
  {val:'Ressources Humaines', label:'Ressources Humaines'},
  {val:'Sanitaire', label:'Sanitaire'},
  {val:'Sécurité', label:'Sécurité'}
];
var rtNiveauOptions = [
  {val:'tous', label:'Tous les niveaux', dot:''},
  {val:'critique', label:'Critique', dot:''},
  {val:'eleve', label:'Élevé', dot:''},
  {val:'modere', label:'Modéré', dot:''},
  {val:'faible', label:'Faible', dot:''}
];
var rtStatutOptions = [
  {val:'tous', label:'Tous les statuts', dot:''},
  {val:'En cours', label:'En cours', dot:''},
  {val:'À traiter', label:'À traiter', dot:''},
  {val:'Surveillé', label:'Surveillé', dot:''},
  {val:'Traité', label:'Traité', dot:''}
];

function toggleRtDropdown(type, thEl) {
  var ddId = 'rt-dd-' + type;
  // Close if already open
  if(rtOpenDD === ddId) { closeRtDropdowns(); return; }
  closeRtDropdowns();
  rtOpenDD = ddId;
  var dd = document.getElementById(ddId);
  // Build items
  var options, currentVal, setter, labelId, defaultLabel;
  if(type === 'cat') {
    options = rtCatOptions; currentVal = rtFilterCat;
    setter = function(v){ rtFilterCat = v; };
    labelId = 'th-cat-label'; defaultLabel = 'Catégorie';
  } else if(type === 'niveau') {
    options = rtNiveauOptions; currentVal = rtFilterNiveau;
    setter = function(v){ rtFilterNiveau = v; };
    labelId = 'th-niveau-label'; defaultLabel = 'Niveau';
  } else {
    options = rtStatutOptions; currentVal = rtFilterStatut;
    setter = function(v){ rtFilterStatut = v; };
    labelId = 'th-statut-label'; defaultLabel = 'Statut';
  }
  dd.innerHTML = '';
  options.forEach(function(opt, idx) {
    if(idx === 1) { var sep=document.createElement('div'); sep.className='rt-dd-sep'; dd.appendChild(sep); }
    var item = document.createElement('div');
    item.className = 'rt-dd-item' + (currentVal === opt.val ? ' selected' : '');
    var inner = '';
    if(opt.dot) inner += '<span class="rt-dd-dot" style="background:'+opt.dot+';"></span>';
    inner += '<span>'+opt.label+'</span>';
    if(currentVal === opt.val) inner += '<svg style="margin-left:auto;" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0A1F3D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    item.innerHTML = inner;
    item.onclick = function(e) {
      e.stopPropagation();
      setter(opt.val);
      // Update th label
      var lbl = document.getElementById(labelId);
      if(lbl) lbl.textContent = opt.val === 'tous' ? defaultLabel : opt.label;
      // Mark th as active
      var thEl2 = document.getElementById('th-'+type);
      if(thEl2) thEl2.classList.toggle('active', opt.val !== 'tous');
      closeRtDropdowns();
      applyRtFilters();
    };
    dd.appendChild(item);
  });
  // Position under the th
  var rect = thEl.getBoundingClientRect();
  dd.style.top = (rect.bottom + 4) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.display = 'block';
  thEl.classList.add('active');
}

function closeRtDropdowns() {
  ['rt-dd-cat','rt-dd-niveau','rt-dd-statut'].forEach(function(id){
    var d = document.getElementById(id);
    if(d) d.style.display = 'none';
  });
  rtOpenDD = null;
}

function applyRtFilters() {
  renderRiskTable();
}

/* closeRtDropdowns géré par listener global */

function searchRisks(val){ renderRiskTable(undefined, val); }

/* ── CARTOGRAPHIE ── */
var lockedRisks = {};
var draggedRiskId = null;

function renderCarto(){
  renderCartoFilterPills();
  renderCartoMatrix();
  renderCartoTable();
  var sub = document.getElementById('carto-sub');
  if(sub) sub.textContent = 'Mis à jour le '+formatDateFr();
}



function renderCartoMatrix(){
  var cells = document.getElementById('cartoMatrix').querySelectorAll('.m-cell');
  cells.forEach(function(c){ Array.from(c.querySelectorAll('.r-bubble')).forEach(function(b){ b.remove(); }); });
  riskData.forEach(function(r){
    var rowIdx = (3 - r.impact) * 4 + r.proba;
    var cell = cells[rowIdx]; if(!cell) return;
    var b = document.createElement('div');
    b.className = 'r-bubble' + (lockedRisks[r.id] ? ' locked' : '') + (riskVisible(r) ? '' : ' filtered-out');
    b.style.background = r.color;
    b.title = r.name + ' — ' + levelLabel[r.level] + (lockedRisks[r.id] ? ' (verrouillé)' : '');
    b.textContent = r.name.substring(0,2).toUpperCase();
    b.setAttribute('data-rid', r.id);
    if(!lockedRisks[r.id]){
      b.draggable = true;
      b.addEventListener('dragstart', function(e){
        draggedRiskId = r.id;
        b.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      b.addEventListener('dragend', function(){
        b.classList.remove('dragging');
        draggedRiskId = null;
        document.querySelectorAll('.m-cell').forEach(function(c){ c.classList.remove('drag-over'); });
      });
    }
    b.addEventListener('click', function(e){
      if(!e.defaultPrevented) openModal(r.id);
    });
    b.addEventListener('mouseenter', function(e){ showCartoTooltip(e, r); });
    b.addEventListener('mousemove', function(e){ moveCartoTooltip(e); });
    b.addEventListener('mouseleave', function(){ hideCartoTooltip(); });
    cell.insertBefore(b, cell.querySelector('.m-cell-lbl'));
  });
  cells.forEach(function(cell){
    cell.addEventListener('dragover', function(e){
      if(draggedRiskId){ e.preventDefault(); cell.classList.add('drag-over'); }
    });
    cell.addEventListener('dragleave', function(){ cell.classList.remove('drag-over'); });
    cell.addEventListener('drop', function(e){
      e.preventDefault();
      cell.classList.remove('drag-over');
      if(!draggedRiskId) return;
      var r = riskData.find(function(x){ return x.id===draggedRiskId; });
      if(!r || lockedRisks[r.id]) return;
      var newRow = parseInt(cell.getAttribute('data-r'));
      var newCol = parseInt(cell.getAttribute('data-c'));
      r.impact = 3 - newRow;
      r.proba = newCol;
      sbSaveRisk(r); // BUG#1 FIX — persiste les nouvelles coordonnées impact/proba
      renderCartoMatrix();
      renderCartoTable();
      showToast('Risque "' + r.name + '" repositionné');
    });
  });
}

function toggleLock(id){
  lockedRisks[id] = !lockedRisks[id];
  renderCartoMatrix();
  renderCartoTable();
  showToast(lockedRisks[id] ? 'Risque verrouillé' : 'Risque déverrouillé');
}

function renderCartoTable(){
  var tbody = document.getElementById('cartoTableBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  var order = {critique:0,eleve:1,modere:2,faible:3};
  var sorted = riskData.slice().sort(function(a,b){ return order[a.level]-order[b.level]; });
  var visibleCount = 0;
  sorted.forEach(function(r){
    var visible = riskVisible(r);
    if(visible) visibleCount++;
    var tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    if(!visible){ tr.style.display = 'none'; }
    var dot = statusDot[r.status] || '#94A3B8';
    var meta = modalMeta[r.id]||{};
    var initiales = meta.initiales||'';
    var responsableHTML = initiales
      ?'<span class="rt-resp-val">'+initiales+'</span>'
      :'<span class="rt-resp-empty">—</span>';
    // Colonnes : Catégorie | Risque | Niveau | Responsable | Statut
    tr.innerHTML = '<td style="color:#71869A;">'+escHtml(r.cat)+'</td>'
      + '<td><span class="rdot" style="background:'+r.color+';"></span>'+escHtml(r.name)+'</td>'
      + '<td><span class="ri-badge '+levelBadge[r.level]+'">'+levelLabel[r.level]+'</span></td>'
      + '<td>'+responsableHTML+'</td>'
      + '<td><div class="status-pill"><div class="status-dot" style="background:'+dot+';"></div><span style="font-size:11px;">'+r.status+'</span></div></td>';
    tr.addEventListener('click', function(){ openModal(r.id); });
    tr.addEventListener('mouseenter', function(e){ showCartoTooltip(e, r); });
    tr.addEventListener('mousemove', function(e){ moveCartoTooltip(e); });
    tr.addEventListener('mouseleave', function(){ hideCartoTooltip(); });
    tbody.appendChild(tr);
  });
  var title = document.getElementById('cartoListTitle');
  if(title) title.textContent = visibleCount + ' risque' + (visibleCount>1?'s':'') + ' positionné' + (visibleCount>1?'s':'');
}

/* ── FILTRES DANS LES EN-TÊTES DU TABLEAU CARTO ── */
/* ── FILTRE CARTO — DROPDOWNS EN-TÊTES ── */
var cartoFilterCat = 'tous';
var cartoFilterLevel = 'tous';
var cartoFilterStatus = 'tous';
var cartoOpenDD = null;

function riskVisible(r){
  var catOk = cartoFilterCat==='tous' || r.cat===cartoFilterCat;
  var lvlOk = cartoFilterLevel==='tous' || r.level===cartoFilterLevel;
  var statOk = cartoFilterStatus==='tous' || r.status===cartoFilterStatus;
  return catOk && lvlOk && statOk;
}

function renderCartoFilterPills(){ /* no-op */ }
function updateCartoResetBtn(){ /* no-op */ }
function resetCartoFilters(){
  cartoFilterCat='tous'; cartoFilterLevel='tous'; cartoFilterStatus='tous';
  ['cth-cat','cth-niveau','cth-statut'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.remove('active');
  });
  document.getElementById('cth-cat-label').textContent='Catégorie';
  document.getElementById('cth-niveau-label').textContent='Niveau';
  document.getElementById('cth-statut-label').textContent='Statut';
  renderCartoMatrix(); renderCartoTable();
}

function toggleCartoDropdown(type, thEl){
  var ddId = 'carto-dd-' + type;
  if(cartoOpenDD === ddId){ closeCartoDropdowns(); return; }
  closeCartoDropdowns();
  cartoOpenDD = ddId;
  var dd = document.getElementById(ddId);
  var options, currentVal, setter, labelId, defaultLabel;
  if(type==='cat'){
    var cats = ['tous'];
    riskData.forEach(function(r){ if(cats.indexOf(r.cat)===-1) cats.push(r.cat); });
    options = cats.map(function(c){ return {val:c, label:c==='tous'?'Toutes les catégories':c, dot:''}; });
    currentVal=cartoFilterCat; setter=function(v){cartoFilterCat=v;};
    labelId='cth-cat-label'; defaultLabel='Catégorie';
  } else if(type==='niveau'){
    options=[
      {val:'tous',label:'Tous les niveaux',dot:''},
      {val:'critique',label:'Critique',dot:'#E24B4A'},
      {val:'eleve',label:'Élevé',dot:'#EF9F27'},
      {val:'modere',label:'Modéré',dot:'#4A90D9'},
      {val:'faible',label:'Faible',dot:'#1D9E75'}
    ];
    currentVal=cartoFilterLevel; setter=function(v){cartoFilterLevel=v;};
    labelId='cth-niveau-label'; defaultLabel='Niveau';
  } else {
    options=[
      {val:'tous',label:'Tous les statuts',dot:''},
      {val:'En cours',label:'En cours',dot:'#E24B4A'},
      {val:'À traiter',label:'À traiter',dot:'#EF9F27'},
      {val:'Surveillé',label:'Surveillé',dot:'#94A3B8'},
      {val:'Traité',label:'Traité',dot:'#1D9E75'}
    ];
    currentVal=cartoFilterStatus; setter=function(v){cartoFilterStatus=v;};
    labelId='cth-statut-label'; defaultLabel='Statut';
  }
  dd.innerHTML='';
  options.forEach(function(opt,idx){
    if(idx===1){ var sep=document.createElement('div'); sep.className='rt-dd-sep'; dd.appendChild(sep); }
    var item=document.createElement('div');
    item.className='rt-dd-item'+(currentVal===opt.val?' selected':'');
    var inner='';
    if(opt.dot) inner+='<span class="rt-dd-dot" style="background:'+opt.dot+';"></span>';
    inner+='<span>'+opt.label+'</span>';
    if(currentVal===opt.val) inner+='<svg style="margin-left:auto;" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#0A1F3D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    item.innerHTML=inner;
    item.onclick=function(e){
      e.stopPropagation();
      setter(opt.val);
      var lbl=document.getElementById(labelId);
      if(lbl) lbl.textContent=opt.val==='tous'?defaultLabel:opt.label;
      var thEl2=document.getElementById('cth-'+type);
      if(thEl2) thEl2.classList.toggle('active', opt.val!=='tous');
      closeCartoDropdowns();
      renderCartoMatrix(); renderCartoTable();
    };
    dd.appendChild(item);
  });
  var rect=thEl.getBoundingClientRect();
  dd.style.top=(rect.bottom+4)+'px';
  dd.style.left=rect.left+'px';
  dd.style.display='block';
  thEl.classList.add('open');
}

function closeCartoDropdowns(){
  ['carto-dd-cat','carto-dd-niveau','carto-dd-statut'].forEach(function(id){
    var d=document.getElementById(id); if(d) d.style.display='none';
  });
  document.querySelectorAll('#cth-cat,#cth-niveau,#cth-statut').forEach(function(el){ el.classList.remove('open'); });
  cartoOpenDD=null;
}

/* closeCartoDropdowns géré par listener global */



var impactLabel = ['Mineur','Modéré','Élevé','Majeur'];
var probaLabel = ['Rare','Possible','Probable','Quasi-certain'];

function showCartoTooltip(e, r){
  var t = document.getElementById('cartoTooltip');
  var lvlCol = levelColors2[r.level] || '#94A3B8';
  var html = '<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:500;background:rgba(255,255,255,0.15);color:'+lvlCol+';">'+levelLabel[r.level]+'</span>'
    + '<span style="font-weight:500;margin-left:6px;color:#fff;font-size:11px;">'+escHtml(r.name)+'</span>'
    + '<div style="display:flex;gap:10px;font-size:10px;color:#94A3B8;margin-top:5px;">'
    + '<span>&#8597; Impact : <strong style="color:#CBD5E1;">'+impactLabel[r.impact]+'</strong></span>'
    + '<span>&rarr; Proba : <strong style="color:#CBD5E1;">'+probaLabel[r.proba]+'</strong></span>'
    + '<span>&bull; <strong style="color:#CBD5E1;">'+r.status+'</strong></span>'
    + '</div>';
  document.getElementById('ctContent').innerHTML = html;
  t.style.display = 'block';
  moveCartoTooltip(e);
}
function moveCartoTooltip(e){
  var t = document.getElementById('cartoTooltip');
  t.style.left = (e.clientX + 16) + 'px';
  t.style.top = (e.clientY - 10) + 'px';
}
function hideCartoTooltip(){
  document.getElementById('cartoTooltip').style.display = 'none';
}


/* ── PLANS D'ACTION & CONTRÔLES PAR DÉFAUT (selon catégorie) ── */
var DEFAULT_BY_CAT = {
  'Sanitaire': {
    actions:[
      {titre:'Vérifier et mettre à jour les relevés de températures frigos/congélateurs',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Mettre à jour les fiches allergènes de tous les plats de la carte',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Former le personnel aux bonnes pratiques d\'hygiène alimentaire (HACCP)',priorite:'urgent',delai:'Ce mois'},
      {titre:'Vérifier les DLC de tous les produits en stock',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Contrôler la séparation physique aliments crus / aliments cuits',priorite:'normal',delai:'Ce mois'},
      {titre:'Mettre en place un plan de nettoyage et désinfection des surfaces',priorite:'normal',delai:'Ce mois'},
      {titre:'Conserver des plats témoins après chaque service (48h minimum)',priorite:'normal',delai:'Ce mois'},
      {titre:'Vérifier la traçabilité des fournisseurs pour chaque produit',priorite:'planif',delai:'Ce trimestre'}
    ],
    controles:[
      {titre:'Relevé des températures frigos et congélateurs (matin + soir)',frequence:'Quotidien'},
      {titre:'Vérification DLC produits frais à réception',frequence:'À chaque livraison'},
      {titre:'Contrôle propreté surfaces de travail avant ouverture',frequence:'Quotidien'},
      {titre:'Test de l\'huile de friture (acidité / couleur)',frequence:'Quotidien'},
      {titre:'Vérification températures plats chauds avant envoi (>63°C)',frequence:'À chaque service'},
      {titre:'Désinfection des planches à découper entre chaque aliment',frequence:'Continu'},
      {titre:'Contrôle des stocks et rotation PEPS',frequence:'Hebdomadaire'},
      {titre:'Vérification des fiches allergènes et affichage obligatoire',frequence:'Mensuel'},
      {titre:'Audit interne hygiène complet (grille DDPP)',frequence:'Trimestriel'}
    ]
  },
  'Conformité réglementaire': {
    actions:[
      {titre:'Réaliser un auto-diagnostic de conformité DDPP (grille officielle)',priorite:'urgent',delai:'Ce mois'},
      {titre:'Tenir à jour le classeur DDPP avec tous les documents obligatoires',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Vérifier que les affichages obligatoires sont présents et à jour',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Planifier la prochaine visite de la commission de sécurité ERP',priorite:'urgent',delai:'Ce mois'},
      {titre:'Vérifier la validité de toutes les certifications en cours',priorite:'normal',delai:'Ce mois'},
      {titre:'Corriger immédiatement les non-conformités identifiées',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Former le personnel aux procédures en cas de contrôle',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Vérification affichage prix, allergènes, mentions légales',frequence:'Mensuel'},
      {titre:'Revue du classeur DDPP (registres, certifications, relevés)',frequence:'Mensuel'},
      {titre:'Contrôle validité des certifications (HACCP, pompiers, ERP)',frequence:'Trimestriel'},
      {titre:'Auto-audit conformité complet (grille officielle)',frequence:'Trimestriel'},
      {titre:'Vérification registre de sécurité incendie à jour',frequence:'Trimestriel'},
      {titre:'Contrôle conformité carte et menus (allergènes, prix TTC)',frequence:'À chaque changement de carte'}
    ]
  },
  'Financier': {
    actions:[
      {titre:'Établir un prévisionnel de trésorerie sur 12 mois glissants',priorite:'urgent',delai:'Ce mois'},
      {titre:'Calculer le food cost réel par catégorie de plat',priorite:'urgent',delai:'Ce mois'},
      {titre:'Négocier des délais de paiement fournisseurs (report 30 jours)',priorite:'normal',delai:'Ce mois'},
      {titre:'Ouvrir une ligne de crédit court terme en prévention',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Identifier les plats avec food cost > 35% et les reformuler',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Créer une réserve de trésorerie (8% du CA mensuel en période haute)',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Réviser la carte et les prix une fois par trimestre',priorite:'planif',delai:'Ce trimestre'}
    ],
    controles:[
      {titre:'Suivi du CA quotidien vs objectif',frequence:'Quotidien'},
      {titre:'Vérification solde de caisse et réconciliation',frequence:'Quotidien'},
      {titre:'Point trésorerie (solde, entrées, sorties prévues)',frequence:'Hebdomadaire'},
      {titre:'Calcul du food cost global',frequence:'Hebdomadaire'},
      {titre:'Rapprochement bancaire et suivi du prévisionnel',frequence:'Mensuel'},
      {titre:'Revue des marges par famille de plats',frequence:'Mensuel'},
      {titre:'Analyse des écarts de caisse',frequence:'Mensuel'},
      {titre:'Revue du tableau de bord financier complet',frequence:'Mensuel'}
    ]
  },
  'Ressources Humaines': {
    actions:[
      {titre:'Documenter les procédures clés pour assurer la continuité en cas d\'absence',priorite:'urgent',delai:'Ce mois'},
      {titre:'Identifier un remplaçant ou réseau de remplacement',priorite:'normal',delai:'Ce mois'},
      {titre:'Mettre en place un processus d\'intégration structuré sur 30 jours',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Proposer des avantages concurrentiels pour fidéliser l\'équipe',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Organiser des sessions de transmission de compétences croisées',priorite:'normal',delai:'Ce mois'},
      {titre:'Établir un planning renforcé pour les périodes de pic d\'activité',priorite:'urgent',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Suivi des présences et absences',frequence:'Quotidien'},
      {titre:'Vérification du planning vs besoins service',frequence:'Hebdomadaire'},
      {titre:'Calcul du taux de turnover',frequence:'Mensuel'},
      {titre:'Entretien individuel avec chaque membre de l\'équipe',frequence:'Trimestriel'},
      {titre:'Baromètre de satisfaction équipe (questionnaire anonyme)',frequence:'Trimestriel'},
      {titre:'Revue des contrats, heures supplémentaires et congés',frequence:'Mensuel'},
      {titre:'Évaluation annuelle des compétences',frequence:'Annuel'}
    ]
  },
  'Réputation': {
    actions:[
      {titre:'Répondre à tous les avis négatifs sous 48h de manière professionnelle',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Installer des QR codes sur les tables pour collecter les avis positifs',priorite:'normal',delai:'Ce mois'},
      {titre:'Analyser les motifs récurrents des avis négatifs',priorite:'urgent',delai:'Ce mois'},
      {titre:'Nommer un responsable de la réputation digitale',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Créer un protocole de gestion de crise réputation',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Mettre en place une enquête de satisfaction en sortie de caisse',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Veille des avis Google, TripAdvisor, TheFork',frequence:'Quotidien'},
      {titre:'Suivi de la note moyenne (toutes plateformes)',frequence:'Hebdomadaire'},
      {titre:'Vérification du taux de réponse aux avis',frequence:'Hebdomadaire'},
      {titre:'Analyse des verbatims négatifs et plan correctif',frequence:'Mensuel'},
      {titre:'Mesure NPS client',frequence:'Mensuel'},
      {titre:'Veille presse et réseaux sociaux',frequence:'Hebdomadaire'}
    ]
  },
  'Juridique': {
    actions:[
      {titre:'Faire auditer tous les contrats par un juriste droit social',priorite:'urgent',delai:'Ce mois'},
      {titre:'Vérifier la conformité avec la Convention Collective HCR',priorite:'urgent',delai:'Ce mois'},
      {titre:'Mettre en place un système de badgeage fiable et conforme',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Régulariser les heures supplémentaires non déclarées',priorite:'urgent',delai:'Ce mois'},
      {titre:'Vérifier la validité et l\'adéquation de toutes les assurances',priorite:'urgent',delai:'Ce mois'},
      {titre:'Contrôler la date d\'échéance du bail commercial',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Vérification des obligations légales et réglementaires',frequence:'Trimestriel'},
      {titre:'Audit social (contrats, bulletins de paie, congés)',frequence:'Annuel'},
      {titre:'Revue des assurances (RC Pro, multirisque, perte exploitation)',frequence:'Annuel'},
      {titre:'Veille des évolutions réglementaires secteur CHR',frequence:'Mensuel'},
      {titre:'Vérification de l\'échéancier du bail commercial',frequence:'Semestriel'}
    ]
  },
  'Opérationnel': {
    actions:[
      {titre:'Souscrire un contrat de maintenance préventive (intervention < 4h)',priorite:'urgent',delai:'Ce mois'},
      {titre:'Établir une procédure de secours documentée pour chaque équipement critique',priorite:'normal',delai:'Ce mois'},
      {titre:'Installer une alarme température avec alerte SMS',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Identifier un prestataire de remplacement disponible 7j/7',priorite:'normal',delai:'Ce mois'},
      {titre:'Tenir un inventaire chiffré des stocks pour déclaration sinistre',priorite:'planif',delai:'Ce trimestre'}
    ],
    controles:[
      {titre:'Vérification visuelle des équipements avant chaque service',frequence:'Quotidien'},
      {titre:'Relevé des températures chambres froides',frequence:'Quotidien'},
      {titre:'Vérification joints, éclairage et alarmes chambres froides',frequence:'Hebdomadaire'},
      {titre:'Test des procédures de secours',frequence:'Trimestriel'},
      {titre:'Maintenance préventive équipements lourds (four, friteuse, plaque)',frequence:'Semestriel'},
      {titre:'Vérification des contrats de maintenance en cours',frequence:'Annuel'}
    ]
  },
  'Commercial': {
    actions:[
      {titre:'Calculer la marge réelle par canal de vente (salle / livraison / click&collect)',priorite:'urgent',delai:'Ce mois'},
      {titre:'Diversifier les sources de revenus (traiteur, click&collect, cours)',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Développer un canal de commande directe (site, WhatsApp Business)',priorite:'normal',delai:'Ce trimestre'},
      {titre:'Mettre en place un programme de fidélité client',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Analyser les pics et creux saisonniers et adapter l\'offre',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Suivi du CA par canal de vente',frequence:'Mensuel'},
      {titre:'Analyse du taux de remplissage salle',frequence:'Hebdomadaire'},
      {titre:'Suivi du ratio commissions plateformes / CA livraison',frequence:'Mensuel'},
      {titre:'Revue des offres et promotions en cours',frequence:'Mensuel'},
      {titre:'Analyse de la concurrence locale',frequence:'Trimestriel'}
    ]
  },
  'Sécurité': {
    actions:[
      {titre:'Vérifier la validité du rapport de la commission de sécurité ERP',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Contrôler les extincteurs et le balisage des issues de secours',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Tester les détecteurs de fumée et alarmes incendie',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Organiser un exercice d\'évacuation avec l\'équipe',priorite:'normal',delai:'Ce mois'},
      {titre:'Afficher les consignes de sécurité et plans d\'évacuation',priorite:'normal',delai:'Ce mois'},
      {titre:'Programmer la visite de contrôle de l\'installation gaz',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Vérifier la conformité de la terrasse et des espaces extérieurs ERP',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Vérification issues de secours dégagées avant ouverture',frequence:'Quotidien'},
      {titre:'Contrôle visuel hotte et filtres à graisse (risque incendie)',frequence:'Hebdomadaire'},
      {titre:'Test alarme incendie et détecteurs de fumée',frequence:'Mensuel'},
      {titre:'Contrôle état extincteurs (pression, scellé, date)',frequence:'Mensuel'},
      {titre:'Vérification registre de sécurité incendie',frequence:'Trimestriel'},
      {titre:'Visite commission de sécurité ERP',frequence:'Annuel'},
      {titre:'Contrôle installation gaz et électricité',frequence:'Annuel'}
    ]
  },
  'Numérique': {
    actions:[
      {titre:'Activer les mises à jour automatiques sur tous les postes et logiciels',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Installer un antivirus professionnel sur tous les postes de travail',priorite:'urgent',delai:'Cette semaine'},
      {titre:'Mettre en place des sauvegardes automatiques hors ligne (NAS ou cloud)',priorite:'urgent',delai:'Ce mois'},
      {titre:'Mettre en place un terminal de paiement de secours',priorite:'urgent',delai:'Ce mois'},
      {titre:'Former le personnel à reconnaître les tentatives de phishing',priorite:'normal',delai:'Ce mois'},
      {titre:'Souscrire un contrat d\'assistance technique 7j/7 pour la caisse',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Vérification des mises à jour logiciels et antivirus',frequence:'Hebdomadaire'},
      {titre:'Test de restauration des sauvegardes',frequence:'Mensuel'},
      {titre:'Vérification sauvegarde cloud données de caisse',frequence:'Quotidien'},
      {titre:'Test du terminal de paiement de secours',frequence:'Hebdomadaire'},
      {titre:'Revue des accès distants et mots de passe',frequence:'Trimestriel'},
      {titre:'Audit sécurité informatique complet',frequence:'Annuel'}
    ]
  },
  'Autre': {
    actions:[
      {titre:'Analyser les causes et conséquences de ce risque',priorite:'urgent',delai:'Ce mois'},
      {titre:'Définir un responsable et un plan de traitement',priorite:'normal',delai:'Ce mois'},
      {titre:'Planifier une revue de ce risque dans 3 mois',priorite:'planif',delai:'Ce trimestre'},
      {titre:'Documenter le risque et le partager avec l\'équipe concernée',priorite:'normal',delai:'Ce mois'}
    ],
    controles:[
      {titre:'Suivi mensuel du statut de ce risque',frequence:'Mensuel'},
      {titre:'Point de revue trimestriel avec le responsable désigné',frequence:'Trimestriel'}
    ]
  }
};

function getDefaultRef(cat, name, level) {
  var d = DEFAULT_BY_CAT[cat] || DEFAULT_BY_CAT['Autre'];
  return {
    id: 'custom_ref',
    nom: name,
    categorie: cat,
    niveau: level,
    description: '',
    actions: d.actions,
    controles: d.controles
  };
}

/* ── FORMULAIRE AJOUT RISQUE ── */
function openAddRisk(){
  ['f-name','f-desc','f-action','f-controle'].forEach(function(id){document.getElementById(id).value='';});
  ['f-cat','f-level'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('f-status').value='À traiter';
  document.getElementById('f-impact').value='2';
  document.getElementById('f-proba').value='2';
  document.getElementById('addRiskOverlay').classList.add('open');
  setTimeout(function(){document.getElementById('f-name').focus();},100);
}
function closeAddRisk(){document.getElementById('addRiskOverlay').classList.remove('open');}
function closeAddRiskOutside(e){if(e.target===document.getElementById('addRiskOverlay'))closeAddRisk();}

function saveNewRisk(){
  var name=document.getElementById('f-name').value.trim();
  var cat=document.getElementById('f-cat').value;
  var level=document.getElementById('f-level').value;
  if(!name||!cat||!level){showToast('Veuillez remplir les champs obligatoires',true);return;}
  var rid=genId();
  var impactEl=document.getElementById('f-impact');
  var probaEl=document.getElementById('f-proba');
  var r={
    id:rid,name:name,cat:cat,level:level,
    status:document.getElementById('f-status').value||'À traiter',
    date:"À l'instant",source:'custom',color:levelColors[level],
    impact:impactEl?parseInt(impactEl.value)||2:2,
    proba:probaEl?parseInt(probaEl.value)||2:2,
    desc:(document.getElementById('f-desc')?document.getElementById('f-desc').value:''),
    action:(document.getElementById('f-action')?document.getElementById('f-action').value:''),
    controle:(document.getElementById('f-controle')?document.getElementById('f-controle').value:'')
  };
  riskData.push(r);
  sbSaveRisk(r);
  sbSaveHistory({type:'risque', title:'Risque ajouté — '+name, desc:'Catégorie '+cat+' · Niveau '+levelLabel[level]});
  var ref = getDefaultRef(cat, name, level);
  ref.id = rid;
  if(r.action && r.action.trim()){
    ref.actions = [{titre:r.action.trim(),priorite:'urgent',delai:'Ce mois'}].concat(ref.actions);
  }
  if(r.controle && r.controle.trim()){
    ref.controles = [{titre:r.controle.trim(),frequence:'À définir'}].concat(ref.controles);
  }
  CLEARISK_DB[ACCOUNT_SECTOR].push(ref);
  modals[rid]={title:name, sub:cat+' · '+levelLabel[level]+' · Risque personnalisé', content:''};
  closeAddRisk();
  renderRiskTable(currentFilter);
  renderDashboard();
  showToast('Risque "'+name+'" ajouté avec succès');
}

function buildCustomContent(r){
  var h='<div class="modal-section"><div class="ms-title">Vue d\'ensemble</div><div class="ms-row">'
    +'<div class="ms-cell"><div class="ms-cell-label">Niveau</div><div class="ms-cell-value" style="color:'+r.color+';">'+levelLabel[r.level]+'</div></div>'
    +'<div class="ms-cell"><div class="ms-cell-label">Statut</div><div class="ms-cell-value">'+r.status+'</div></div>'
    +'<div class="ms-cell"><div class="ms-cell-label">Catégorie</div><div class="ms-cell-value">'+escHtml(r.cat)+'</div></div>'
    +'<div class="ms-cell"><div class="ms-cell-label">Ajouté</div><div class="ms-cell-value">À l\'instant</div></div>'
    +'</div></div>';
  if(r.desc)h+='<div class="modal-section"><div class="ms-title">Description</div><div class="ms-text">'+escHtml(r.desc)+'</div></div>';
  h+='<div class="modal-section"><div class="ms-title">Recommandation IA</div><div class="ms-ia-box"><div class="ms-ia-label">Analyse Clearisk</div><div class="ms-ia-text">Risque personnalisé en cours d\'analyse. Clearisk génèrera des recommandations lors de votre prochain diagnostic mensuel.</div></div></div>';
  if(r.action)h+='<div class="modal-section"><div class="ms-title">Plan d\'action</div><div class="modal-action-item" onclick="toggleMac(this)"><div class="mac-check"></div><div class="mac-label">'+r.action+'</div><div class="mac-due">À faire</div></div></div>';
  h+='<div class="modal-section"><div class="ms-title">Historique</div><div class="hist-entry"><div class="hist-date">Maintenant</div><div class="hist-content">Risque créé manuellement<span class="hist-tag" style="background:#EBF4FF;color:#1A5CAB;">Ajout</span></div></div></div>';
  return h;
}

/* ── EXPORT PDF CARTOGRAPHIE ── */
function exportCartoPDF(){
  var now = new Date();
  var months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var dateStr = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  var timeStr = ('0'+now.getHours()).slice(-2) + 'h' + ('0'+now.getMinutes()).slice(-2);
  var impactLabel2 = ['Mineur','Modéré','Élevé','Majeur'];
  var probaLabel2 = ['Rare','Possible','Probable','Quasi-certain'];

  // Sort: critique first
  var order2 = {critique:0,eleve:1,modere:2,faible:3};
  var sorted = riskData.slice().sort(function(a,b){ return order2[a.level]-order2[b.level]; });

  // Stats
  var critCount = sorted.filter(function(r){return r.level==='critique';}).length;
  var elevCount = sorted.filter(function(r){return r.level==='eleve';}).length;
  var modCount = sorted.filter(function(r){return r.level==='modere';}).length;
  var faiCount = sorted.filter(function(r){return r.level==='faible';}).length;

  var risksHTML = sorted.map(function(r){
    var col = levelColors2[r.level] || '#94A3B8';
    var bg = levelBg2[r.level] || '#F8FAFC';
    var dotCol = statusDot2[r.status] || '#94A3B8';
    var desc = r.desc || '';
    // Get actions from actionData — BUG#3 FIX : liaison par riskId en priorité
    var linkedActions = actionData.filter(function(a){ return a.riskId ? a.riskId===r.id : a.risk===r.name; });
    var actHTML = '';
    if(linkedActions.length){
      actHTML = '<div style="margin-top:6px;">'
        + linkedActions.map(function(a){
            var ac = a.done ? '#1D9E75' : (a.due==='late' ? '#E24B4A' : '#EF9F27');
            return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'
              +'<div style="width:5px;height:5px;border-radius:50%;background:'+ac+';flex-shrink:0;"></div>'
              +'<span style="font-size:10px;color:#374151;">'+(a.done?'<s>':'')+a.name+(a.done?'</s>':'')+' <span style="color:#94A3B8;">· '+a.dueLabel+'</span></span>'
              +'</div>';
          }).join('')
        + '</div>';
    }
    var initials = r.name.substring(0,2).toUpperCase();
    return '<div style="border:1px solid #E2E8F0;border-radius:8px;padding:14px 16px;margin-bottom:10px;break-inside:avoid;border-left:3px solid '+col+';">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">'
      +'<div style="width:26px;height:26px;border-radius:50%;background:'+r.color+';display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:500;color:#fff;flex-shrink:0;">'+initials+'</div>'
      +'<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:'+bg+';color:'+col+';">'+levelLabel2[r.level]+'</span>'
      +'<span style="font-size:13px;font-weight:500;color:#0A1F3D;flex:1;">'+escHtml(r.name)+'</span>'
      +'<span style="font-size:10px;color:#94A3B8;">'+escHtml(r.cat)+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:16px;font-size:10px;color:#71869A;margin-bottom:'+(desc||actHTML?'8':'0')+'px;">'
      +'<span>↕ Impact : <strong>'+impactLabel2[r.impact]+'</strong></span>'
      +'<span>→ Probabilité : <strong>'+probaLabel2[r.proba]+'</strong></span>'
      +'<span style="display:flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:'+dotCol+';display:inline-block;"></span>'+r.status+'</span>'
      +'</div>'
      +(desc ? '<div style="font-size:11px;color:#374151;line-height:1.6;margin-bottom:'+(actHTML?'6':'0')+'px;">'+desc+'</div>' : '')
      +(actHTML ? '<div style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Actions liées</div>'+actHTML : '')
      +'</div>';
  }).join('');

  var html = '<div id="pdf-carto-export" style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;background:#fff;padding:40px;max-width:900px;margin:0 auto;">'

    // Header
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #0A1F3D;">'
    +'<div><div style="font-size:24px;font-weight:500;color:#0A1F3D;letter-spacing:-0.5px;margin-bottom:4px;">clear<span style="color:#94A3B8;">isk</span></div>'
    +'<div style="font-size:18px;font-weight:500;color:#0A1F3D;margin-bottom:3px;">Rapport de cartographie des risques</div>'
    +'<div style="font-size:11px;color:#94A3B8;">Généré le '+dateStr+' à '+timeStr+' · '+sorted.length+' risques positionnés</div></div>'
    +'<div style="text-align:right;"><div style="font-size:11px;color:#94A3B8;margin-bottom:6px;">Score de résilience</div>'
    +'<div style="font-size:36px;font-weight:500;color:#0A1F3D;letter-spacing:-2px;line-height:1;">'+calcScoreDynamic()+'<span style="font-size:14px;color:#94A3B8;">/100</span></div></div>'
    +'</div>'

    // KPIs
    +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:28px;">'
    +'<div style="background:#FDEAEA;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:500;color:#E24B4A;">'+critCount+'</div><div style="font-size:10px;color:#8B0000;font-weight:500;text-transform:uppercase;letter-spacing:.06em;">Critiques</div></div>'
    +'<div style="background:#FEF3E2;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:500;color:#EF9F27;">'+elevCount+'</div><div style="font-size:10px;color:#7A4500;font-weight:500;text-transform:uppercase;letter-spacing:.06em;">Élevés</div></div>'
    +'<div style="background:#EBF4FF;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:500;color:#1A5CAB;">'+modCount+'</div><div style="font-size:10px;color:#1A5CAB;font-weight:500;text-transform:uppercase;letter-spacing:.06em;">Modérés</div></div>'
    +'<div style="background:#EAFAF3;border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:500;color:#1D9E75;">'+faiCount+'</div><div style="font-size:10px;color:#0A6640;font-weight:500;text-transform:uppercase;letter-spacing:.06em;">Faibles</div></div>'
    +'</div>'

    // Matrix cartography
    +(function(){
      var cellBg = [
        ['#F9D4D4','#F9D4D4','#FCE8C0','#FCE8C0'],
        ['#F9D4D4','#FCE8C0','#FCE8C0','#CCE4F7'],
        ['#FCE8C0','#FCE8C0','#CCE4F7','#C8F0DF'],
        ['#FCE8C0','#CCE4F7','#C8F0DF','#C8F0DF']
      ];
      var impactLabels2 = ['Mineur','Modéré','Élevé','Majeur'];
      var probaLabels2 = ['Rare','Possible','Probable','Quasi-certain'];
      var cellSize = 110;
      var matHtml = '<div style="margin-bottom:28px;break-inside:avoid;">'
        +'<div style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;">Matrice cartographique — Impact × Probabilité</div>'
        +'<div style="display:flex;align-items:flex-start;gap:0;">'
        // Y axis label
        +'<div style="display:flex;flex-direction:column;justify-content:space-around;height:'+(cellSize*4)+'px;padding-right:6px;width:50px;">';
      for(var iy=3;iy>=0;iy--){
        matHtml+='<div style="font-size:8px;color:#94A3B8;text-align:right;line-height:1.2;">'+impactLabels2[iy]+'</div>';
      }
      matHtml+='</div>'
        // Grid
        +'<div style="flex:1;">'
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,'+cellSize+'px);gap:2px;">';
      // Rows: top = high impact (3), bottom = low impact (0)
      for(var row=0;row<4;row++){
        for(var col=0;col<4;col++){
          var impactIdx = 3-row;
          var bg2 = cellBg[row][col];
          // Find risks in this cell
          var cellRisks = riskData.filter(function(r){ return r.impact===impactIdx && r.proba===col; });
          var bubblesHtml = cellRisks.map(function(r){
            return '<div title="'+r.name+'" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:'+r.color+';color:#fff;font-size:7px;font-weight:600;border:2px solid rgba(255,255,255,0.6);flex-shrink:0;">'+r.name.substring(0,2).toUpperCase()+'</div>';
          }).join('');
          matHtml+='<div style="background:'+bg2+';border-radius:5px;padding:5px;display:flex;flex-wrap:wrap;gap:3px;align-content:flex-start;position:relative;">'
            +bubblesHtml
            +'</div>';
        }
      }
      matHtml+='</div>'
        // X axis labels
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);margin-top:4px;">';
      for(var ix=0;ix<4;ix++){
        matHtml+='<div style="font-size:8px;color:#94A3B8;text-align:center;">'+probaLabels2[ix]+'</div>';
      }
      matHtml+='</div>'
        +'<div style="text-align:center;font-size:8px;color:#94A3B8;margin-top:3px;letter-spacing:.1em;text-transform:uppercase;">Probabilité</div>'
        +'</div>'
        +'</div>'
        // Legend
        +'<div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;">'
        +'<div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#71869A;"><div style="width:11px;height:11px;border-radius:2px;background:#FDEAEA;border:1px solid #e5c5c5;"></div>Critique</div>'
        +'<div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#71869A;"><div style="width:11px;height:11px;border-radius:2px;background:#FEF3E2;border:1px solid #f0d5a0;"></div>Élevé</div>'
        +'<div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#71869A;"><div style="width:11px;height:11px;border-radius:2px;background:#EBF4FF;border:1px solid #b5d4f4;"></div>Modéré</div>'
        +'<div style="display:flex;align-items:center;gap:5px;font-size:9px;color:#71869A;"><div style="width:11px;height:11px;border-radius:2px;background:#EAFAF3;border:1px solid #9fe1cb;"></div>Faible</div>'
        +'</div>'
        +'</div>';
      return matHtml;
    })()

    // Risks list
    +'<div style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;">Détail des risques</div>'
    + risksHTML

    // Footer
    +'<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;font-size:10px;color:#94A3B8;">'
    +'<span>Clearisk — Gestion des risques professionnelle</span>'
    +'<span>Document confidentiel · '+dateStr+'</span>'
    +'</div>'
    +'</div>';

  // Open in new window and print
  var win = window.open('','_blank','width=960,height=800');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cartographie Clearisk — '+dateStr+'</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;}'
    +'@media print{body{background:#fff;}@page{margin:15mm;}}'
    +'</style>'
    +'<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>'
    +'</head><body>'+html+'</body></html>');
  win.document.close();
}

/* ── TOAST ── */
function showToast(msg,isError){
  var t=document.getElementById('toast');
  t.textContent=msg;t.style.background=isError?'#E24B4A':'#0A1F3D';
  t.classList.add('show');
  var duration = isError ? 5000 : 3500;
  setTimeout(function(){t.classList.remove('show');},duration);
}

/* ── CHECK ACTIONS ── */
function toggleCheck(item){
  var check=item.querySelector('.ai-check');
  var label=item.querySelector('.ai-label');
  var due=item.querySelector('.ai-due');
  check.classList.toggle('done');label.classList.toggle('done');
  if(check.classList.contains('done')){due.textContent='Fait';due.className='ai-due';}
}

/* ── MODAUX RISQUES EXISTANTS ── */
var modals={};

var currentModalKey = null;
var modalMeta = {};

function updateInitialesPreview(){
  var val = (document.getElementById('modalInitialesInput').value||'').toUpperCase();
  var prev = document.getElementById('modalInitialesPreview');
  if(val){ prev.textContent=val; prev.style.background='#0A1F3D'; prev.style.color='#fff'; prev.style.fontSize='9px'; }
  else { prev.textContent='—'; prev.style.background='#E2E8F0'; prev.style.color='#94A3B8'; prev.style.fontSize='9px'; }
}

function openModal(key){
  // Une seule modale pour tout — celle de Mes risques
  openRiskModal(key);
}

function renderModalBody(){
  var key = currentModalKey;
  var d = modals[key];
  var r = riskData.find(function(x){return x.id===key;});
  var meta = modalMeta[key]||{};
  var staticContent = d ? d.content : '';
  var descHTML = '';
  if(meta.desc){ descHTML='<div class="modal-section"><div class="ms-title">Description personnalisée</div><div class="ms-text">'+meta.desc+'</div></div>'; }
  var riskTitle = meta.title || (d?d.title:'') || (r?r.name:'');
  var origTitle = d?d.title:(r?r.name:'');
  // BUG#3 FIX — liaison par riskId en priorité, fallback par nom pour données existantes
  var linkedActions = actionData.filter(function(a){
    if(a.riskId) return a.riskId === key;
    return a.risk===riskTitle||a.risk===origTitle||(r&&a.risk===r.name);
  });
  var actHTML = '';
  if(linkedActions.length){
    var doneCount=linkedActions.filter(function(a){return a.done;}).length;
    var prog=doneCount+'/'+linkedActions.length+' faites';
    var pbg=doneCount===linkedActions.length?'#EAFAF3':'#FEF3E2';
    var pcol=doneCount===linkedActions.length?'#0A6640':'#7A4500';
    actHTML='<div class="modal-section"><div class="ms-title" style="display:flex;align-items:center;justify-content:space-between;">Plan d\'action li&#233; <span style="font-size:9px;background:'+pbg+';color:'+pcol+';padding:2px 8px;border-radius:20px;font-weight:500;">'+prog+'</span></div>';
    linkedActions.forEach(function(a){
      var dc=a.due==='late'?'#E24B4A':(a.due==='week'?'#EF9F27':'#94A3B8');
      actHTML+='<div class="modal-action-item" data-aid="'+a.id+'" onclick="toggleMac(this)">'
        +'<div class="mac-check'+(a.done?' done':'')+'"></div>'
        +'<div class="mac-label'+(a.done?' done':'')+'">'+a.name+'</div>'
        +'<div class="mac-due" style="color:'+dc+';">'+a.dueLabel+'</div>'
        +'</div>';
    });
    actHTML+='</div>';
  }
  document.getElementById('modalBody').innerHTML = descHTML + staticContent + actHTML;
}

function closeModal(){
  document.getElementById('modalOverlay').classList.remove('open');
  currentModalKey=null;
}
function closeModalOutside(e){if(e.target===document.getElementById('modalOverlay'))closeModal();}

function saveModalEdits(){
  if(!currentModalKey) return;
  var nt=document.getElementById('modalTitleInput').value.trim();
  var nd=document.getElementById('modalDescInput').value.trim();
  var ni=(document.getElementById('modalInitialesInput').value||'').trim().toUpperCase().slice(0,3);
  if(!nt){showToast('Intitul\u00e9 obligatoire',true);return;}
  if(!modalMeta[currentModalKey]) modalMeta[currentModalKey]={};
  modalMeta[currentModalKey].title=nt;
  modalMeta[currentModalKey].desc=nd;
  modalMeta[currentModalKey].initiales=ni;
  document.getElementById('modalTitle').textContent=nt;
  var prev=document.getElementById('modalInitialesPreview');
  if(ni){prev.textContent=ni;prev.style.background='#0A1F3D';prev.style.color='#fff';}
  else{prev.textContent='—';prev.style.background='#E2E8F0';prev.style.color='#94A3B8';}
  renderModalBody();
  if(document.getElementById('page-risques').style.display!=='none') renderRiskTable();
  showToast('Risque mis à jour');
}

function addModalAction(){
  if(!currentModalKey) return;
  var key = currentRiskModalId || currentModalKey;
  if(!key){ showToast('Aucun risque sélectionné', true); return; }
  var name=document.getElementById('modalNewActionInput').value.trim();
  if(!name){showToast('Veuillez saisir une action',true);return;}
  var due=document.getElementById('modalNewActionDue').value;
  var dueLabels={week:'Cette semaine',month:'Ce mois',quarter:'Ce trimestre',year:'Cette année'};
  var meta=modalMeta[key]||{};
  var d=modals[key];
  var r=riskData.find(function(x){return x.id===key;});
  var riskTitle=meta.title||(d?d.title:'')|(r?r.name:'');
  var cat=r?r.cat:'Autre'; var col=r?r.color:'#94A3B8';
  var newModalAct = {id:genId(),name:name,riskId:key,risk:riskTitle,cat:cat,riskColor:col,due:due,dueLabel:dueLabels[due],done:false,desc:'',note:''}; // BUG#3 FIX — riskId ajouté
  actionData.push(newModalAct);
  sbSaveAction(newModalAct);
  sbSaveHistory({type:'action', title:'Action ajoutée — '+name, desc:'Risque : '+riskTitle});
  document.getElementById('modalNewActionInput').value='';
  // Rafraîchir les deux : modale risque ET onglet Plan d'action global
  if(currentRiskModalId) openRiskModal(currentRiskModalId);
  else renderModalBody();
  if(typeof renderActions==='function') renderActions();
  showToast('Action ajoutée au plan d\'action');
}

function toggleMac(item,actionId){
  var check=item.querySelector('.mac-check');
  var label=item.querySelector('.mac-label');
  check.classList.toggle('done');label.classList.toggle('done');
  var aid=actionId||item.dataset.aid||null;
  if(aid){var a=actionData.find(function(x){return x.id===aid;});if(a){a.done=check.classList.contains('done');if(a.done){a.dueLabel='Fait';a.due='done';}}}
  renderModalBody();
}

/* ── PANNEAU BIBLIOTHÈQUE INTÉGRÉ ── */
var biblioPanelChecked={};
var biblioPanelOpen={};

function toggleBiblioCat(catId){
  biblioPanelOpen[catId]=!biblioPanelOpen[catId];
  renderBiblioPanel();
}

function openBiblioPanel(){
  biblioPanelChecked={};
  biblioPanelOpen={};
  document.getElementById('biblioOverlay').style.display='block';
  var bs=document.getElementById('biblio-search'); if(bs) bs.value='';
  if(typeof ACCOUNT_SECTOR !== 'undefined' && bibSector === 'tous') bibSector = ACCOUNT_SECTOR;
  renderBiblioPanel();
}
function closeBiblioPanel(){ document.getElementById('biblioOverlay').style.display='none'; }
function closeBiblioOutside(e){ if(e.target===document.getElementById('biblioOverlay'))closeBiblioPanel(); }

function renderBiblioPanel(){
  var searchEl=document.getElementById('biblio-search');
  var search=searchEl?(searchEl.value||'').toLowerCase():'';
  var container=document.getElementById('biblio-panel-body');
  var existingIds=riskData.map(function(r){return r.id;});
  var html='';
  var totalChecked=Object.keys(biblioPanelChecked).filter(function(k){return biblioPanelChecked[k];}).length;
  var hasAny=false;

  /* Tri alphabétique des catégories, puis des risques dans chaque catégorie */
  var sorted = bibCats.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });

  sorted.forEach(function(cat){
    var rows=cat.risks.filter(function(r){
      if(!bibVis(r))return false;
      if(existingIds.indexOf(r.id)>-1)return false;
      if(search&&r.name.toLowerCase().indexOf(search)===-1)return false;
      return true;
    });
    /* Tri alphabétique des risques dans la catégorie */
    rows = rows.slice().sort(function(a,b){ return a.name.localeCompare(b.name,'fr'); });
    if(!rows.length)return;
    hasAny=true;
    var isOpen=!!biblioPanelOpen[cat.id];
    var checkedInCat=rows.filter(function(r){return biblioPanelChecked[r.id];}).length;

    html+='<div style="margin-bottom:4px;">';
    /* En-tête cliquable */
    html+='<div onclick="toggleBiblioCat(\''+cat.id+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:7px;cursor:pointer;background:#F8FAFC;border:1px solid #F1F5F9;user-select:none;">';
    html+='<div style="display:flex;align-items:center;gap:8px;">';
    html+='<div style="font-size:12px;font-weight:500;color:#0A1F3D;">'+cat.name+'</div>';
    if(checkedInCat>0) html+='<span style="font-size:10px;background:#0A1F3D;color:#fff;border-radius:10px;padding:1px 7px;">'+checkedInCat+'</span>';
    html+='</div>';
    html+='<div style="display:flex;align-items:center;gap:8px;">';
    html+='<span style="font-size:10px;color:#94A3B8;">'+rows.length+' risque'+(rows.length>1?'s':'')+'</span>';
    html+='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" style="transition:transform .15s;transform:'+(isOpen?'rotate(180deg)':'rotate(0deg)')+'"><path d="M2 4l4 4 4-4"/></svg>';
    html+='</div>';
    html+='</div>';

    /* Liste risques — visible si ouvert */
    html+='<div style="display:'+(isOpen?'block':'none')+';padding:4px 0 4px 0;">';
    rows.forEach(function(r){
      var ck=!!biblioPanelChecked[r.id];
      html+='<div data-brid="'+r.id+'" onclick="toggleBiblioPanelItem(this.dataset.brid)" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;background:'+(ck?'#F4F6F9':'transparent')+';border:1px solid '+(ck?'#CBD5E1':'transparent')+';margin-bottom:2px;transition:background .1s;">';
      html+='<div style="width:15px;height:15px;border-radius:3px;border:1.5px solid #CBD5E1;flex-shrink:0;background:'+(ck?'#0A1F3D':'#fff')+';position:relative;">'+(ck?'<div style="position:absolute;top:1px;left:2px;width:9px;height:7px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg);"></div>':'')+'</div>';
      html+='<div style="font-size:12px;color:#1A1A1A;flex:1;">'+r.name+'</div>';
      html+='</div>';
    });
    html+='</div>';
    html+='</div>';
  });

  if(!hasAny) html='<div style="text-align:center;padding:32px 16px;color:#94A3B8;font-size:12px;line-height:1.8;">Tous les risques disponibles<br>pour votre secteur sont déjà dans votre liste.</div>';
  container.innerHTML=html;
  var ce=document.getElementById('biblio-panel-count');
  if(ce)ce.textContent=totalChecked?totalChecked+' risque'+(totalChecked>1?'s':'')+' sélectionné'+(totalChecked>1?'s':''):'Sélectionnez des risques à ajouter';
}

function toggleBiblioPanelItem(id){
  biblioPanelChecked[id]=!biblioPanelChecked[id];
  renderBiblioPanel();
}

var _suggestRisks = [];

function applyBiblioPanel(){
  var colMap=CK.levelColors;
  var addedRiskIds = [];
  bibCats.forEach(function(cat){
    cat.risks.forEach(function(r){
      if(!biblioPanelChecked[r.id]) return;
      var lvl='modere';
      if(cat.id==='sanitaire'||cat.id==='securite'||cat.id==='conformite') lvl='critique';
      else if(cat.id==='financier'||cat.id==='juridique'||cat.id==='rh') lvl='eleve';
      var dbRef=(CLEARISK_DB[ACCOUNT_SECTOR]||[]).find(function(d){return d.id===r.id;});
      if(!dbRef){
        var def=getDefaultRef(cat.name,r.name,lvl);
        def.id=r.id;
        CLEARISK_DB[ACCOUNT_SECTOR].push(def);
        dbRef=def;
      }
      var newRisk={id:r.id,name:r.name,cat:cat.name,level:lvl,status:'À traiter',date:"À l'instant",source:'lib',color:colMap[lvl],impact:2,proba:1};
      riskData.push(newRisk);
      sbSaveRisk(newRisk);
      sbSaveHistory({type:'risque', title:'Risque ajouté — '+r.name, desc:'Catégorie '+cat.name});
      modals[r.id]={title:r.name,sub:cat.name+' · '+levelLabel[lvl]+' · Bibliothèque Clearisk',content:''};
      addedRiskIds.push(r.id);
    });
  });
  closeBiblioPanel();
  renderRiskTable();
  if(addedRiskIds.length >= 1){
    openRiskModal(addedRiskIds[0]);
  } else {
    showToast('Risque ajouté avec succès');
  }
}

var _suggestCheckedActions = {};
var _suggestCheckedCtrls = {};

function openSuggestModal(){
  _suggestCheckedActions = {};
  _suggestCheckedCtrls = {};
  var allActions = [];
  var allCtrls = [];
  _suggestRisks.forEach(function(item){
    (item.dbRef.actions||[]).forEach(function(a, idx){
      allActions.push({action:a, risk:item.risk, idx:idx});
      _suggestCheckedActions[item.risk.id+'_'+idx] = true;
    });
    (item.dbRef.controles||[]).forEach(function(c, idx){
      allCtrls.push({ctrl:c, risk:item.risk, idx:idx});
      _suggestCheckedCtrls[item.risk.id+'_'+idx] = true;
    });
  });

  var titleEl = document.getElementById('suggest-title');
  var subEl = document.getElementById('suggest-sub');
  if(titleEl) titleEl.textContent = _suggestRisks.length===1 ? 'Suggestions pour "'+_suggestRisks[0].risk.name+'"' : 'Suggestions pour les risques ajoutés';
  if(subEl) subEl.textContent = 'Sélectionnez les plans d\'action et contrôles que vous souhaitez activer';

  var dueMap = {urgent:'Cette semaine', normal:'Ce mois', planif:'Ce trimestre'};
  var freqMap = {'Quotidien':'quotidien','Hebdomadaire':'hebdomadaire','Mensuel':'mensuel','Trimestriel':'trimestriel','Semestriel':'semestriel','Annuel':'annuel','À chaque livraison':'mensuel','À chaque service':'quotidien','Continu':'quotidien','À chaque modification':'mensuel'};
  var freqLabel = {quotidien:'Quotidien',hebdomadaire:'Hebdomadaire',mensuel:'Mensuel',trimestriel:'Trimestriel',semestriel:'Semestriel',annuel:'Annuel'};

  var actHtml = '';
  allActions.forEach(function(item){
    var key = item.risk.id+'_'+item.idx;
    var urgBg = item.action.priorite==='urgent'?'#FDEAEA':'#F4F6F9';
    var urgCol = item.action.priorite==='urgent'?'#8B0000':'#475569';
    var due = dueMap[item.action.priorite]||'Ce mois';
    actHtml += '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;cursor:pointer;margin-bottom:6px;background:#fff;">'
      +'<input type="checkbox" data-key="'+key+'" data-type="action" checked onchange="toggleSuggestCheck(this)" style="accent-color:#0A1F3D;margin-top:2px;flex-shrink:0;">'
      +'<div style="flex:1;">'
      +'<div style="font-size:12px;color:#1A1A1A;margin-bottom:4px;">'+item.action.titre+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;">'
      +'<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:'+urgBg+';color:'+urgCol+';">'+due+'</span>'
      +(_suggestRisks.length>1?'<span style="font-size:10px;color:#94A3B8;">'+item.risk.name+'</span>':'')
      +'</div></div></label>';
  });
  if(!actHtml) actHtml = '<div style="font-size:12px;color:#94A3B8;padding:8px 0;">Aucun plan d\'action disponible.</div>';

  var ctrlHtml = '';
  allCtrls.forEach(function(item){
    var key = item.risk.id+'_'+item.idx;
    var freq = freqMap[item.ctrl.frequence]||'mensuel';
    ctrlHtml += '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;cursor:pointer;margin-bottom:6px;background:#fff;">'
      +'<input type="checkbox" data-key="'+key+'" data-type="ctrl" checked onchange="toggleSuggestCheck(this)" style="accent-color:#0A1F3D;margin-top:2px;flex-shrink:0;">'
      +'<div style="flex:1;">'
      +'<div style="font-size:12px;color:#1A1A1A;margin-bottom:4px;">'+item.ctrl.titre+'</div>'
      +'<div style="display:flex;align-items:center;gap:6px;">'
      +'<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#F4F6F9;color:#475569;">'+(freqLabel[freq]||item.ctrl.frequence)+'</span>'
      +(_suggestRisks.length>1?'<span style="font-size:10px;color:#94A3B8;">'+item.risk.name+'</span>':'')
      +'</div></div></label>';
  });
  if(!ctrlHtml) ctrlHtml = '<div style="font-size:12px;color:#94A3B8;padding:8px 0;">Aucun contrôle disponible.</div>';

  document.getElementById('suggest-actions-list').innerHTML = actHtml;
  document.getElementById('suggest-ctrls-list').innerHTML = ctrlHtml;
  window._suggestAllActions = allActions;
  window._suggestAllCtrls = allCtrls;

  var overlay = document.getElementById('suggestOverlay');
  if(overlay) overlay.style.display = 'flex';
}

function toggleSuggestCheck(cb){
  var key = cb.dataset.key;
  if(cb.dataset.type==='action') _suggestCheckedActions[key] = cb.checked;
  else _suggestCheckedCtrls[key] = cb.checked;
}

function toggleSelectAllSuggest(type){
  if(type==='actions'){
    var keys = Object.keys(_suggestCheckedActions);
    var all = keys.every(function(k){return _suggestCheckedActions[k];});
    keys.forEach(function(k){_suggestCheckedActions[k]=!all;});
    document.querySelectorAll('#suggest-actions-list input[type="checkbox"]').forEach(function(cb){cb.checked=!all;});
    var btn = document.getElementById('suggest-actions-selectall');
    if(btn) btn.textContent = all ? 'Tout sélectionner' : 'Tout désélectionner';
  } else {
    var keys2 = Object.keys(_suggestCheckedCtrls);
    var all2 = keys2.every(function(k){return _suggestCheckedCtrls[k];});
    keys2.forEach(function(k){_suggestCheckedCtrls[k]=!all2;});
    document.querySelectorAll('#suggest-ctrls-list input[type="checkbox"]').forEach(function(cb){cb.checked=!all2;});
    var btn2 = document.getElementById('suggest-ctrls-selectall');
    if(btn2) btn2.textContent = all2 ? 'Tout sélectionner' : 'Tout désélectionner';
  }
}

function applySuggestions(){
  var dueMap2={urgent:'week',normal:'month',planif:'quarter'};
  var dueLabels2={week:'Cette semaine',month:'Ce mois',quarter:'Ce trimestre'};
  var freqMap2={'Quotidien':'quotidien','Hebdomadaire':'hebdomadaire','Mensuel':'mensuel','Trimestriel':'trimestriel','Semestriel':'semestriel','Annuel':'annuel','À chaque livraison':'mensuel','À chaque service':'quotidien','Continu':'quotidien','À chaque modification':'mensuel'};
  var addedAct=0, addedCtrl=0;

  (window._suggestAllActions||[]).forEach(function(item){
    var key=item.risk.id+'_'+item.idx;
    if(!_suggestCheckedActions[key]) return;
    var due=dueMap2[item.action.priorite]||'month';
    var newAct={id:genId(),name:item.action.titre,riskId:item.risk.id,risk:item.risk.name,cat:item.risk.cat,riskColor:item.risk.color,priority:item.action.priorite||'normal',due:due,dueLabel:dueLabels2[due]||'Ce mois',done:false,desc:'',note:'',createdAt:new Date().toISOString()};
    actionData.push(newAct);
    sbSaveAction(newAct);
    addedAct++;
  });

  (window._suggestAllCtrls||[]).forEach(function(item){
    var key=item.risk.id+'_'+item.idx;
    if(!_suggestCheckedCtrls[key]) return;
    var freq=freqMap2[item.ctrl.frequence]||'mensuel';
    var newCtrl={id:genId(),nom:item.ctrl.titre,cat:item.risk.cat,niveau:'1',freq:freq,resp:'',statut:'nonplanifie',dernierDate:'—',note:'',riskId:item.risk.id,risk:item.risk.name};
    ctrlData.push(newCtrl);
    sbSaveControl(newCtrl);
    addedCtrl++;
  });

  closeSuggestModal();
  if(typeof renderActions==='function') renderActions();
  if(typeof ctrl_render==='function') ctrl_render();
  renderDashboard();
  var msg=[];
  if(addedAct) msg.push(addedAct+' plan'+(addedAct>1?'s':'')+' d\'action');
  if(addedCtrl) msg.push(addedCtrl+' contrôle'+(addedCtrl>1?'s':''));
  showToast(msg.length ? msg.join(' et ')+' ajouté'+(addedAct+addedCtrl>1?'s':'') : 'Risque ajouté');
}

function closeSuggestModal(){
  var overlay=document.getElementById('suggestOverlay');
  if(overlay) overlay.style.display='none';
  _suggestRisks=[];
}

function closeSuggestOutside(e){
  if(e.target===document.getElementById('suggestOverlay')) closeSuggestModal();
}


/* ── PLAN D'ACTION ── */
var actionData = [];

var paFilter = 'tous';
var paView = 'liste';
var selectedActionId = null;

function renderActions() {
  updateActionStats();
  if(paView==='liste') renderActionsList();
  else if(paView==='risque') renderActionsGroups();
  else if(paView==='annuel') renderActionsAnnual();
}

function updateActionStats() {
  var late = actionData.filter(function(a){return computeRealDue(a)==='late'&&!a.done;}).length;
  var urgent = actionData.filter(function(a){return computeRealDue(a)==='week'&&!a.done;}).length;
  var encours = actionData.filter(function(a){var d=computeRealDue(a);return (d==='month'||d==='quarter'||d==='year')&&!a.done;}).length;
  var done = actionData.filter(function(a){return a.done;}).length;
  document.getElementById('pa-count-late').textContent = late;
  document.getElementById('pa-count-urgent').textContent = urgent;
  document.getElementById('pa-count-encours').textContent = encours;
  document.getElementById('pa-count-done').textContent = done;
  var badge = document.getElementById('badge-actions');
  if(badge){ badge.textContent = late; badge.style.display = late > 0 ? '' : 'none'; }
  document.getElementById('actions-sub').textContent = 'Mis à jour le ' + formatDateFr();
}

/* ── Calcul du statut réel en fonction de la date courante ── */
function computeRealDue(a) {
  if(a.done) return 'done';
  // Si déjà marqué 'late' manuellement, on garde
  if(a.due === 'late') return 'late';
  // Calcul à partir de la date de création stockée
  if(!a.createdAt) return a.due; // pas de date → on garde la valeur brute
  var created = new Date(a.createdAt);
  var now = new Date();
  var diffMs = now - created;
  var diffDays = Math.floor(diffMs / (1000*60*60*24));
  var thresholds = {week: 7, month: 31, quarter: 92, year: 365};
  var limit = thresholds[a.due] || 31;
  if(diffDays > limit) return 'late';
  return a.due;
}

function getDueDisplay(a) {
  var real = computeRealDue(a);
  if(real === 'done') return {label:'Fait', cls:'green'};
  if(real === 'late') return {label:'En retard', cls:'red'};
  if(real === 'week') return {label:'Cette semaine', cls:'amber'};
  if(real === 'month') return {label:'Ce mois', cls:'gray'};
  if(real === 'quarter') return {label:'Ce trimestre', cls:'gray'};
  if(real === 'year') return {label:'Cette année', cls:'gray'};
  return {label: a.dueLabel || '—', cls:'gray'};
}

function renderActionsList() {
  var c = document.getElementById('pa-list-container');
  c.innerHTML = '';

  // Filtre actif : quels items afficher
  var filterFns = {
    tous:    function(a){ return !a.done; },
    late:    function(a){ return computeRealDue(a)==='late' && !a.done; },
    urgent:  function(a){ return computeRealDue(a)==='week' && !a.done; },
    encours: function(a){ var d=computeRealDue(a); return (d==='month'||d==='quarter'||d==='year') && !a.done; },
    done:    function(a){ return a.done; }
  };
  var fn = filterFns[paFilter] || filterFns['tous'];
  var items = actionData.filter(fn);

  if(!items.length) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:60px 0;color:#94A3B8;font-size:13px;';
    empty.textContent = 'Aucun plan d\'action pour le moment.';
    c.appendChild(empty);
    return;
  }

  // Un seul tableau, pas de sous-titres de groupe
  var tbl = document.createElement('table');
  tbl.className = 'pa-table';
  tbl.innerHTML =
    '<thead><tr>'
    +'<th style="width:28px;"></th>'
    +'<th>Action</th>'
    +'<th style="width:20%;">Risque lié</th>'
    +'<th style="width:13%;">Niveau</th>'
    +'<th style="width:13%;text-align:right;">Échéance</th>'
    +'<th style="width:32px;"></th>'
    +'</tr></thead>'
    +'<tbody></tbody>';
  c.appendChild(tbl);
  var tbody = tbl.querySelector('tbody');

  items.forEach(function(a) {
    var due = getDueDisplay(a);
    var isLate = computeRealDue(a) === 'late' && !a.done;
    var levelInfo = getActionLevelInfo(a);
    var tr = document.createElement('tr');
    tr.id = 'row-'+a.id;
    if(isLate) tr.className = 'pa-tr-late';
    if(a.done) tr.className = (tr.className+' pa-tr-done').trim();
    if(selectedActionId === a.id) tr.className = (tr.className+' selected').trim();

    tr.innerHTML =
      '<td style="width:28px;" onclick="event.stopPropagation();toggleAction(\''+a.id+'\')">'
      +'<div class="pa-tr-check'+(a.done?' done':'')+'"></div>'
      +'</td>'
      +'<td onclick="openPanel(\''+a.id+'\')">'
      +'<div class="pa-tr-name'+(a.done?' done':'')+'">'+escHtml(a.name)+'</div>'
      +'</td>'
      +'<td onclick="openPanel(\''+a.id+'\')">'
      +'<span class="pa-tr-risk">'+escHtml(a.risk&&a.risk!=='Aucun'?a.risk:'—')+'</span>'
      +'</td>'
      +'<td onclick="openPanel(\''+a.id+'\')">'
      +(levelInfo ? '<span class="ri-badge '+levelInfo.cls+'">'+levelInfo.label+'</span>' : '<span style="color:#CBD5E1;font-size:11px;">—</span>')
      +'</td>'
      +'<td style="text-align:right;" onclick="openPanel(\''+a.id+'\')">'
      +'<span class="pa-tr-due '+due.cls+'">'+due.label+'</span>'
      +'</td>'
      +'<td style="width:32px;text-align:right;">'
      +'<button class="pa-tr-del" onclick="event.stopPropagation();deleteAction(\''+a.id+'\')" title="Supprimer">✕</button>'
      +'</td>';
    tbody.appendChild(tr);
  });
}

function renderActionsGroups() {
  var c = document.getElementById('pa-group-container');
  c.innerHTML = '';
  var byRisk = {};
  actionData.forEach(function(a) {
    var key = a.risk || 'Aucun risque';
    if(!byRisk[key]) byRisk[key] = {color:a.riskColor, cat:a.cat||'', actions:[]};
    byRisk[key].actions.push(a);
  });
  if(!Object.keys(byRisk).length) {
    c.innerHTML = '<div style="text-align:center;padding:60px 0;color:#94A3B8;font-size:13px;">Aucun plan d\'action pour le moment.</div>';
    return;
  }
  Object.keys(byRisk).forEach(function(risk) {
    var grp = byRisk[risk];
    var done = grp.actions.filter(function(a){return a.done;}).length;
    var late = grp.actions.filter(function(a){return computeRealDue(a)==='late'&&!a.done;}).length;
    var div = document.createElement('div');
    div.className = 'pa-group';
    var rows = grp.actions.map(function(a) {
      var due = getDueDisplay(a);
      return '<div class="pa-group-row">'
        +'<div class="pgr-check'+(a.done?' done':'')+'" onclick="toggleAction(\''+a.id+'\')"></div>'
        +'<div class="pgr-label'+(a.done?' done':'')+'">'+escHtml(a.name)+'</div>'
        +'<div class="pgr-due '+due.cls+'">'+due.label+'</div>'
        +'</div>';
    }).join('');
    var lateHtml = late>0 ? '<span style="font-size:10px;color:#E24B4A;font-weight:500;margin-left:8px;">'+late+' en retard</span>' : '';
    div.innerHTML = '<div class="pa-group-head">'
      +'<div style="flex:1;">'
      +'<div class="pag-cat">'+escHtml(grp.cat||'')+'</div>'
      +'<div class="pag-name">'+escHtml(risk)+'</div>'
      +'</div>'
      +lateHtml
      +'<div class="pag-progress">'+done+'/'+grp.actions.length+' faites</div>'
      +'</div>'+rows;
    c.appendChild(div);
  });
}

function toggleAction(id) {
  var a = actionData.find(function(x){return x.id===id;});
  if(!a) return;
  if(!a.done) {
    // On sauvegarde l'échéance avant de marquer fait
    a._prevDue = a.due;
    a._prevDueLabel = a.dueLabel;
    a.done = true;
    a.due = 'done';
    a.dueLabel = 'Fait';
  } else {
    // On restaure l'échéance précédente
    a.done = false;
    a.due = a._prevDue || 'month';
    a.dueLabel = a._prevDueLabel || 'Ce mois';
  }
  sbSaveAction(a);
  if(selectedActionId===id && a.done) closePanel();
  renderActions();
}

function deleteAction(id) {
  var a = actionData.find(function(x){ return x.id === id; });
  if(!a) return;
  pendingDeleteActionId = id;
  document.getElementById('confirmActionName').textContent = a.name;
  document.getElementById('confirmActionOverlay').classList.add('open');
}
function closeConfirmAction() {
  document.getElementById('confirmActionOverlay').classList.remove('open');
  pendingDeleteActionId = null;
}
function doDeleteAction() {
  if(!pendingDeleteActionId) return;
  var sb = getSb();
  if(sb) { sb.from('actions').delete().eq('id', pendingDeleteActionId).then(function(res){ if(res.error) showToast('Erreur suppression — réessayez', true); }); }
  actionData = actionData.filter(function(a){ return a.id !== pendingDeleteActionId; });
  closeConfirmAction();
  renderActions();
  showToast('Action supprimée');
}

function filterActions(f, btn) {
  paFilter = f;
  document.querySelectorAll('#page-actions .pa-filter').forEach(function(p){p.classList.remove('active');});
  if(btn) {
    btn.classList.add('active');
  } else {
    var pill = document.getElementById('pa-f-'+f);
    if(pill) pill.classList.add('active');
    else { var tous = document.getElementById('pa-f-tous'); if(tous) tous.classList.add('active'); }
  }
  ['late','urgent','encours','done'].forEach(function(k){
    var kpi = document.getElementById('pa-kpi-'+k);
    if(kpi) kpi.style.opacity = (f==='tous' || f===k) ? '1' : '0.4';
  });
  renderActions();
}

function switchView(v) {
  paView = v;
  ['tv-liste','tv-risque','tv-annuel'].forEach(function(id) {
    var el = document.getElementById(id);
    if(!el) return;
    var isActive = (id === 'tv-'+v);
    el.style.color = isActive ? '#0A1F3D' : '#71869A';
    el.style.fontWeight = isActive ? '500' : '400';
  });
  document.getElementById('pa-view-liste').style.display = v==='liste'?'block':'none';
  document.getElementById('pa-view-risque').style.display = v==='risque'?'block':'none';
  document.getElementById('pa-view-annuel').style.display = v==='annuel'?'block':'none';
  if(v==='risque'||v==='annuel') { if(typeof closePanel!=='undefined') closePanel(); }
  renderActions();
}

function getActionLevelInfo(a) {
  var levelMap = {
    'critique': {cls:'bc', label:'Critique', color:'#E24B4A'},
    'eleve':    {cls:'bh', label:'Élevé',    color:'#EF9F27'},
    'modere':   {cls:'bm', label:'Modéré',   color:'#4A90D9'},
    'faible':   {cls:'bf', label:'Faible',   color:'#1D9E75'}
  };
  if(a.level && levelMap[a.level]) return levelMap[a.level];
  return null; // pas de niveau choisi → on n'invente rien
}

function getLevelInfoForCat(cat, riskName) {
  // Cherche d'abord par nom de risque exact, puis par catégorie en fallback
  var risk = riskName
    ? riskData.find(function(r){ return r.name === riskName; })
    : null;
  if(!risk) risk = riskData.find(function(r){ return r.cat === cat; });
  var level = risk ? risk.level : null;
  var levelMap = {
    'critique': {cls:'bc', label:'Critique', color:'#E24B4A'},
    'eleve':    {cls:'bh', label:'Élevé',    color:'#EF9F27'},
    'modere':   {cls:'bm', label:'Modéré',   color:'#4A90D9'},
    'faible':   {cls:'bf', label:'Faible',   color:'#1D9E75'}
  };
  return levelMap[level] || {cls:'bm', label:'Modéré', color:'#4A90D9'};
}

/* sendNote / toggleNote supprimés — remplacés par le panneau latéral */

function renderActionsAnnual() {
  var c = document.getElementById('pa-annual-container');
  if(!c) return;
  var months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  var _now = new Date();
  var curMonth = _now.getMonth();
  // Fin du trimestre courant : mois 0-2 → 2, mois 3-5 → 5, mois 6-8 → 8, mois 9-11 → 11
  var curQuarterEnd = Math.min(Math.floor(curMonth / 3) * 3 + 2, 11);

  function dueLabelToMonth(a) {
    if(a.done) return null;
    var real = computeRealDue(a);
    if(real === 'late') return curMonth;
    if(real === 'week') return curMonth;
    if(real === 'month') return curMonth;
    if(real === 'quarter') return curQuarterEnd;
    if(real === 'year') return 11;
    return curMonth;
  }

  var html = '<div class="annual-legend">'
    +'<div class="al-item"><div class="al-sq" style="background:#FDEAEA;border:1px solid #F7C1C1;"></div>Critique</div>'
    +'<div class="al-item"><div class="al-sq" style="background:#FEF3E2;border:1px solid #FAC775;"></div>Élevé</div>'
    +'<div class="al-item"><div class="al-sq" style="background:#EBF4FF;border:1px solid #B5D4F4;"></div>Modéré</div>'
    +'<div class="al-item"><div class="al-sq" style="background:#EAFAF3;border:1px solid #9FE1CB;"></div>Faible</div>'
    +'<div class="al-item"><div class="al-sq" style="background:#F1F5F9;border:1px solid #E2E8F0;"></div>Fait</div>'
    +'</div>';

  html += '<div class="annual-view"><table class="annual-table"><thead><tr>'
    +'<th class="action-col">Action</th>';
  months.forEach(function(m) { html += '<th>'+m+'</th>'; });
  html += '</tr></thead><tbody>';

  actionData.forEach(function(a) {
    var targetMonth = dueLabelToMonth(a);
    var levelInfo = getLevelInfoForCat(a.cat, a.risk);
    var cellClass = a.done ? 'done-cell' :
      (levelInfo.cls === 'bc' ? 'active-c' :
       levelInfo.cls === 'bh' ? 'active-h' :
       levelInfo.cls === 'bm' ? 'active-m' : 'active-f');
    var dotColor = a.done ? '#CBD5E1' : levelInfo.color;

    html += '<tr><td class="action-name'+(a.done?' done':'')+'" title="'+escHtml(a.name)+'">'+escHtml(a.name)+'</td>';
    months.forEach(function(m, i) {
      var isTarget = (i === targetMonth);
      html += '<td style="padding:4px 3px;">';
      if(isTarget) {
        html += '<div class="am-cell '+cellClass+'"><div class="am-dot" style="background:'+dotColor+';"></div></div>';
      } else {
        html += '<div class="am-cell"></div>';
      }
      html += '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  c.innerHTML = html;
}

async function openAddAction() {
  var sel = document.getElementById('pa-f-risk');
  var dbg = document.getElementById('pa-f-risk-debug');

  // Si peu/pas de risques en mémoire, on retente un chargement direct depuis Supabase
  if(riskData.length === 0) {
    if(dbg) dbg.textContent = 'Chargement des risques…';
    try { await sbLoadAllData(); } catch(e) {}
  }

  if(sel) {
    sel.innerHTML = '<option value="">— Aucun risque associé —</option>';
    riskData.forEach(function(r) {
      if(!r || !r.id || !r.name) return;
      var opt = document.createElement('option');
      opt.value = r.id + '|' + r.name + '|' + (r.cat || 'Autre');
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  }
  if(dbg) {
    var added = sel ? (sel.options.length - 1) : 0;
    dbg.textContent = added + ' risque(s) disponible(s) dans la liste.';
  }
  document.getElementById('pa-f-name').value = '';
  document.getElementById('pa-f-due').value = 'month';
  document.getElementById('pa-f-level').value = '';
  document.getElementById('actionAddOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('pa-f-name').focus(); }, 50);
}
function closeAddAction() {
  document.getElementById('actionAddOverlay').classList.remove('open');
}

function saveAction() {
  var name = document.getElementById('pa-f-name').value.trim();
  if(!name) { showToast('Veuillez saisir une action', true); return; }
  var risk = document.getElementById('pa-f-risk').value || 'Aucun';
  var due = document.getElementById('pa-f-due').value;
  var level = document.getElementById('pa-f-level').value || null;
  var dueLabels = {week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre', year:'Cette année'};
  // BUG#3 FIX — nouveau format riskId|name|cat
  var parts=risk.split('|');
  var rId = parts.length >= 3 ? parts[0] : null;
  var rName = parts.length >= 3 ? parts[1] : (parts[0]||'Aucun');
  var rCat  = parts.length >= 3 ? parts[2] : (parts[1]||'Autre');
  var rColor = (rId && riskData.find(function(r){return r.id===rId;})) ? riskData.find(function(r){return r.id===rId;}).color : '#94A3B8';
  var newAct = {id:genId(), name:name, riskId:rId||null, risk:rName, cat:rCat, riskColor:rColor, level:level, due:due, dueLabel:dueLabels[due], done:false, desc:'', note:'', createdAt: new Date().toISOString()};
  actionData.push(newAct);
  sbSaveAction(newAct);
  closeAddAction();
  document.getElementById('pa-f-name').value = '';
  renderActions();
  showToast('Action ajoutée');
}


async function openPanel(id) {
  var a = actionData.find(function(x){return x.id===id;});
  if(!a) return;
  selectedActionId = id;

  if(riskData.length === 0) {
    try { await sbLoadAllData(); } catch(e) {}
  }

  // Peupler la liste des risques
  var sel = document.getElementById('panelRiskSelect');
  if(sel) {
    sel.innerHTML = '<option value="">— Aucun risque associé —</option>';
    riskData.forEach(function(r) {
      if(!r || !r.id || !r.name) return;
      var opt = document.createElement('option');
      opt.value = r.id + '|' + r.name + '|' + (r.cat || 'Autre');
      opt.textContent = r.name;
      if(a.riskId === r.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  document.getElementById('panelName').value = a.name;
  document.getElementById('panelLevel').value = a.level || '';
  var dueVal = (a.due==='late'||a.due==='done') ? (a._prevDue||'month') : a.due;
  document.getElementById('panelDue').value = dueVal;
  var doneBtn = document.getElementById('panelDoneBtn');
  if(doneBtn) {
    if(a.done) {
      doneBtn.textContent = '↩ Remettre en cours';
    } else {
      doneBtn.textContent = 'Marquer comme fait ✓';
    }
  }
  document.getElementById('actionEditOverlay').classList.add('open');
}
function closePanel() {
  selectedActionId = null;
  document.getElementById('actionEditOverlay').classList.remove('open');
  renderActions();
}
function savePanel() {
  if(!selectedActionId) return;
  var a = actionData.find(function(x){return x.id===selectedActionId;});
  if(!a) return;
  var newName = document.getElementById('panelName').value.trim();
  if(!newName) { showToast('L\'intitulé est obligatoire', true); return; }
  a.name = newName;

  // Risque lié
  var riskVal = document.getElementById('panelRiskSelect').value;
  if(riskVal) {
    var parts = riskVal.split('|');
    a.riskId = parts[0];
    a.risk = parts[1];
    a.cat = parts[2];
    var rObj = riskData.find(function(r){return r.id===parts[0];});
    a.riskColor = rObj ? rObj.color : '#94A3B8';
  } else {
    a.riskId = null;
    a.risk = 'Aucun';
  }

  // Niveau
  a.level = document.getElementById('panelLevel').value || null;

  var due = document.getElementById('panelDue').value;
  var dueLabels = {week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre', year:'Cette année'};
  if(due !== a.due) { a.createdAt = new Date().toISOString(); }
  a.due = due; a.dueLabel = dueLabels[due];
  sbSaveAction(a);
  closePanel();
  showToast('Action mise à jour');
}
function markPanelDone() {
  if(!selectedActionId) return;
  var a = actionData.find(function(x){return x.id===selectedActionId;});
  if(!a) return;
  if(a.done) {
    // Remettre en cours
    a.done = false;
    a.due = a._prevDue || 'month';
    a.dueLabel = a._prevDueLabel || 'Ce mois';
    sbSaveAction(a);
    openPanel(a.id);
    renderActions();
    showToast('Action remise en cours');
  } else {
    a._prevDue = a.due;
    a._prevDueLabel = a.dueLabel;
    a.done = true; a.due = 'done'; a.dueLabel = 'Fait';
    sbSaveAction(a);
    sbSaveHistory({type:'action', title:'Action réalisée — '+a.name, desc:'Risque : '+a.risk});
    closePanel();
    renderActions();
    showToast('Action marquée comme faite');
  }
}
function deletePanelAction() {
  if(!selectedActionId) return;
  deleteAction(selectedActionId);
  closePanel();
}

/* ── HISTORIQUE ── */
var histoFilter = 'tous';
var histoData = [];

var scoreHistory = [];

/* ── SCORE DYNAMIQUE ── */
function calcScoreDynamic() {
  if(!riskData.length) return 100; // aucun risque = score parfait
  var score = 100;
  // Pénalités par niveau de risque
  riskData.forEach(function(r) {
    if(r.status === 'Traité') return;
    if(r.level === 'critique') score -= 15;
    else if(r.level === 'eleve') score -= 8;
    else if(r.level === 'modere') score -= 4;
    else if(r.level === 'faible') score -= 1;
  });
  score = Math.max(0, score); // jamais négatif avant les bonus
  // Bonus actions faites (max +10, seulement si le score n'est pas déjà à 100)
  var doneActions = actionData.filter(function(a){ return a.done; }).length;
  var totalActions = actionData.length;
  if(totalActions > 0) score = Math.min(100, score + Math.round((doneActions / totalActions) * 10));
  // Bonus contrôles conformes (max +5)
  var confCtrl = ctrlData.filter(function(c){ return c.statut === 'conforme'; }).length;
  if(ctrlData.length > 0) score = Math.min(100, score + Math.round((confCtrl / ctrlData.length) * 5));
  return score;
}

var badgeClass = {alerte:'hb-alerte', action:'hb-action', risque:'hb-risque', score:'hb-score'};
var badgeLabel = {alerte:'Alerte', action:'Action', risque:'Risque', score:'Score'};

function renderHisto() {
  renderHistoStrip();
  var counts = {risque:0, action:0, alerte:0, score:0};
  histoData.forEach(function(e){ if(counts[e.type]!==undefined) counts[e.type]++; });
  ['risque','action','alerte','score'].forEach(function(k){
    var el = document.getElementById('hkpi-n-'+k);
    if(el) el.textContent = counts[k];
  });
  var subEl = document.getElementById('histo-sub');
  if(subEl) subEl.textContent = 'Mis à jour le '+formatDateFr();
  renderHistoTimeline();
}

function renderHistoStrip() {
  var strip = document.getElementById('histo-score-strip');
  if(!strip) return;
  if(!scoreHistory || !scoreHistory.length) { strip.innerHTML = ''; return; }

  var ms = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sep.','Oct.','Nov.','Déc.'];

  var cols = scoreHistory.map(function(s) {
    var mLabel = s.month ? s.month.split(' ')[0].toLowerCase() : '';
    var mIdx = ms.findIndex ? ms.findIndex(function(m){
      return mLabel.indexOf(m.replace('.','').toLowerCase()) > -1;
    }) : -1;
    var shortM = mIdx >= 0 ? ms[mIdx] : (s.month ? s.month.split(' ')[0] : '');
    var d = (s.delta !== null && s.delta !== undefined && s.delta !== '') ? parseInt(s.delta) : null;
    var deltaStr = d === null ? '—' : (d > 0 ? '+'+d : String(d));
    var deltaColor = d > 0 ? '#1D9E75' : (d < 0 ? '#E24B4A' : '#94A3B8');
    var isCurrent = !!s.current;
    return '<div style="text-align:center;margin-right:20px;">'
      + '<div style="font-size:9px;color:#94A3B8;margin-bottom:3px;">'+shortM+'</div>'
      + '<div style="font-size:13px;font-weight:'+(isCurrent?'600':'400')+';color:#1A1A1A;letter-spacing:-.3px;">'+s.val+'</div>'
      + '<div style="font-size:9px;color:'+deltaColor+';margin-top:2px;">'+deltaStr+'</div>'
      + '</div>';
  });

  strip.innerHTML = '<div style="display:flex;align-items:flex-start;padding:10px 0 0 0;">'
    + cols.join('')
    + '</div>';
}
function renderHistoTimeline() {
  var c = document.getElementById('histo-container');
  if(!c) return;
  c.innerHTML = '';
  var lastMonth = '';
  histoData.forEach(function(e) {
    if(histoFilter !== 'tous' && e.type !== histoFilter) return;
    if(e.month !== lastMonth) {
      var ml = document.createElement('div');
      ml.className = 'histo-month-label';
      ml.textContent = e.month;
      c.appendChild(ml);
      lastMonth = e.month;
    }
    var entry = document.createElement('div');
    entry.className = 'histo-entry';
    var scoreExtra = '';
    if(e.type === 'score') {
      var _dCol = (e.scoreDelta && String(e.scoreDelta).indexOf('-') === -1) ? '#1D9E75' : '#E24B4A';
      scoreExtra = e.scoreDelta
        ? '<div style="font-size:11px;color:'+_dCol+';margin-top:4px;">'+String(e.scoreDelta)+' pts ce mois</div>'
        : '';
    }
    entry.innerHTML = '<div class="he-dot" style="background:'+e.dotBg+';"><div class="he-dot-inner" style="background:'+e.dotColor+';"></div></div>'
      +'<div class="he-card">'
      +'<div class="he-top"><span class="he-badge '+badgeClass[e.type]+'">'+badgeLabel[e.type]+'</span><span class="he-date">'+escHtml(e.date)+'</span></div>'
      +'<div class="he-title">'+escHtml(e.title)+'</div>'
      +'<div class="he-desc">'+escHtml(e.desc)+'</div>'
      +scoreExtra
      +'</div>';
    c.appendChild(entry);
  });
}

function filterHisto(f, btn) {
  histoFilter = f;
  document.querySelectorAll('#page-histo .pa-filter').forEach(function(b){ b.classList.remove('active'); });
  if(btn) {
    btn.classList.add('active');
  } else {
    var pill = document.getElementById('hf-'+f);
    if(pill) pill.classList.add('active');
    else { var tous = document.getElementById('hf-tous'); if(tous) tous.classList.add('active'); }
  }
  ['risque','action','alerte','score'].forEach(function(k){
    var kpi = document.getElementById('hkpi-'+k);
    if(kpi) kpi.style.opacity = (f==='tous' || f===k) ? '1' : '0.4';
  });
  renderHistoTimeline();
}

/* ── ABONNEMENT ── */
var currentPlan = 'mensuel';
var selectedPlan = 'mensuel';

function selectPlan(plan) {
  selectedPlan = plan;
  var cardM = document.getElementById('plan-card-mensuel');
  var cardA = document.getElementById('plan-card-annuel');
  var bar = document.getElementById('plan-confirm-bar');
  if(!cardM || !cardA || !bar) return;
  if(plan === 'mensuel') {
    cardM.classList.add('selected');
    cardA.classList.remove('selected');
  } else {
    cardA.classList.add('selected');
    cardM.classList.remove('selected');
  }
  if(plan === currentPlan) {
    bar.style.display = 'none';
  } else {
    bar.style.display = 'flex';
    if(plan === 'annuel') {
      document.getElementById('confirm-plan-text').textContent = 'Passer à Clearisk Annuel';
      document.getElementById('confirm-plan-sub').textContent = '1 100 € HT / an · facturé en une fois · 1 mois offert';
    } else {
      document.getElementById('confirm-plan-text').textContent = 'Repasser au mensuel';
      document.getElementById('confirm-plan-sub').textContent = '109 € HT / mois · résiliable à tout moment';
    }
  }
}

function confirmPlanChange() {
  window.location.href = '/paiement';
}

/* ── PANNEAU ÉTABLISSEMENTS ── */
var etabPanelOpen = false;
var currentEtab = 1;

function toggleEtabPanel() {
  etabPanelOpen = !etabPanelOpen;
  document.getElementById('etab-panel').classList.toggle('open', etabPanelOpen);
  var chev = document.getElementById('sb-chevron');
  if(chev) chev.style.transform = etabPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

function closeEtabPanel() {
  etabPanelOpen = false;
  document.getElementById('etab-panel').classList.remove('open');
  var chev = document.getElementById('sb-chevron');
  if(chev) chev.style.transform = 'rotate(0deg)';
}

function openEtabModal() {
  closeEtabPanel();
  document.getElementById('etabModalOverlay').classList.add('open');
}

function closeEtabModal() {
  document.getElementById('etabModalOverlay').classList.remove('open');
}

function closeEtabModalOutside(e) {
  if(e.target === document.getElementById('etabModalOverlay')) closeEtabModal();
}

function confirmEtabAdd() {
  var nom = document.getElementById('etab-inp-nom').value.trim() || 'Nouvel établissement';
  var ville = document.getElementById('etab-inp-ville').value.trim() || '—';
  var initiales = nom.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
  document.getElementById('ep-av2').textContent = initiales;
  document.getElementById('ep-name2').textContent = nom;
  document.getElementById('ep-detail2').textContent = ville + ' · +69 €/mois';
  document.getElementById('ep-e2').style.display = 'flex';
  closeEtabModal();
  showToast('Établissement créé — ' + nom);
}

function switchEtab() {
  if(currentEtab === 2) return;
  currentEtab = 2;
  document.getElementById('ep-e1').classList.remove('ep-current');
  document.getElementById('ep-e2').classList.add('ep-current');
  document.getElementById('ep-check2').style.opacity = '1';
  document.getElementById('sb-uname-txt').textContent = document.getElementById('ep-name2').textContent;
  document.getElementById('sb-av-txt').textContent = document.getElementById('ep-av2').textContent;
  closeEtabPanel();
  showToast('Établissement actif : ' + document.getElementById('ep-name2').textContent);
}

document.addEventListener('click', function(e) {
  if(!etabPanelOpen) return;
  var panel = document.getElementById('etab-panel');
  var user = document.getElementById('sb-user');
  if(panel && !panel.contains(e.target) && user && !user.contains(e.target)) closeEtabPanel();
});

/* ── FACTURE PDF ── */
var invoiceData = [
  { num: '2026-04-001', date: '26 avril 2026', period: '1 avr. – 30 avr. 2026', ht: "109,00 €", tva: "21,80 €", ttc: "130,80 €" },
  { num: '2026-03-001', date: '26 mars 2026',  period: '1 mar. – 31 mar. 2026', ht: "109,00 €", tva: "21,80 €", ttc: "130,80 €" },
  { num: '2026-02-001', date: '26 févr. 2026', period: '1 fév. – 28 fév. 2026', ht: "109,00 €", tva: "21,80 €", ttc: "130,80 €" }
];

function openInvoice(idx) {
  var inv = invoiceData[idx];
  document.getElementById('invoiceTitle').textContent = 'Facture #' + inv.num;
  document.getElementById('invoiceBody').innerHTML =
    '<div class="inv-header">'
    +'<div><div class="inv-logo">clear<span>isk</span></div><div class="inv-logo-tag">Identifiez vos risques. Agissez maintenant.</div></div>'
    +'<div class="inv-meta"><div class="inv-num">Facture #'+inv.num+'</div><div class="inv-date">Émise le '+inv.date+'</div><div class="inv-badge">Payée</div></div>'
    +'</div>'
    +'<div class="inv-addresses">'
    +'<div><div class="inv-addr-label">De</div><div class="inv-addr-name">Clearisk SAS</div><div class="inv-addr-line">123 rue de la Paix<br>06000 Nice, France<br>SIRET : 123 456 789 00012<br>TVA : FR12345678900</div></div>'
    +'<div><div class="inv-addr-label">Facturé à</div><div class="inv-addr-name" id="inv-addr-entreprise"></div><div class="inv-addr-line">contact@monrestaurant.fr<br>France<br>Secteur : Restauration</div></div>'
    +'</div>'
    +'<table class="inv-table"><thead><tr><th>Description</th><th>Période</th><th>Montant HT</th></tr></thead>'
    +'<tbody><tr>'
    +'<td><div>Abonnement Clearisk</div><div class="td-sub">Dashboard, score de résilience, plan d\'action, cartographie</div></td>'
    +'<td style="font-size:11px;color:#71869A;white-space:nowrap;">'+inv.period+'</td>'
    +'<td>'+inv.ht+'</td>'
    +'</tr></tbody></table>'
    +'<div class="inv-totals">'
    +'<div class="inv-total-row"><div class="inv-total-label">Sous-total HT</div><div class="inv-total-val">'+inv.ht+'</div></div>'
    +'<div class="inv-total-row"><div class="inv-total-label">TVA (20%)</div><div class="inv-total-val">'+inv.tva+'</div></div>'
    +'<div class="inv-divider"></div>'
    +'<div class="inv-total-row main"><div class="inv-total-label">Total TTC</div><div class="inv-total-val">'+inv.ttc+'</div></div>'
    +'</div>'
    +'<div class="inv-footer-note">Paiement effectué par carte bancaire ···· 4242 le '+inv.date+'. Aucun remboursement ne sera effectué pour les périodes entamées. Contact : contact@clearisk.fr</div>'
    +'<div class="inv-footer-bar"><span>Clearisk SAS · SIRET 123 456 789 00012</span><span>clearisk.fr</span></div>';
  document.getElementById('invoiceOverlay').classList.add('open');
}
function closeInvoice() { document.getElementById('invoiceOverlay').classList.remove('open'); }

/* ── CONFIRM DELETE ── */
var pendingDeleteId = null;
var pendingDeleteActionId = null;
function encodeRiskName(name){ return (name||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function askDelete(btnOrId, name) {
  var id, nm;
  if(typeof btnOrId === 'object') {
    id = btnOrId.dataset.rid;
    nm = decodeURIComponent(btnOrId.dataset.rname||'').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    btnOrId.event&&btnOrId.event.stopPropagation&&btnOrId.event.stopPropagation();
  } else { id=btnOrId; nm=name; }
  pendingDeleteId = id;
  document.getElementById('confirmRiskName').textContent = '"' + nm + '"';
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  pendingDeleteId = null;
}
function doDelete() {
  if (!pendingDeleteId) return;
  sbDeleteRisk(pendingDeleteId);
  riskData = riskData.filter(function(r){ return r.id !== pendingDeleteId; });
  closeConfirm();
  renderRiskTable(currentFilter);
  showToast('Risque supprimé');
}

renderRiskTable();

/* ── BIBLIOTHÈQUE ── */
var bibSector='tous',bibChecked={},bibCustom={},bibOpen={},bibAdding={};
var bibCats=[
  {id:'sanitaire',name:'Sanitaire',color:'#E24B4A',risks:[
    {id:'bsan1',name:'Non-conformité HACCP',common:false,sectors:['restauration']},
    {id:'bsan2',name:'Certification HACCP expirée',common:false,sectors:['restauration']},
    {id:'bsan4',name:'Rupture de la chaîne du froid',common:false,sectors:['restauration']},
    {id:'bsan5',name:'Fiches allergènes manquantes ou obsolètes',common:false,sectors:['restauration']},
    {id:'bsan6',name:'Traçabilité fournisseurs insuffisante',common:false,sectors:['restauration']},
    {id:'bsan7',name:'Absence de plan de nettoyage documenté',common:false,sectors:['restauration']},
    {id:'bsan8',name:'Contamination croisée cru/cuit',common:false,sectors:['restauration']},
    {id:'bsan9',name:'Personnel sans formation hygiène à jour',common:false,sectors:['restauration']},
    {id:'r_intoxication',name:'Risque d\'intoxication alimentaire client',common:false,sectors:['restauration']}
  ]},
  {id:'conformite',name:'Conformité réglementaire',color:'#8B5CF6',risks:[
    {id:'bsan3',name:'Contrôle DDPP non anticipé',common:false,sectors:['restauration']},
    {id:'bsan10',name:'Non-affichage obligatoire (origine viandes, allergènes)',common:false,sectors:['restauration']},
    {id:'r_non_conformite_ddpp',name:'Fermeture administrative suite à contrôle',common:false,sectors:['restauration']},
    {id:'bconf1',name:'Absence de registre de sécurité',common:false,sectors:['restauration']},
    {id:'bconf2',name:'Licence IV non conforme ou manquante',common:false,sectors:['restauration']},
    {id:'bconf3',name:'Affichage prix / menus non conforme',common:false,sectors:['restauration']},
    {id:'bconf4',name:'Déclaration ERP non à jour',common:false,sectors:['restauration']},
    {id:'bconf5',name:'Non-respect des normes accessibilité PMR',common:false,sectors:['restauration']}
  ]},
  {id:'financier',name:'Financier',color:'#E24B4A',risks:[
    {id:'bf1',name:'Trésorerie insuffisante',common:true,sectors:['tous']},
    {id:'bf2',name:'Impayés clients',common:true,sectors:['tous']},
    {id:'bf3',name:'Marges compressées',common:true,sectors:['tous']},
    {id:'bf4',name:'Dépendance à une seule source de revenus',common:true,sectors:['tous']},
    {id:'bf5',name:'Trésorerie saisonnière',common:false,sectors:['restauration','commerce','artisanat']},
    {id:'r_decouvert',name:'Découvert bancaire structurel',common:false,sectors:['restauration']},
    {id:'r_ticket_moyen',name:'Ticket moyen insuffisant au regard des charges',common:false,sectors:['restauration']},
    {id:'r_tva_provision',name:'TVA non provisionnée / décalage fiscal',common:false,sectors:['restauration']},
    {id:'r_food_cost',name:'Food cost mal maîtrisé (ratio matières > 35%)',common:false,sectors:['restauration']},
    {id:'r_energie',name:'Hausse brutale du coût de l\'énergie',common:false,sectors:['restauration']},
    {id:'bf6',name:'Loyers impayés / vacance locative',common:false,sectors:['immobilier']},
    {id:'bf7',name:'MRR instable / churn élevé',common:false,sectors:['tech']},
    {id:'bf8',name:'Acomptes chantier non récupérés',common:false,sectors:['artisanat']},
    {id:'bf9',name:'Dépassements d\'honoraires',common:false,sectors:['sante']},
    {id:'bf10',name:'Retards de paiement chroniques',common:false,sectors:['services']}
  ]},
  {id:'operationnel',name:'Opérationnel',color:'#EF9F27',risks:[
    {id:'bo1',name:'Rupture de stock',common:true,sectors:['tous']},
    {id:'bo2',name:'Panne équipement critique',common:true,sectors:['tous']},
    {id:'bo3',name:'Dépendance fournisseur unique',common:true,sectors:['tous']},
    {id:'bo4',name:'Problème de livraison / logistique',common:true,sectors:['tous']},
    {id:'bo5',name:'Rupture fournisseur produits frais',common:false,sectors:['restauration']},
    {id:'bo6',name:'Panne frigo / chambre froide',common:false,sectors:['restauration']},
    {id:'bo12',name:'Coupure électrique prolongée',common:false,sectors:['restauration']},
    {id:'bo13',name:'Panne du système de ventilation cuisine',common:false,sectors:['restauration']},
    {id:'bo14',name:'Rupture de gaz / coupure énergie',common:false,sectors:['restauration']},
    {id:'r_vetuste',name:'Équipements vétustes sans plan de renouvellement',common:false,sectors:['restauration']},
    {id:'r_stock_tampon',name:'Absence de stock tampon minimum',common:false,sectors:['restauration']},
    {id:'r_procedures_non_documentees',name:'Absence de procédures documentées',common:false,sectors:['restauration']},
    {id:'bo7',name:'Délais chantier non tenus',common:false,sectors:['artisanat']},
    {id:'bo8',name:'Sinistre locatif',common:false,sectors:['immobilier']},
    {id:'bo9',name:'Panne serveur / bug critique',common:false,sectors:['tech']},
    {id:'bo10',name:'Perte d\'un contrat clé',common:false,sectors:['services','tech']},
    {id:'bo11',name:'Rupture matières premières',common:false,sectors:['artisanat','commerce']}
  ]},
  {id:'rh',name:'Ressources Humaines',color:'#7F77DD',risks:[
    {id:'br1',name:'Collaborateur clé indisponible',common:true,sectors:['tous']},
    {id:'br2',name:'Turnover élevé',common:true,sectors:['tous']},
    {id:'br3',name:'Recrutement difficile',common:true,sectors:['tous']},
    {id:'br4',name:'Surcharge / burn-out',common:true,sectors:['tous']},
    {id:'br5',name:'Chef cuisinier unique ou absent',common:false,sectors:['restauration']},
    {id:'br10',name:'Turnover élevé du personnel de salle',common:false,sectors:['restauration']},
    {id:'br11',name:'Difficulté de recrutement en cuisine',common:false,sectors:['restauration']},
    {id:'br12',name:'Burnout du gérant / dirigeant',common:false,sectors:['restauration']},
    {id:'r_epuisement_dirigeant',name:'Épuisement du dirigeant (70h+/semaine)',common:false,sectors:['restauration']},
    {id:'br13',name:'Personnel intérimaire non formé',common:false,sectors:['restauration']},
    {id:'br6',name:'Compagnon / artisan clé absent',common:false,sectors:['artisanat']},
    {id:'br7',name:'Praticien unique en cabinet',common:false,sectors:['sante']},
    {id:'br8',name:'Dev ou CTO qui quitte',common:false,sectors:['tech']},
    {id:'br9',name:'Gestionnaire de biens seul',common:false,sectors:['immobilier']}
  ]},
  {id:'juridique',name:'Juridique',color:'#D85A30',risks:[
    {id:'bj1',name:'Contrats mal rédigés / litiges',common:true,sectors:['tous']},
    {id:'bj2',name:'Non-conformité réglementaire',common:true,sectors:['tous']},
    {id:'bj3',name:'Contrôle fiscal ou social',common:true,sectors:['tous']},
    {id:'bj4',name:'Non-respect obligations d\'affichage',common:true,sectors:['tous']},
    {id:'bj5',name:'Non-conformité HACCP / contrôle DDPP',common:false,sectors:['restauration']},
    {id:'bj11',name:'Fraude interne / vol en caisse',common:false,sectors:['restauration']},
    {id:'bj12',name:'Fin de bail commercial',common:false,sectors:['restauration']},
    {id:'bj13',name:'Contrats extras non conformes (URSSAF)',common:false,sectors:['restauration']},
    {id:'bj14',name:'Non-respect affichage obligatoire',common:false,sectors:['restauration']},
    {id:'r_sacem',name:'Absence de contrat SACEM',common:false,sectors:['restauration']},
    {id:'r_terrasse',name:'Autorisation de terrasse non valide',common:false,sectors:['restauration']},
    {id:'r_pmr',name:'Non-conformité accessibilité PMR',common:false,sectors:['restauration']},
    {id:'r_bail',name:'Bail commercial non anticipé',common:false,sectors:['restauration']},
    {id:'r_erp_travaux',name:'Autorisation ERP non mise à jour après travaux',common:false,sectors:['restauration']},
    {id:'r_heures_sup',name:'Heures supplémentaires non déclarées',common:false,sectors:['restauration']},
    {id:'r_mutuelle_hcr',name:'Mutuelle obligatoire HCR non souscrite',common:false,sectors:['restauration']},
    {id:'r_travail_dissimule',name:'Personnel non déclaré / travail dissimulé',common:false,sectors:['restauration']},
    {id:'bj6',name:'Garantie décennale / RC pro chantier',common:false,sectors:['artisanat']},
    {id:'bj7',name:'Réglementation DPE / obligations locatives',common:false,sectors:['immobilier']},
    {id:'bj8',name:'RGPD données patients',common:false,sectors:['sante']},
    {id:'bj9',name:'Propriété intellectuelle / CGU',common:false,sectors:['tech']},
    {id:'bj10',name:'Accréditation / agrément à renouveler',common:false,sectors:['sante']}
  ]},
  {id:'reputation',name:'Réputation',color:'#D4537E',risks:[
    {id:'br1r',name:'Avis négatifs en ligne',common:true,sectors:['tous']},
    {id:'br2r',name:'Bad buzz réseaux sociaux',common:true,sectors:['tous']},
    {id:'br3r',name:'Litige client rendu public',common:true,sectors:['tous']},
    {id:'br4r',name:'Perte d\'une référence client clé',common:false,sectors:['services','tech']},
    {id:'br5r',name:'Erreur médicale médiatisée',common:false,sectors:['sante']},
    {id:'br6r',name:'Mauvais bouche-à-oreille local',common:false,sectors:['artisanat','restauration']}
  ]},
  {id:'securite',name:'Sécurité',color:'#639922',risks:[
    {id:'bs1',name:'Incendie / dégâts matériels',common:true,sectors:['tous']},
    {id:'bs2',name:'Vol ou intrusion',common:true,sectors:['tous']},
    {id:'bs3',name:'Accident du travail',common:true,sectors:['tous']},
    {id:'bs4',name:'Non-conformité sécurité incendie',common:true,sectors:['tous']},
    {id:'bs5',name:'Non-conformité hygiène alimentaire',common:false,sectors:['restauration','sante']},
    {id:'bs8',name:'Incendie / défaut conformité ERP',common:false,sectors:['restauration']},
    {id:'bs9',name:'Intoxication alimentaire client',common:false,sectors:['restauration']},
    {id:'bs10',name:'Accident salarié en cuisine (brûlure, coupure)',common:false,sectors:['restauration']},
    {id:'bs11',name:'Terrasse / ERP extérieur non conforme',common:false,sectors:['restauration']},
    {id:'bs12',name:'Absence de registre de sécurité',common:false,sectors:['restauration']},
    {id:'bs13',name:'Problème de parking / accessibilité PMR',common:false,sectors:['restauration']},
    {id:'bs6',name:'Accident de chantier / EPI manquants',common:false,sectors:['artisanat']},
    {id:'bs7',name:'Défaut de sécurité locatif',common:false,sectors:['immobilier']}
  ]},
  {id:'numerique',name:'Numérique',color:'#378ADD',risks:[
    {id:'bn1',name:'Cyberattaque / ransomware',common:true,sectors:['tous']},
    {id:'bn2',name:'Perte ou fuite de données',common:true,sectors:['tous']},
    {id:'bn3',name:'Panne du système de caisse',common:false,sectors:['restauration','commerce']},
    {id:'bn9',name:'Panne du système de réservation en ligne',common:false,sectors:['restauration']},
    {id:'bn10',name:'Cyberattaque / ransomware',common:false,sectors:['restauration']},
    {id:'bn11',name:'Perte données clients et réservations',common:false,sectors:['restauration']},
    {id:'bn12',name:'Fraude carte bancaire / TPE',common:false,sectors:['restauration','commerce']},
    {id:'bn4',name:'Panne e-commerce / site vitrine',common:false,sectors:['commerce','tech']},
    {id:'bn5',name:'Panne logiciel de gestion locative',common:false,sectors:['immobilier']},
    {id:'bn6',name:'Panne dossiers patients',common:false,sectors:['sante']},
    {id:'bn7',name:'Panne logiciel devis / facturation',common:false,sectors:['artisanat','services']},
    {id:'bn8',name:'Incident sécurité cloud / infra',common:false,sectors:['tech']}
  ]},
  {id:'commercial',name:'Commercial',color:'#1D9E75',risks:[
    {id:'bc1',name:'Saisonnalité / baisse de CA',common:true,sectors:['tous']},
    {id:'bc2',name:'Nouveau concurrent direct',common:true,sectors:['tous']},
    {id:'bc3',name:'Dépendance à un client unique',common:true,sectors:['tous']},
    {id:'bc4',name:'Évolution défavorable du marché',common:true,sectors:['tous']},
    {id:'bc9',name:'Dépendance aux plateformes de livraison',common:false,sectors:['restauration']},
    {id:'bc10',name:'Baisse de fréquentation (concurrence, travaux)',common:false,sectors:['restauration']},
    {id:'bc11',name:'Fin de contrat traiteur / événementiel clé',common:false,sectors:['restauration']},
    {id:'bc12',name:'Rupture de contrat avec un traiteur partenaire',common:false,sectors:['restauration']},
    {id:'r_fidelisation',name:'Absence de programme de fidélisation',common:false,sectors:['restauration']},
    {id:'r_carte_longue',name:'Carte trop longue (food cost incontrôlable)',common:false,sectors:['restauration']},
    {id:'r_google_absent',name:'Absence ou mauvaise gestion de la fiche Google',common:false,sectors:['restauration']},
    {id:'r_dependance_creneau',name:'Dépendance à un seul créneau (déjeuner d\'affaires)',common:false,sectors:['restauration']},
    {id:'r_travaux_voirie',name:'Travaux voirie / chantier prolongé devant l\'établissement',common:false,sectors:['restauration']},
    {id:'r_site_web',name:'Absence de site web ou site non à jour',common:false,sectors:['restauration']},
    {id:'bc5',name:'Dépendance aux plateformes de livraison',common:false,sectors:['restauration','commerce']},
    {id:'bc6',name:'Vacance prolongée du bien',common:false,sectors:['immobilier']},
    {id:'bc7',name:'Baisse de patientèle',common:false,sectors:['sante']},
    {id:'bc8',name:'Dépendance à un prescripteur unique',common:false,sectors:['artisanat','services']}
  ]}
];

/* Secteur du compte — verrouillé à la création */
var ACCOUNT_SECTOR = 'restauration';
bibCats.forEach(function(c){c.risks.forEach(function(r){r.common=(r.sectors.indexOf('tous')>-1);});});

function bibVis(r){
  return r.sectors.indexOf('tous')>-1 || r.sectors.indexOf(ACCOUNT_SECTOR)>-1;
}

/* ══════════════════════════════════════════════════
   BASE DE DONNÉES RISQUES CLEARISK (inline)
══════════════════════════════════════════════════ */
var CLEARISK_DB = {
  restauration:[
    {id:'r_haccp',nom:'Non-conformité HACCP',categorie:'Sanitaire',niveau:'critique',probabilite:3,impact:4,velocite:3,
      description:'Absence ou obsolescence du plan HACCP. En cas de contrôle DDPP, la fermeture administrative peut être prononcée sous 24h.',
      actions:[
        {titre:'Auditer le plan HACCP actuel et identifier toutes les lacunes',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Former ou requalifier l\'équipe (organisme agréé HACCP)',priorite:'urgent',delai:'Avant le contrôle'},
        {titre:'Mettre en place un registre de relevés de températures quotidiens',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier et mettre à jour les fiches allergènes de tous les plats',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Établir et afficher le plan de nettoyage et désinfection des surfaces',priorite:'normal',delai:'Ce mois'},
        {titre:'Organiser un audit interne HACCP trimestriel avec simulation de contrôle',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Relevé des températures frigos/congélateurs (2x/jour)',frequence:'Quotidien'},
        {titre:'Vérification des DLC produits frais en réception',frequence:'À chaque livraison'},
        {titre:'Contrôle propreté des surfaces de travail avant service',frequence:'Quotidien'},
        {titre:'Revue des fiches allergènes lors de tout changement de menu',frequence:'À chaque modification'},
        {titre:'Suivi du carnet de traçabilité fournisseurs',frequence:'Hebdomadaire'}
      ],
      indicateurs:[{label:'Jours avant expiration certification',seuil_alerte:90,unite:'jours'},{label:'Relevés températures manquants / semaine',seuil_alerte:2,unite:'relevés'},{label:'Fiches allergènes à jour',seuil_alerte:100,unite:'%'}]},
    {id:'r_intoxication',nom:'Risque d\'intoxication alimentaire client',categorie:'Sanitaire',niveau:'critique',probabilite:2,impact:4,velocite:3,
      description:'Une intoxication alimentaire peut entraîner la fermeture immédiate, une procédure judiciaire et une presse désastreuse. Causes : rupture chaîne du froid, erreur allergène, contamination croisée.',
      actions:[
        {titre:'Former tout le personnel aux bonnes pratiques d\'hygiène alimentaire',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place des procédures de séparation physique aliments crus/cuits',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Vérifier que l\'assurance RC Pro couvre les intoxications alimentaires',priorite:'urgent',delai:'Ce mois'},
        {titre:'Créer un protocole de crise en cas d\'alerte intoxication (qui appelle qui)',priorite:'normal',delai:'Ce mois'},
        {titre:'Conserver des échantillons de chaque service (plats témoins 48h)',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Test huile de friture (acidité) avant chaque service',frequence:'Quotidien'},
        {titre:'Contrôle visuel et olfactif des produits à réception',frequence:'À chaque livraison'},
        {titre:'Vérification températures plats chauds avant envoi (>63°C)',frequence:'À chaque service'},
        {titre:'Désinfection des planches à découper entre chaque aliment',frequence:'Continu'},
        {titre:'Contrôle des dates de péremption des produits en stock',frequence:'Quotidien'}
      ],
      indicateurs:[{label:'Incidents hygiène signalés',seuil_alerte:0,unite:'incidents'},{label:'Personnel formé HACCP',seuil_alerte:100,unite:'%'},{label:'Contrôles températures faits',seuil_alerte:100,unite:'%'}]},
    {id:'r_incendie',nom:'Incendie / défaut sécurité ERP',categorie:'Sécurité',niveau:'critique',probabilite:1,impact:4,velocite:3,
      description:'Restaurant = ERP. Un incendie même mineur peut entraîner une fermeture administrative immédiate. L\'absence de conformité est sanctionnée lors des visites périodiques obligatoires.',
      actions:[
        {titre:'Vérifier la validité du rapport de la commission de sécurité',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Contrôler les extincteurs et le balisage issues de secours',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Organiser un exercice d\'évacuation avec l\'équipe',priorite:'normal',delai:'Ce mois'},
        {titre:'Vérifier le bon fonctionnement des détecteurs de fumée et alarmes',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Afficher les consignes de sécurité et plans d\'évacuation visibles',priorite:'normal',delai:'Ce mois'},
        {titre:'Programmer la visite de contrôle de l\'installation gaz (tous les 3 ans)',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification visuelle issues de secours dégagées avant ouverture',frequence:'Quotidien'},
        {titre:'Test déclenchement alarme incendie',frequence:'Mensuel'},
        {titre:'Contrôle état extincteurs (pression, scellé)',frequence:'Mensuel'},
        {titre:'Vérification hotte et filtre à graisse (risque incendie cuisine)',frequence:'Hebdomadaire'}
      ],
      indicateurs:[{label:'Date dernière visite commission sécurité',seuil_alerte:730,unite:'jours'},{label:'Extincteurs vérifiés dans l\'année',seuil_alerte:100,unite:'%'},{label:'Formation évacuation équipe',seuil_alerte:365,unite:'jours'}]},
    {id:'r_fournisseur_unique',nom:'Dépendance fournisseur unique (viande / frais)',categorie:'Opérationnel',niveau:'critique',probabilite:2,impact:4,velocite:3,
      description:'Un seul fournisseur pour un produit clé expose à une rupture immédiate. La procédure collective d\'un grossiste peut stopper les livraisons sous 48h.',
      actions:[
        {titre:'Identifier 2 fournisseurs alternatifs pour chaque produit critique',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Négocier un accord-cadre avec un second fournisseur viande et un second fournisseur frais',priorite:'urgent',delai:'Ce mois'},
        {titre:'Constituer un stock tampon de 5 jours pour les produits non périssables',priorite:'normal',delai:'Ce mois'},
        {titre:'Cartographier tous les fournisseurs actuels et leur criticité',priorite:'normal',delai:'Cette semaine'},
        {titre:'Mettre en place une procédure de commande d\'urgence documentée',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi des délais de livraison par fournisseur',frequence:'À chaque livraison'},
        {titre:'Revue mensuelle du nombre de fournisseurs actifs par famille produit',frequence:'Mensuel'},
        {titre:'Vérification stock tampon produits critiques',frequence:'Hebdomadaire'},
        {titre:'Évaluation annuelle des fournisseurs (fiabilité, prix, qualité)',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Nb fournisseurs actifs par famille produit',seuil_alerte:2,unite:'fournisseurs'},{label:'% CA dépendant d\'un seul fournisseur',seuil_alerte:60,unite:'%'},{label:'Stock tampon produits frais',seuil_alerte:3,unite:'jours'}]},
    {id:'r_tresorerie_saison',nom:'Trésorerie tendue (creux saisonnier)',categorie:'Financier',niveau:'critique',probabilite:3,impact:3,velocite:2,
      description:'Creux saisonniers prononcés (janvier-février, août). Sans matelas de trésorerie, impossible de couvrir les charges fixes lors des mois creux.',
      actions:[
        {titre:'Négocier un report de 30 jours sur les prochaines échéances fournisseurs',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Ouvrir une ligne de crédit court terme avant d\'en avoir besoin',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer une réserve dédiée aux creux (virer 8% du CA mensuel en période haute)',priorite:'planif',delai:'Ce trimestre'},
        {titre:'Planifier les dépenses exceptionnelles (travaux, équipements) hors périodes creuses',priorite:'normal',delai:'Ce mois'},
        {titre:'Établir un prévisionnel de trésorerie mensuel sur 12 mois glissants',priorite:'urgent',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Point trésorerie hebdomadaire (solde, entrées, sorties prévues)',frequence:'Hebdomadaire'},
        {titre:'Rapprochement bancaire et comparaison au prévisionnel',frequence:'Mensuel'},
        {titre:'Revue food cost et marges par catégorie de plat',frequence:'Mensuel'},
        {titre:'Suivi du CA quotidien vs objectif',frequence:'Quotidien'}
      ],
      indicateurs:[{label:'Jours de trésorerie disponible',seuil_alerte:45,unite:'jours'},{label:'Écart CA vs charges fixes',seuil_alerte:0,unite:'€'},{label:'Délai moyen paiement fournisseurs',seuil_alerte:45,unite:'jours'}]},
    {id:'r_chef_unique',nom:'Chef cuisinier seul / compétence non transmise',categorie:'Ressources Humaines',niveau:'critique',probabilite:3,impact:4,velocite:3,
      description:'Si le chef unique est absent, le restaurant ne peut plus servir. Une absence imprévue peut forcer la fermeture dès le lendemain.',
      actions:[
        {titre:'Organiser 3 sessions de transmission des recettes signatures avec un commis',priorite:'urgent',delai:'Ce mois'},
        {titre:'Ficher toutes les recettes avec grammages, photos et procédures (PDF)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier un chef intérimaire via un réseau de remplacement',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Former un second de cuisine à l\'ensemble de la carte',priorite:'urgent',delai:'Ce trimestre'},
        {titre:'Créer un guide opérationnel cuisine utilisable par un remplaçant',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification que les fiches recettes sont à jour et accessibles',frequence:'Mensuel'},
        {titre:'Session de formation cuisine croisée (chef forme le second et vice-versa)',frequence:'Mensuel'},
        {titre:'Test service complet par le second sans le chef',frequence:'Trimestriel'},
        {titre:'Mise à jour du registre des contacts remplaçants',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'% recettes documentées',seuil_alerte:80,unite:'%'},{label:'Personnes capables d\'assurer le service sans le chef',seuil_alerte:1,unite:'personnes'},{label:'Jours absence chef (3 derniers mois)',seuil_alerte:5,unite:'jours'}]},
    {id:'r_avis_negatifs',nom:'Accumulation d\'avis négatifs en ligne',categorie:'Réputation',niveau:'eleve',probabilite:3,impact:3,velocite:2,
      description:'Descendre sous 4/5 étoiles sur Google provoque une perte visible de fréquentation. Les avis influencent 78% des décisions de réservation.',
      actions:[
        {titre:'Répondre à tous les avis négatifs sous 48h de manière professionnelle',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Installer des QR codes sur les tables pour inciter les clients satisfaits',priorite:'normal',delai:'Ce mois'},
        {titre:'Nommer un responsable de la réputation digitale',priorite:'planif',delai:'Ce trimestre'},
        {titre:'Mettre en place un système de recueil d\'avis en sortie de caisse',priorite:'normal',delai:'Ce mois'},
        {titre:'Analyser les motifs récurrents des avis négatifs et plan d\'amélioration',priorite:'urgent',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Veille des avis Google, TripAdvisor, TheFork',frequence:'Quotidien'},
        {titre:'Suivi de la note moyenne mensuelle (toutes plateformes)',frequence:'Mensuel'},
        {titre:'Analyse des verbatims négatifs et actions correctives',frequence:'Mensuel'},
        {titre:'Mesure NPS client par enquête courte',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Note Google My Business',seuil_alerte:4.0,unite:'/5'},{label:'Nouveaux avis négatifs / mois',seuil_alerte:3,unite:'avis'},{label:'Taux de réponse aux avis',seuil_alerte:90,unite:'%'}]},
    {id:'r_hausse_matieres',nom:'Hausse des coûts matières premières',categorie:'Financier',niveau:'eleve',probabilite:4,impact:3,velocite:2,
      description:'L\'inflation alimentaire peut réduire la marge brute de 5 à 10 points en quelques mois. Sans suivi du food cost mensuel, la détection est tardive.',
      actions:[
        {titre:'Calculer le food cost réel par catégorie de plat chaque mois',priorite:'urgent',delai:'Ce mois'},
        {titre:'Supprimer ou reformuler les plats avec food cost > 35%',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Négocier des contrats à prix fixe 6 mois avec les fournisseurs principaux',priorite:'planif',delai:'Ce trimestre'},
        {titre:'Introduire des plats saisonniers pour profiter des prix bas',priorite:'normal',delai:'Ce mois'},
        {titre:'Revoir la carte et les prix une fois par trimestre',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul du food cost global par semaine',frequence:'Hebdomadaire'},
        {titre:'Comparaison des prix d\'achat vs mois précédent',frequence:'Mensuel'},
        {titre:'Revue marge brute par grande famille de plats',frequence:'Mensuel'},
        {titre:'Suivi du ratio matières / CA en temps réel',frequence:'Quotidien'}
      ],
      indicateurs:[{label:'Food cost global mensuel',seuil_alerte:32,unite:'%'},{label:'Écart prix achat viande vs M-3',seuil_alerte:10,unite:'%'},{label:'Marge brute sur ventes',seuil_alerte:65,unite:'%'}]},
    {id:'r_contrats_rh',nom:'Contrats de travail non conformes',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:4,velocite:1,
      description:'Un contrat mal rédigé ou recours abusif aux extras peut entraîner un redressement URSSAF lourd (remontée sur 3 ans). Le secteur CHR est particulièrement ciblé.',
      actions:[
        {titre:'Faire auditer tous les contrats par un juriste droit social',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier l\'application de la Convention Collective HCR sur tous les postes',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place un système de badgeage fiable et conforme',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Régulariser les heures supplémentaires non déclarées',priorite:'urgent',delai:'Ce mois'},
        {titre:'Créer un registre du personnel mis à jour en temps réel',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Revue mensuelle des heures travaillées vs contrat',frequence:'Mensuel'},
        {titre:'Vérification des bulletins de paie par un expert-comptable',frequence:'Mensuel'},
        {titre:'Audit RH annuel (contrats, avenants, registre personnel)',frequence:'Annuel'},
        {titre:'Veille des évolutions de la Convention Collective HCR',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Contrats vérifiés / mis à jour',seuil_alerte:100,unite:'%'},{label:'Heures supplémentaires déclarées et payées',seuil_alerte:100,unite:'%'},{label:'Dernier audit social',seuil_alerte:365,unite:'jours'}]},
    {id:'r_panne_froid',nom:'Panne chambre froide / équipement cuisine',categorie:'Opérationnel',niveau:'eleve',probabilite:2,impact:4,velocite:3,
      description:'Perte totale des stocks (2 000 à 8 000€) et fermeture d\'urgence 24-72h possible. Sans contrat de maintenance, le délai d\'intervention peut dépasser 48h.',
      actions:[
        {titre:'Souscrire un contrat de maintenance préventive avec intervention sous 4h',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier que l\'assurance couvre la perte de marchandises sur panne',priorite:'urgent',delai:'Ce mois'},
        {titre:'Installer une alarme température avec alerte SMS automatique',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Identifier un prestataire froid de secours disponible le week-end',priorite:'normal',delai:'Ce mois'},
        {titre:'Tenir un inventaire chiffré des stocks pour déclaration sinistre',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Relevé des températures chambres froides (2x/jour)',frequence:'Quotidien'},
        {titre:'Vérification joints, éclairage et alarmes des chambres froides',frequence:'Hebdomadaire'},
        {titre:'Maintenance préventive équipements lourds (four, friteuse, plaque)',frequence:'Semestriel'},
        {titre:'Test des sondes de température avec thermomètre étalon',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Dernière maintenance chambre froide',seuil_alerte:180,unite:'jours'},{label:'Couverture assurance marchandises',seuil_alerte:5000,unite:'€'},{label:'Température chambre froide',seuil_alerte:4,unite:'°C'}]},
    {id:'r_dependance_livraison',nom:'Dépendance aux plateformes de livraison',categorie:'Commercial',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'CA livraison > 30% via Uber Eats/Deliveroo expose à des modifications de commissions (25-35%) ou un déréférencement. La marge peut devenir négative sur certaines commandes.',
      actions:[
        {titre:'Calculer la marge réelle par commande plateforme (CA - commission - emballage - temps)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Développer un canal de commande directe (site, WhatsApp Business)',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Tester une offre fidélité pour convertir des clients plateformes en directs',priorite:'planif',delai:'Ce trimestre'},
        {titre:'Négocier un accord volume contre commission réduite avec les plateformes',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul du CA et de la marge par canal de vente (salle / livraison / click&collect)',frequence:'Mensuel'},
        {titre:'Suivi du ratio commissions plateformes / CA total livraison',frequence:'Mensuel'},
        {titre:'Revue des conditions tarifaires des plateformes',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'% CA issu des plateformes livraison',seuil_alerte:30,unite:'%'},{label:'Commission moyenne plateforme',seuil_alerte:28,unite:'%'},{label:'Nb plateformes actives',seuil_alerte:2,unite:'plateformes'}]},
    {id:'r_turnover',nom:'Turnover élevé du personnel de salle',categorie:'Ressources Humaines',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Le taux de turnover dans la restauration dépasse 80%/an en moyenne. Chaque départ représente 2 000 à 5 000€ de coûts de recrutement et de formation.',
      actions:[
        {titre:'Mener des entretiens de départ pour identifier les causes réelles',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place un processus d\'intégration structuré sur 30 jours',priorite:'normal',delai:'Ce mois'},
        {titre:'Proposer des avantages concurrentiels (repas, horaires, primes de fidélité)',priorite:'planif',delai:'Ce trimestre'},
        {titre:'Créer un parcours de montée en compétences avec évolutions visibles',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul du taux de turnover mensuel',frequence:'Mensuel'},
        {titre:'Entretien individuel annuel avec chaque employé',frequence:'Annuel'},
        {titre:'Baromètre de satisfaction équipe (questionnaire anonyme)',frequence:'Trimestriel'},
        {titre:'Suivi des coûts de recrutement et formation',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Taux de turnover annuel',seuil_alerte:60,unite:'%'},{label:'Ancienneté moyenne équipe',seuil_alerte:12,unite:'mois'},{label:'Coût recrutement annuel',seuil_alerte:5000,unite:'€'}]},
    {id:'r_panne_caisse',nom:'Panne du système de caisse / TPE',categorie:'Numérique',niveau:'modere',probabilite:2,impact:2,velocite:3,
      description:'Une panne de caisse en plein service bloque toutes les transactions. Sans procédure de secours, le service s\'interrompt et les clients mécontents peuvent partir.',
      actions:[
        {titre:'Mettre en place un terminal de paiement de secours (lecteur Stripe ou SumUp)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former le personnel à la procédure de secours (caisse manuelle, rédaction tickets)',priorite:'normal',delai:'Ce mois'},
        {titre:'Souscrire un contrat d\'assistance technique 7j/7 pour la caisse',priorite:'normal',delai:'Ce mois'},
        {titre:'Sauvegarder régulièrement les données de caisse sur le cloud',priorite:'normal',delai:'Cette semaine'}
      ],
      controles:[
        {titre:'Test du terminal de secours chaque semaine',frequence:'Hebdomadaire'},
        {titre:'Vérification de la sauvegarde cloud des données de caisse',frequence:'Quotidien'},
        {titre:'Mise à jour du logiciel de caisse',frequence:'Mensuel'},
        {titre:'Revue du contrat de maintenance matériel de caisse',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Terminal de secours opérationnel',seuil_alerte:1,unite:'terminal'},{label:'Dernière sauvegarde données caisse',seuil_alerte:1,unite:'jours'},{label:'Incidents caisse / mois',seuil_alerte:1,unite:'incidents'}]},
    {id:'r_fraude_interne',nom:'Fraude interne / vol en caisse',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:1,
      description:'La restauration est l\'un des secteurs les plus exposés à la fraude interne (vols en caisse, repas offerts non déclarés, manipulation des stocks). Perte estimée à 3-5% du CA.',
      actions:[
        {titre:'Installer un logiciel de caisse avec traçabilité complète des transactions et annulations',priorite:'urgent',delai:'Ce mois'},
        {titre:'Séparer les fonctions : celui qui encaisse ne gère pas le stock',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place des inventaires tournants et inopinés',priorite:'normal',delai:'Ce mois'},
        {titre:'Définir une politique claire sur les avantages en nature (repas du personnel)',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Revue des écarts de caisse quotidiens',frequence:'Quotidien'},
        {titre:'Analyse des annulations et remises sur la caisse',frequence:'Hebdomadaire'},
        {titre:'Inventaire surprise des alcools et produits à forte valeur',frequence:'Mensuel'},
        {titre:'Rapprochement CA encaissé vs CA théorique (contrôle des couverts)',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Écart caisse moyen journalier',seuil_alerte:50,unite:'€'},{label:'Taux d\'annulations sur caisse',seuil_alerte:3,unite:'%'},{label:'Écart inventaire stocks alcool',seuil_alerte:2,unite:'%'}]},
    {id:'r_non_conformite_ddpp',nom:'Contrôle DDPP non anticipé',categorie:'Sanitaire',niveau:'critique',probabilite:2,impact:4,velocite:3,
      description:'Les inspecteurs DDPP peuvent se présenter sans préavis. Toute non-conformité majeure peut déclencher une mise en demeure, voire une fermeture administrative immédiate.',
      actions:[
        {titre:'Réaliser un auto-diagnostic DDPP (grille officielle) tous les 3 mois',priorite:'urgent',delai:'Ce mois'},
        {titre:'Tenir à disposition l\'ensemble des documents obligatoires (registres, certifications)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Corriger immédiatement les non-conformités identifiées lors de l\'auto-diagnostic',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Former le personnel aux questions fréquentes des inspecteurs',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Revue du classeur DDPP (documents, registres, certifications à jour)',frequence:'Mensuel'},
        {titre:'Auto-audit hygiène complet (grille DDPP)',frequence:'Trimestriel'},
        {titre:'Vérification affichage obligatoire (allergènes, prix, hygiène, éthylotests)',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Non-conformités identifiées lors du dernier auto-audit',seuil_alerte:0,unite:'points rouges'},{label:'Documents DDPP à jour',seuil_alerte:100,unite:'%'},{label:'Dernier auto-audit réalisé',seuil_alerte:90,unite:'jours'}]},
    {id:'r_loyer',nom:'Loyer commercial / fin de bail commercial',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:4,velocite:1,
      description:'La fin d\'un bail 3-6-9 peut forcer un renouvellement à la hausse ou une résiliation. Une augmentation de loyer de 20% peut représenter 2 000 à 5 000€ de charges supplémentaires/mois.',
      actions:[
        {titre:'Vérifier la date d\'échéance du bail commercial et anticiper le renouvellement 18 mois avant',priorite:'urgent',delai:'Ce mois'},
        {titre:'Consulter un avocat spécialisé baux commerciaux avant toute renégociation',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Analyser les loyers de marché dans le quartier pour négocier en connaissance de cause',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Vérifier que toutes les clauses du bail actuel sont respectées',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Revue annuelle des conditions du bail et des obligations locatives',frequence:'Annuel'},
        {titre:'Suivi du ratio loyer / CA mensuel',frequence:'Mensuel'},
        {titre:'Vérification de la conformité des travaux réalisés vs bail',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Mois avant échéance bail',seuil_alerte:18,unite:'mois'},{label:'Ratio loyer / CA',seuil_alerte:12,unite:'%'},{label:'Litige bailleur en cours',seuil_alerte:0,unite:'litige'}]},
    {id:'r_cyber_caisse',nom:'Cyberattaque / ransomware caisse et données',categorie:'Numérique',niveau:'modere',probabilite:2,impact:3,velocite:3,
      description:'Les TPE de restauration sont des cibles croissantes des ransomwares. Perte des données clients, blocage caisse, rançon demandée. Coût moyen d\'un incident : 5 000 à 15 000€.',
      actions:[
        {titre:'Activer les mises à jour automatiques sur tous les postes',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Installer un antivirus professionnel sur les postes de travail',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Sauvegarder les données hors ligne (NAS ou cloud chiffré)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former le personnel à reconnaître les mails de phishing',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification des mises à jour logiciels et antivirus',frequence:'Hebdomadaire'},
        {titre:'Test de restauration des sauvegardes',frequence:'Mensuel'},
        {titre:'Revue des accès distants et des mots de passe',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Postes avec antivirus à jour',seuil_alerte:100,unite:'%'},{label:'Dernière sauvegarde complète',seuil_alerte:7,unite:'jours'},{label:'Incidents cyber signalés',seuil_alerte:0,unite:'incidents'}]},
    {id:'r_pic_activite',nom:'Pic d\'activité non anticipé (Noël, été, événements)',categorie:'Opérationnel',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Un afflux mal anticipé dégrade la qualité de service, génère des avis négatifs et épuise l\'équipe. Les périodes critiques (Noël, Saint-Valentin, été) sont prévisibles et planifiables.',
      actions:[
        {titre:'Établir un planning renforcé dès 8 semaines avant chaque pic identifié',priorite:'urgent',delai:'Ce mois'},
        {titre:'Constituer un vivier d\'extras formés et disponibles',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Proposer un menu simplifié à capacité réduite en période de forte demande',priorite:'normal',delai:'Ce mois'},
        {titre:'Activer la réservation obligatoire sur les périodes à risque',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Revue du planning des effectifs pour les 8 semaines à venir',frequence:'Hebdomadaire'},
        {titre:'Analyse du taux de remplissage et des refus de table',frequence:'Hebdomadaire'},
        {titre:'Débriefing post-pic avec l\'équipe (points positifs et axes d\'amélioration)',frequence:'Après chaque pic'}
      ],
      indicateurs:[{label:'Taux de remplissage moyen sur pic',seuil_alerte:85,unite:'%'},{label:'Avis négatifs liés au service lent',seuil_alerte:0,unite:'avis'},{label:'Heures supplémentaires non planifiées',seuil_alerte:10,unite:'h/semaine'}]},
    {id:'r_assurance',nom:'Assurance insuffisante / non adaptée',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:4,velocite:1,
      description:'Une assurance mal calibrée peut laisser le restaurateur sans couverture en cas de sinistre majeur (incendie, dégât des eaux, intoxication). Vérification à faire annuellement.',
      actions:[
        {titre:'Réaliser un audit de toutes les assurances en cours (RC Pro, multirisque, perte d\'exploitation)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier que la perte d\'exploitation est couverte en cas de fermeture administrative',priorite:'urgent',delai:'Ce mois'},
        {titre:'Comparer les offres des assureurs spécialisés restauration',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Mettre à jour les garanties après tout travaux ou changement d\'activité',priorite:'normal',delai:'Après chaque changement'}
      ],
      controles:[
        {titre:'Revue annuelle des contrats d\'assurance avec le courtier',frequence:'Annuel'},
        {titre:'Vérification que les nouvelles acquisitions (équipements) sont assurées',frequence:'À chaque acquisition'},
        {titre:'Mise à jour de la valeur des stocks et équipements auprès de l\'assureur',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Couverture perte d\'exploitation',seuil_alerte:1,unite:'contrat valide'},{label:'Dernière révision assurances',seuil_alerte:365,unite:'jours'},{label:'Franchise par sinistre',seuil_alerte:3000,unite:'€'}]},

    {id:'r_sacem',nom:'Absence de contrat SACEM',categorie:'Juridique',niveau:'eleve',probabilite:3,impact:3,velocite:1,
      description:'Toute diffusion de musique (radio, playlist, télévision avec son) dans un restaurant est soumise à redevance SACEM. L\'absence de contrat expose à un redressement rétroactif pouvant dépasser 3 000€.',
      actions:[
        {titre:'Contacter la SACEM pour régulariser et souscrire un contrat adapté à la surface',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier si un contrat SPRE (droits voisins) est aussi nécessaire',priorite:'normal',delai:'Ce mois'},
        {titre:'Conserver les justificatifs de paiement SACEM dans les documents administratifs',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification renouvellement contrat SACEM',frequence:'Annuel'},
        {titre:'Contrôle que la surface déclarée correspond à la réalité',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Contrat SACEM valide',seuil_alerte:1,unite:'contrat'},{label:'Dernière facturation SACEM',seuil_alerte:365,unite:'jours'}]},

    {id:'r_terrasse',nom:'Autorisation de terrasse non valide',categorie:'Juridique',niveau:'critique',probabilite:2,impact:4,velocite:3,
      description:'L\'autorisation d\'occupation du domaine public est annuelle et non tacitement reconductible. Une terrasse sans autorisation valide expose à une fermeture immédiate et une amende.',
      actions:[
        {titre:'Vérifier la validité de l\'autorisation de voirie auprès de la mairie',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Renouveler l\'autorisation chaque année avant l\'ouverture de la saison',priorite:'urgent',delai:'Avant saison'},
        {titre:'S\'assurer que la surface et le mobilier déclarés correspondent à la réalité',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Renouvellement autorisation terrasse',frequence:'Annuel'},
        {titre:'Vérification conformité mobilier avec autorisation',frequence:'Saisonnier'}
      ],
      indicateurs:[{label:'Autorisation terrasse valide',seuil_alerte:1,unite:'document'},{label:'Mois avant expiration autorisation',seuil_alerte:2,unite:'mois'}]},

    {id:'r_pmr',nom:'Non-conformité accessibilité PMR',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,
      description:'Obligation légale pour tout ERP. Un établissement non conforme peut recevoir une mise en demeure de travaux coûtant 5 000 à 30 000€ selon la configuration.',
      actions:[
        {titre:'Réaliser un diagnostic accessibilité avec un bureau d\'études spécialisé',priorite:'urgent',delai:'Ce mois'},
        {titre:'Déposer un Ad\'AP en mairie si les travaux nécessaires sont importants',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Mettre en place les aménagements simples en priorité (rampe, signalétique, sanitaire)',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification conformité PMR après tout travaux',frequence:'Après travaux'},
        {titre:'Révision du statut Ad\'AP si déposé',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Diagnostic accessibilité réalisé',seuil_alerte:1,unite:'rapport'},{label:'Points non conformes restants',seuil_alerte:0,unite:'points'}]},

    {id:'r_bail',nom:'Bail commercial non anticipé',categorie:'Juridique',niveau:'critique',probabilite:2,impact:4,velocite:1,
      description:'Un bail commercial se renouvelle tous les 3 ans. Sans anticipation, le bailleur peut refuser le renouvellement ou imposer une forte hausse de loyer, menaçant la viabilité du restaurant.',
      actions:[
        {titre:'Identifier précisément la prochaine date d\'échéance triennale du bail',priorite:'urgent',delai:'Ce mois'},
        {titre:'Consulter un avocat spécialisé en baux commerciaux 12 mois avant l\'échéance',priorite:'normal',delai:'6 mois avant échéance'},
        {titre:'Vérifier les clauses de révision de loyer et les conditions de renouvellement',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification date échéance bail commercial',frequence:'Annuel'},
        {titre:'Suivi des révisions de loyer contractuelles',frequence:'Triennal'}
      ],
      indicateurs:[{label:'Mois avant prochaine échéance bail',seuil_alerte:12,unite:'mois'},{label:'Avocat mandaté pour renouvellement',seuil_alerte:1,unite:'contact'}]},

    {id:'r_erp_travaux',nom:'Autorisation ERP non mise à jour après travaux',categorie:'Juridique',niveau:'critique',probabilite:2,impact:4,velocite:3,
      description:'Tout travaux ou modification d\'agencement nécessite une mise à jour de l\'autorisation ERP. Un contrôle peut entraîner une fermeture administrative immédiate si la configuration a changé.',
      actions:[
        {titre:'Contacter la mairie pour régulariser l\'autorisation ERP si des travaux ont été réalisés',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Faire réaliser une visite de conformité par la commission de sécurité',priorite:'urgent',delai:'Ce mois'},
        {titre:'Ne réaliser aucun travaux futurs sans vérifier l\'impact sur l\'autorisation ERP',priorite:'normal',delai:'En continu'}
      ],
      controles:[
        {titre:'Vérification que l\'autorisation ERP correspond à la configuration actuelle',frequence:'Annuel'},
        {titre:'Consultation mairie avant tout projet de travaux',frequence:'Avant travaux'}
      ],
      indicateurs:[{label:'Autorisation ERP à jour',seuil_alerte:1,unite:'document'},{label:'Dernière visite commission sécurité',seuil_alerte:1095,unite:'jours'}]},

    {id:'r_heures_sup',nom:'Heures supplémentaires non déclarées',categorie:'Juridique',niveau:'eleve',probabilite:3,impact:3,velocite:1,
      description:'En restauration, le recours aux heures supplémentaires non déclarées est fréquent. Un contrôle URSSAF peut générer un redressement sur 3 ans, majorations et pénalités incluses.',
      actions:[
        {titre:'Mettre en place un système de pointage ou de suivi des heures pour tout le personnel',priorite:'urgent',delai:'Ce mois'},
        {titre:'Régulariser les heures supplémentaires dues sur les 3 derniers mois',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former le responsable de salle aux règles de la convention collective HCR',priorite:'normal',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification mensuelle du compteur heures supplémentaires par salarié',frequence:'Mensuel'},
        {titre:'Audit des plannings vs heures réellement effectuées',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Personnel avec suivi des heures formalisé',seuil_alerte:100,unite:'%'},{label:'Heures supplémentaires payées dans le mois',seuil_alerte:100,unite:'%'}]},

    {id:'r_mutuelle_hcr',nom:'Mutuelle obligatoire HCR non souscrite',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,
      description:'La convention collective HCR impose une mutuelle santé obligatoire pour tous les salariés. L\'absence expose l\'employeur à un redressement URSSAF et au paiement rétroactif des cotisations.',
      actions:[
        {titre:'Souscrire un contrat de mutuelle collective conforme à la convention HCR',priorite:'urgent',delai:'Ce mois'},
        {titre:'Remettre à chaque salarié une notice d\'information sur la mutuelle',priorite:'normal',delai:'Ce mois'},
        {titre:'Vérifier que les salariés qui refusent ont signé une dispense valable',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification que tous les nouveaux salariés sont affiliés à la mutuelle',frequence:'À chaque embauche'},
        {titre:'Renouvellement du contrat mutuelle et vérification conformité HCR',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Salariés couverts par mutuelle collective',seuil_alerte:100,unite:'%'},{label:'Contrat mutuelle conforme HCR',seuil_alerte:1,unite:'contrat'}]},

    {id:'r_decouvert',nom:'Découvert bancaire structurel',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:2,
      description:'Un découvert utilisé en permanence coûte en agios et signale une fragilité structurelle de trésorerie. La banque peut réduire ou supprimer la ligne unilatéralement, provoquant une cessation immédiate.',
      actions:[
        {titre:'Ouvrir une ligne de crédit court terme à taux plus avantageux que le découvert',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place un suivi de trésorerie hebdomadaire pour anticiper les creux',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Négocier des délais de paiement fournisseurs pour lisser les sorties',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Suivi du solde bancaire et du découvert utilisé',frequence:'Hebdomadaire'},
        {titre:'Prévisionnel de trésorerie 30 jours glissants',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Jours en découvert par mois',seuil_alerte:5,unite:'jours'},{label:'Montant agios mensuels',seuil_alerte:200,unite:'€'}]},

    {id:'r_ticket_moyen',nom:'Ticket moyen insuffisant au regard des charges',categorie:'Financier',niveau:'eleve',probabilite:2,impact:4,velocite:1,
      description:'Un ticket moyen trop bas par rapport aux charges fixes (loyer, masse salariale, food cost) rend l\'établissement non viable même à pleine capacité.',
      actions:[
        {titre:'Calculer le ticket moyen minimum nécessaire à la rentabilité (seuil de rentabilité / nb couverts)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Revoir le positionnement tarifaire de la carte sur les plats à faible marge',priorite:'normal',delai:'Ce mois'},
        {titre:'Développer des offres qui augmentent le panier moyen (suggestions, boissons, desserts)',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Suivi du ticket moyen par service (midi/soir) et par jour',frequence:'Hebdomadaire'},
        {titre:'Analyse de la marge par famille de plats',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Ticket moyen HT',seuil_alerte:18,unite:'€'},{label:'Taux de prise dessert / boisson',seuil_alerte:40,unite:'%'}]},

    {id:'r_tva_provision',nom:'TVA non provisionnée / décalage fiscal',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:2,
      description:'En restauration, la TVA collectée (10% sur les repas) doit être reversée mensuellement ou trimestriellement. Sans provisionnement, le compte se retrouve à sec à chaque échéance.',
      actions:[
        {titre:'Ouvrir un sous-compte dédié et y virer automatiquement la TVA dès l\'encaissement',priorite:'urgent',delai:'Ce mois'},
        {titre:'Paramétrer un rappel automatique 10 jours avant chaque échéance TVA',priorite:'normal',delai:'Ce mois'},
        {titre:'Vérifier avec l\'expert-comptable que le régime TVA est le plus adapté',priorite:'normal',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification du montant TVA provisionné vs collecté',frequence:'Mensuel'},
        {titre:'Déclaration TVA et paiement dans les délais',frequence:'Mensuel ou trimestriel'}
      ],
      indicateurs:[{label:'TVA provisionnée sur compte dédié',seuil_alerte:100,unite:'%'},{label:'Retards de déclaration TVA sur 12 mois',seuil_alerte:0,unite:'retards'}]},

    {id:'r_food_cost',nom:'Food cost mal maîtrisé (ratio matières > 35%)',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:2,
      description:'Un ratio matières premières supérieur à 35% du CA HT détruit la marge. Causes : manque de traçabilité, gaspillage, portions non standardisées, vols.',
      actions:[
        {titre:'Calculer le food cost réel par famille de plats et identifier les plats non rentables',priorite:'urgent',delai:'Ce mois'},
        {titre:'Standardiser les grammages et créer des fiches techniques pour chaque plat',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place un inventaire hebdomadaire des produits frais et un suivi des pertes',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Inventaire hebdomadaire des stocks frais et calcul des pertes',frequence:'Hebdomadaire'},
        {titre:'Calcul du food cost mensuel par catégorie',frequence:'Mensuel'},
        {titre:'Vérification du respect des fiches techniques par le chef',frequence:'Hebdomadaire'}
      ],
      indicateurs:[{label:'Ratio food cost global',seuil_alerte:35,unite:'%'},{label:'Pertes hebdomadaires',seuil_alerte:5,unite:'% du stock'}]},

    {id:'r_epuisement_dirigeant',nom:'Épuisement du dirigeant',categorie:'Ressources Humaines',niveau:'eleve',probabilite:3,impact:4,velocite:2,
      description:'Un dirigeant qui travaille 70h+/semaine seul est un risque de fermeture à court terme. Son incapacité (maladie, accident) paralyse immédiatement l\'activité.',
      actions:[
        {titre:'Identifier les 3 tâches que seul le dirigeant peut faire et déléguer le reste',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former un second (chef de rang, second de cuisine) à la gestion quotidienne',priorite:'urgent',delai:'Ce trimestre'},
        {titre:'Planifier au moins 2 semaines de congés dans l\'année et tester la délégation',priorite:'normal',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Point mensuel sur la charge de travail du dirigeant',frequence:'Mensuel'},
        {titre:'Test de fonctionnement sans le dirigeant (1 journée par trimestre)',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Heures travaillées par semaine (dirigeant)',seuil_alerte:60,unite:'h/semaine'},{label:'Jours de congés pris dans l\'année',seuil_alerte:14,unite:'jours'}]},

    {id:'r_travail_dissimule',nom:'Personnel non déclaré / travail dissimulé',categorie:'Juridique',niveau:'critique',probabilite:2,impact:4,velocite:1,
      description:'Le travail dissimulé en restauration est l\'un des plus contrôlés par l\'URSSAF et la DIRECCTE. Les sanctions sont : redressement 3 ans + pénalités 40% + risque pénal pour le dirigeant.',
      actions:[
        {titre:'Vérifier que tous les salariés (y compris extras) sont déclarés avant la prise de poste',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Utiliser le TESA (Titre Emploi Simplifié Agricole) ou le DPAE systématiquement',priorite:'urgent',delai:'Ce mois'},
        {titre:'Conserver toutes les DPAE et contrats d\'extras pendant au moins 5 ans',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification DPAE avant chaque prise de poste d\'un extra',frequence:'À chaque embauche'},
        {titre:'Audit mensuel des présences vs déclarations',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Taux de déclaration DPAE avant prise de poste',seuil_alerte:100,unite:'%'},{label:'Contrôles URSSAF sans redressement',seuil_alerte:1,unite:'statut'}]},

    {id:'r_energie',nom:'Hausse brutale du coût de l\'énergie',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:2,
      description:'La restauration est très consommatrice d\'énergie (fours, frigos, climatisation). Une hausse non anticipée du gaz/électricité peut réduire la marge de 3 à 8 points.',
      actions:[
        {titre:'Comparer les offres d\'énergie et souscrire un contrat à prix fixe sur 1-2 ans',priorite:'urgent',delai:'Ce mois'},
        {titre:'Réaliser un audit énergétique et identifier les équipements les plus énergivores',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Remplacer progressivement les équipements anciens par des modèles à faible consommation',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi mensuel de la consommation électrique et gaz vs N-1',frequence:'Mensuel'},
        {titre:'Vérification de la date d\'échéance du contrat énergie',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Ratio énergie / CA HT',seuil_alerte:8,unite:'%'},{label:'Contrat énergie à prix fixe',seuil_alerte:1,unite:'contrat'}]},

    {id:'r_travaux_voirie',nom:'Travaux voirie / chantier prolongé devant l\'établissement',categorie:'Commercial',niveau:'eleve',probabilite:2,impact:4,velocite:2,
      description:'Des travaux de voirie prolongés peuvent réduire la fréquentation de 30 à 50% pendant plusieurs mois. Sans assurance perte d\'exploitation, aucune indemnisation n\'est possible.',
      actions:[
        {titre:'Vérifier que l\'assurance perte d\'exploitation couvre les travaux de voirie (souvent exclu)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Contacter la mairie pour être informé des chantiers planifiés à proximité',priorite:'normal',delai:'Ce mois'},
        {titre:'Préparer un plan de communication (réseaux sociaux, affichage) pour maintenir la fréquentation',priorite:'normal',delai:'En cas de chantier'}
      ],
      controles:[
        {titre:'Veille sur les projets de travaux communaux à proximité',frequence:'Trimestriel'},
        {titre:'Vérification couverture assurance perte d\'exploitation travaux',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Couverture perte d\'exploitation travaux',seuil_alerte:1,unite:'contrat'},{label:'Baisse fréquentation en période travaux',seuil_alerte:20,unite:'%'}]},

    {id:'r_fidelisation',nom:'Absence de programme de fidélisation',categorie:'Commercial',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Sans fidélisation, le restaurant dépend uniquement de l\'acquisition de nouveaux clients. Un client fidèle dépense en moyenne 3 fois plus et coûte 5 fois moins cher à retenir.',
      actions:[
        {titre:'Mettre en place un système simple de fidélisation (carte tampon, appli, QR code)',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer une liste email ou SMS de clients réguliers pour les informer des événements',priorite:'normal',delai:'Ce mois'},
        {titre:'Analyser la fréquence de retour des clients via le logiciel de caisse',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi du taux de clients fidèles vs nouveaux clients',frequence:'Mensuel'},
        {titre:'Envoi d\'une communication aux clients fidèles',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'% clients revenant dans les 30 jours',seuil_alerte:20,unite:'%'},{label:'Base email/SMS clients actifs',seuil_alerte:100,unite:'contacts'}]},

    {id:'r_carte_longue',nom:'Carte trop longue (food cost incontrôlable)',categorie:'Opérationnel',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Une carte trop longue augmente le food cost, les pertes, la complexité en cuisine et rallonge le temps de service. Au-delà de 25-30 plats, la maîtrise des coûts devient difficile.',
      actions:[
        {titre:'Analyser les ventes par plat et retirer les plats vendant moins de 5% du total',priorite:'urgent',delai:'Ce mois'},
        {titre:'Réduire la carte à 15-20 plats et renforcer la qualité sur chaque référence',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place une ardoise "suggestions du jour" pour valoriser les produits de saison',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Analyse des ventes par plat (PMix)',frequence:'Mensuel'},
        {titre:'Révision saisonnière de la carte',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Nombre de plats à la carte',seuil_alerte:30,unite:'plats'},{label:'Taux de plats vendant moins de 3% du total',seuil_alerte:20,unite:'%'}]},

    {id:'r_google_absent',nom:'Absence ou mauvaise gestion de la fiche Google',categorie:'Commercial',niveau:'eleve',probabilite:3,impact:3,velocite:2,
      description:'85% des recherches de restaurants passent par Google. Une fiche non optimisée, des photos absentes ou des horaires incorrects font perdre des clients avant même qu\'ils n\'appellent.',
      actions:[
        {titre:'Revendiquer et optimiser la fiche Google Business (photos, horaires, menu)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Répondre à tous les avis (positifs et négatifs) sous 48h',priorite:'urgent',delai:'En continu'},
        {titre:'Mettre en place un QR code sur table pour inciter les clients satisfaits à laisser un avis',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification et mise à jour des horaires et informations Google Business',frequence:'Mensuel'},
        {titre:'Suivi de la note Google et du nombre d\'avis',frequence:'Hebdomadaire'}
      ],
      indicateurs:[{label:'Note Google',seuil_alerte:4.0,unite:'/5'},{label:'Nombre d\'avis Google',seuil_alerte:50,unite:'avis'},{label:'Avis sans réponse',seuil_alerte:0,unite:'avis'}]},

    {id:'r_dependance_creneau',nom:'Dépendance à un seul créneau (déjeuner d\'affaires)',categorie:'Commercial',niveau:'eleve',probabilite:2,impact:3,velocite:2,
      description:'Un restaurant réalisant 70-80% de son CA sur le déjeuner d\'affaires en semaine est très exposé aux vacances scolaires, aux ponts et au télétravail qui vide les centres-villes.',
      actions:[
        {titre:'Analyser la répartition du CA par service (midi/soir) et par type de clientèle',priorite:'urgent',delai:'Ce mois'},
        {titre:'Développer une offre soir ou week-end pour diversifier la fréquentation',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Prospecter une clientèle locale (familles, particuliers) pour équilibrer la dépendance B2B',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi mensuel de la répartition CA par service et jour',frequence:'Mensuel'},
        {titre:'Analyse impact vacances / ponts sur le CA',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'% CA réalisé sur un seul créneau',seuil_alerte:70,unite:'%'},{label:'Variation CA en période de vacances scolaires',seuil_alerte:-30,unite:'%'}]},

    {id:'r_site_web',nom:'Absence de site web ou site non à jour',categorie:'Numérique',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Un restaurant sans site web ou avec un site non mis à jour perd en crédibilité. Les menus en ligne, la réservation en ligne et les photos sont devenus des standards attendus.',
      actions:[
        {titre:'Créer ou mettre à jour le site web avec menu, horaires, photos et lien de réservation',priorite:'urgent',delai:'Ce mois'},
        {titre:'Activer la réservation en ligne (The Fork, Guestonline ou lien Google)',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre à jour le menu en ligne à chaque changement de carte',priorite:'normal',delai:'En continu'}
      ],
      controles:[
        {titre:'Vérification que les horaires et menus en ligne sont à jour',frequence:'Mensuel'},
        {titre:'Contrôle du bon fonctionnement du lien de réservation',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Site web avec menu à jour',seuil_alerte:1,unite:'site'},{label:'Réservations en ligne activées',seuil_alerte:1,unite:'système'}]},

    {id:'r_stock_tampon',nom:'Absence de stock tampon minimum',categorie:'Opérationnel',niveau:'modere',probabilite:2,impact:3,velocite:3,
      description:'Sans stock de sécurité sur les produits non-frais (conserves, épices, conditionnements), une rupture de livraison peut empêcher le service et forcer à modifier la carte en urgence.',
      actions:[
        {titre:'Définir un seuil de réapprovisionnement minimum pour chaque produit non-frais',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer un inventaire simple (tableur) avec les niveaux de stock cibles',priorite:'normal',delai:'Ce mois'},
        {titre:'Identifier un fournisseur de dépannage local (metro, grossiste) pour les urgences',priorite:'normal',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Inventaire hebdomadaire des produits non-frais vs seuils minimum',frequence:'Hebdomadaire'},
        {titre:'Vérification DLC des produits stockés',frequence:'Hebdomadaire'}
      ],
      indicateurs:[{label:'Produits sous seuil minimum',seuil_alerte:0,unite:'références'},{label:'Ruptures de service liées aux stocks',seuil_alerte:0,unite:'/mois'}]},

    {id:'r_procedures_non_documentees',nom:'Absence de procédures documentées',categorie:'Opérationnel',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Sans procédures écrites (ouverture, fermeture, hygiène, encaissement), chaque absence est une source d\'erreur. L\'onboarding de nouveaux salariés prend 3x plus de temps.',
      actions:[
        {titre:'Rédiger les procédures d\'ouverture et de fermeture et les afficher en cuisine et salle',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer un livret d\'accueil avec les procédures clés pour les nouveaux salariés',priorite:'normal',delai:'Ce mois'},
        {titre:'Documenter les recettes signatures avec grammages et photos de dressage',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification que les procédures affichées sont suivies lors des ouvertures/fermetures',frequence:'Hebdomadaire'},
        {titre:'Mise à jour des procédures après tout changement organisationnel',frequence:'À chaque changement'}
      ],
      indicateurs:[{label:'Procédures clés documentées',seuil_alerte:5,unite:'documents'},{label:'Nouveaux salariés formés via livret d\'accueil',seuil_alerte:100,unite:'%'}]},

    {id:'r_impaye',nom:'Retards de paiement fournisseurs',categorie:'Financier',niveau:'eleve',probabilite:2,impact:2,velocite:2,
      description:'Des retards de paiement récurrents envers les fournisseurs ou charges sociales signalent une tension de trésorerie structurelle. Cela peut mener à une rupture d\'approvisionnement ou un redressement URSSAF.',
      actions:[
        {titre:'Contacter chaque fournisseur en retard pour négocier un échéancier de régularisation',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Prioriser le paiement des charges sociales pour éviter les majorations URSSAF',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Mettre en place un tableau de suivi des échéances fournisseurs hebdomadaire',priorite:'urgent',delai:'Ce mois'},
        {titre:'Négocier un délai de paiement à 30 jours avec les principaux fournisseurs',priorite:'normal',delai:'Ce mois'},
        {titre:'Ouvrir une ligne de crédit court terme pour couvrir les décalages de trésorerie',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place une prévision de trésorerie sur 8 semaines glissantes',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Revue hebdomadaire des échéances fournisseurs à venir',frequence:'Hebdomadaire'},
        {titre:'Vérification du solde de trésorerie vs charges à payer',frequence:'Hebdomadaire'},
        {titre:'Point mensuel sur les retards fournisseurs et leur régularisation',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Nombre de factures fournisseurs en retard',seuil_alerte:3,unite:'factures'},{label:'Jours de retard moyen paiement',seuil_alerte:15,unite:'jours'}]},

    {id:'r_masse_sal',nom:'Masse salariale excessive',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:1,
      description:'Au-delà de 40% du CA, la masse salariale rend le modèle économique non viable. C\'est souvent le signe d\'un problème de planification ou de sous-activité chronique.',
      actions:[
        {titre:'Calculer le ratio masse salariale / CA sur les 3 derniers mois',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Analyser les heures travaillées versus les heures nécessaires par service',priorite:'urgent',delai:'Ce mois'},
        {titre:'Optimiser les plannings en fonction des périodes d\'affluence réelles',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier les services sous-performants et ajuster les effectifs',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place des indicateurs de productivité par service (couverts / heure)',priorite:'normal',delai:'Ce mois'},
        {titre:'Vérifier que toutes les heures supplémentaires sont justifiées et nécessaires',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul du ratio masse salariale / CA du mois',frequence:'Mensuel'},
        {titre:'Revue des plannings vs fréquentation réelle',frequence:'Hebdomadaire'},
        {titre:'Comparaison du ratio vs objectif (< 38% du CA)',frequence:'Mensuel'}
      ],
      indicateurs:[{label:'Masse salariale en % du CA',seuil_alerte:40,unite:'%'},{label:'Heures supplémentaires non planifiées',seuil_alerte:10,unite:'h/semaine'}]},

    {id:'r_ca_baisse',nom:'Baisse du chiffre d\'affaires',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:2,
      description:'Une baisse continue du CA peut signaler un problème de réputation, d\'offre inadaptée, de concurrence renforcée ou de pricing mal calibré.',
      actions:[
        {titre:'Analyser les services et périodes en baisse (déjeuner, dîner, semaine, week-end)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Comparer la carte et les prix aux concurrents proches',priorite:'urgent',delai:'Ce mois'},
        {titre:'Renforcer la communication locale et la présence en ligne (Google, réseaux sociaux)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier si la baisse est liée à un facteur externe (travaux, nouveau concurrent)',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place une offre promotionnelle ciblée pour relancer la fréquentation',priorite:'normal',delai:'Ce mois'},
        {titre:'Analyser le panier moyen et identifier les leviers pour l\'augmenter',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi du CA hebdomadaire vs semaine N-1 et N-52',frequence:'Hebdomadaire'},
        {titre:'Analyse mensuelle du CA par service et par jour',frequence:'Mensuel'},
        {titre:'Comparaison trimestrielle du CA vs objectif annuel',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Variation CA vs N-1',seuil_alerte:-10,unite:'%'},{label:'Nombre de couverts / service',seuil_alerte:-15,unite:'% vs N-1'}]},

    {id:'r_saisonnalite',nom:'Risque de trésorerie saisonnière',categorie:'Financier',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Une forte saisonnalité crée des périodes creuses prévisibles mais souvent mal anticipées côté trésorerie, générant un stress financier récurrent.',
      actions:[
        {titre:'Constituer une réserve de trésorerie avant chaque période creuse',priorite:'urgent',delai:'Ce mois'},
        {titre:'Négocier des délais de paiement élargis avec les fournisseurs avant la basse saison',priorite:'urgent',delai:'Ce mois'},
        {titre:'Développer une offre complémentaire hors saison (traiteur, événements, click and collect)',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Planifier les congés de l\'équipe sur les périodes creuses pour réduire les charges',priorite:'normal',delai:'Ce mois'},
        {titre:'Établir un budget prévisionnel mensuel intégrant la saisonnalité',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Comparaison trésorerie disponible vs charges fixes du mois suivant',frequence:'Mensuel'},
        {titre:'Suivi du CA vs prévisionnel saisonnier',frequence:'Mensuel'},
        {titre:'Revue annuelle du prévisionnel de trésorerie par saison',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Trésorerie disponible en début de période creuse',seuil_alerte:2,unite:'mois de charges'},{label:'Écart CA réel vs prévisionnel',seuil_alerte:15,unite:'%'}]},

    {id:'r_dettes',nom:'Endettement élevé en contexte fragile',categorie:'Financier',niveau:'critique',probabilite:2,impact:3,velocite:1,
      description:'Un emprunt lourd combiné à un CA en baisse ou stagnant crée un risque de défaut de paiement à court terme. C\'est l\'une des premières causes de liquidation en restauration.',
      actions:[
        {titre:'Rencontrer votre banquier pour renégocier les échéances ou demander un différé',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Contacter un conseiller CCI ou un expert-comptable pour étudier les options de restructuration',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier les dépenses non essentielles à suspendre immédiatement',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Vérifier l\'éligibilité au dispositif de médiation du crédit (Banque de France)',priorite:'normal',delai:'Ce mois'},
        {titre:'Établir un plan de remboursement réaliste sur 24 mois avec l\'expert-comptable',priorite:'normal',delai:'Ce mois'},
        {titre:'Analyser les actifs mobilisables (matériel, fonds de commerce) en cas de besoin',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Suivi du ratio annuités / excédent brut d\'exploitation',frequence:'Mensuel'},
        {titre:'Vérification que les échéances de prêt sont couvertes par la trésorerie',frequence:'Mensuel'},
        {titre:'Point annuel avec l\'expert-comptable sur la structure financière',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Ratio dettes / CA',seuil_alerte:50,unite:'%'},{label:'Mois de CA pour rembourser la dette',seuil_alerte:6,unite:'mois'}]},

    {id:'r_ticket_moyen_fin',nom:'Ticket moyen insuffisant au regard des charges',categorie:'Financier',niveau:'eleve',probabilite:2,impact:2,velocite:1,
      description:'Un ticket moyen trop bas par rapport aux charges fixes rend l\'établissement non viable même à pleine capacité.',
      actions:[
        {titre:'Calculer le ticket moyen minimum nécessaire à la rentabilité (charges fixes / couverts)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Revoir le positionnement tarifaire de la carte sur les plats à faible marge',priorite:'urgent',delai:'Ce mois'},
        {titre:'Développer des offres qui augmentent le panier moyen (suggestions, formules, boissons)',priorite:'normal',delai:'Ce mois'},
        {titre:'Former l\'équipe de salle à la vente additionnelle (suggestions, accords mets-vins)',priorite:'normal',delai:'Ce mois'},
        {titre:'Analyser les plats les plus commandés et leur contribution à la marge',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul du ticket moyen par service',frequence:'Hebdomadaire'},
        {titre:'Comparaison ticket moyen vs seuil de rentabilité',frequence:'Mensuel'},
        {titre:'Revue trimestrielle de la contribution marge par plat',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Ticket moyen',seuil_alerte:0,unite:'€ (vs seuil calculé)'},{label:'% plats vendus avec accompagnement ou boisson',seuil_alerte:40,unite:'%'}]},

    {id:'r_allergenes',nom:'Non-conformité allergènes',categorie:'Sanitaire',niveau:'critique',probabilite:2,impact:3,velocite:2,
      description:'L\'absence de fiches allergènes expose au risque d\'intoxication grave et à des poursuites pénales. La DGCCRF contrôle régulièrement et les sanctions sont lourdes.',
      actions:[
        {titre:'Créer une fiche allergène détaillée pour chaque plat de la carte',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Former l\'équipe en salle à répondre aux questions allergènes des clients',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre à jour les fiches à chaque modification de recette ou changement fournisseur',priorite:'urgent',delai:'Ce mois'},
        {titre:'Afficher les allergènes sur la carte ou mettre à disposition un document dédié',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Vérifier les fiches techniques fournisseurs pour chaque ingrédient utilisé',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer une procédure de gestion des demandes allergènes (salle → cuisine)',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification que les fiches allergènes sont à jour pour chaque plat',frequence:'À chaque changement de carte'},
        {titre:'Test de connaissance allergènes des nouveaux salariés en salle',frequence:'À chaque embauche'},
        {titre:'Audit complet des fiches allergènes et de l\'affichage',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Plats sans fiche allergène à jour',seuil_alerte:0,unite:'plats'},{label:'Personnel de salle formé allergènes',seuil_alerte:100,unite:'%'}]},

    {id:'r_fournisseur',nom:'Dépendance à un fournisseur unique',categorie:'Opérationnel',niveau:'eleve',probabilite:2,impact:3,velocite:2,
      description:'La défaillance d\'un fournisseur unique peut priver le restaurant de ses produits phares en 24 à 48 heures, rendant impossible le service d\'une partie de la carte.',
      actions:[
        {titre:'Référencer au moins un fournisseur alternatif par produit ou famille de produits clés',priorite:'urgent',delai:'Ce mois'},
        {titre:'Constituer un stock de sécurité de 3 jours sur les produits critiques non périssables',priorite:'urgent',delai:'Ce mois'},
        {titre:'Diversifier les circuits d\'approvisionnement (circuit court, grossiste, marché de gros)',priorite:'normal',delai:'Ce mois'},
        {titre:'Cartographier tous les fournisseurs par criticité et volume d\'achat',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Négocier une clause de livraison de secours dans les contrats fournisseurs principaux',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification du stock de sécurité produits critiques',frequence:'Hebdomadaire'},
        {titre:'Revue des fournisseurs actifs par famille de produits',frequence:'Mensuel'},
        {titre:'Évaluation annuelle des fournisseurs (fiabilité, délais, qualité)',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Produits sans fournisseur alternatif',seuil_alerte:0,unite:'références'},{label:'Jours de stock de sécurité produits clés',seuil_alerte:3,unite:'jours'}]},

    {id:'r_panne',nom:'Panne d\'équipement cuisine ou froid',categorie:'Opérationnel',niveau:'eleve',probabilite:2,impact:3,velocite:3,
      description:'Une panne de chambre froide peut entraîner la perte de l\'intégralité du stock alimentaire (2 000 à 8 000 euros) et une fermeture d\'urgence. Sans contrat, l\'attente dépasse souvent 72 heures.',
      actions:[
        {titre:'Souscrire un contrat de maintenance préventive avec intervention garantie sous 4 heures',priorite:'urgent',delai:'Ce mois'},
        {titre:'Installer une alarme température avec alerte SMS sur les chambres froides',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier que l\'assurance couvre la perte de marchandises suite à une panne',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier un prestataire froid de secours disponible 7j/7 et week-end',priorite:'normal',delai:'Ce mois'},
        {titre:'Établir une procédure d\'urgence (qui appelle, quelle alternative de stockage)',priorite:'normal',delai:'Ce mois'},
        {titre:'Planifier une maintenance préventive annuelle de tous les équipements cuisine',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Relevé quotidien des températures chambres froides (matin + soir)',frequence:'Quotidien'},
        {titre:'Vérification du bon fonctionnement de l\'alarme température',frequence:'Mensuel'},
        {titre:'Contrôle de la validité du contrat de maintenance équipements',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Jours depuis dernière maintenance préventive',seuil_alerte:365,unite:'jours'},{label:'Alarmes température déclenchées',seuil_alerte:0,unite:'/mois'}]},

    {id:'r_chef',nom:'Dépendance au chef cuisinier',categorie:'Ressources Humaines',niveau:'critique',probabilite:2,impact:3,velocite:2,
      description:'La dépendance au chef cuisinier expose le restaurant à un risque opérationnel majeur en cas d\'absence : fermeture partielle ou totale, dégradation de la qualité, perte de clientèle.',
      actions:[
        {titre:'Former un second de cuisine à toutes les recettes signatures',priorite:'urgent',delai:'Ce mois'},
        {titre:'Rédiger les fiches techniques détaillées de chaque plat (grammages, photos, procédures)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Identifier un chef intérimaire ou un réseau de remplacement (intérim spécialisé CHR)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Organiser des sessions régulières de transmission des recettes à l\'équipe cuisine',priorite:'normal',delai:'Ce mois'},
        {titre:'Inclure une clause de préavis renforcé dans le contrat du chef',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification que le second est capable d\'assurer seul le service',frequence:'Trimestriel'},
        {titre:'Mise à jour des fiches techniques après tout changement de carte',frequence:'À chaque changement de carte'},
        {titre:'Contact annuel avec une agence d\'intérim CHR pour maintenir le réseau',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Plats sans fiche technique complète',seuil_alerte:0,unite:'plats'},{label:'Nombre de secondes de cuisine formés',seuil_alerte:1,unite:'personnes'}]},

    {id:'r_formation',nom:'Absence de formation de l\'équipe',categorie:'Ressources Humaines',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Une équipe non formée aux règles d\'hygiène, aux allergènes et aux procédures internes multiplie les risques sanitaires, les erreurs en service et les non-conformités lors des contrôles.',
      actions:[
        {titre:'Planifier une formation hygiène HACCP pour l\'ensemble de l\'équipe cuisine',priorite:'urgent',delai:'Ce mois'},
        {titre:'Organiser une session sur la gestion des allergènes pour le personnel en salle',priorite:'urgent',delai:'Ce mois'},
        {titre:'Consulter votre OPCO pour financer les formations (prise en charge possible à 100%)',priorite:'normal',delai:'Ce mois'},
        {titre:'Créer un livret d\'accueil avec les procédures et règles essentielles',priorite:'normal',delai:'Ce mois'},
        {titre:'Mettre en place un plan de formation annuel pour toute l\'équipe',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification des attestations de formation hygiène de chaque salarié cuisine',frequence:'Annuel'},
        {titre:'Rappel des règles allergènes lors des briefings avant service',frequence:'Mensuel'},
        {titre:'Évaluation des connaissances lors de l\'intégration de chaque nouveau salarié',frequence:'À chaque embauche'}
      ],
      indicateurs:[{label:'% salariés avec formation hygiène à jour',seuil_alerte:100,unite:'%'},{label:'Mois depuis dernière formation équipe',seuil_alerte:12,unite:'mois'}]},

    {id:'r_livraison',nom:'Dépendance aux plateformes de livraison',categorie:'Commercial',niveau:'modere',probabilite:3,impact:2,velocite:2,
      description:'Une commission de 25 à 30% par commande peut rendre ces ventes structurellement non rentables. Au-delà de 30% du CA, la dépendance fragilise le modèle économique.',
      actions:[
        {titre:'Calculer la marge réelle par commande plateforme (CA - commission - emballage - coût matière)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Développer un canal de commande directe (site web, WhatsApp Business, QR code)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre en place une offre fidélité pour convertir des clients plateformes en commandes directes',priorite:'normal',delai:'Ce mois'},
        {titre:'Négocier un accord volume contre commission réduite avec les plateformes',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Limiter progressivement la part plateforme sous 20% du CA total',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Calcul mensuel du CA et de la marge par canal (direct vs plateformes)',frequence:'Mensuel'},
        {titre:'Suivi du % CA plateformes vs CA total',frequence:'Mensuel'},
        {titre:'Revue trimestrielle des conditions tarifaires plateformes',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'% CA plateformes livraison / CA total',seuil_alerte:30,unite:'%'},{label:'Marge nette par commande plateforme',seuil_alerte:10,unite:'%'}]},

    {id:'r_affichage',nom:'Défaut d\'affichage réglementaire',categorie:'Juridique',niveau:'eleve',probabilite:3,impact:2,velocite:1,
      description:'Le défaut d\'affichage obligatoire est l\'infraction la plus courante en restauration. Prix, allergènes, origine des viandes, licence, interdiction de fumer — chaque manquement est une infraction susceptible d\'amendes.',
      actions:[
        {titre:'Établir une checklist complète des affichages obligatoires et vérifier chacun',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Mettre à jour ou imprimer tous les affichages manquants ou périmés',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Vérifier la conformité des menus (prix TTC, allergènes, origine des viandes)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former un responsable au suivi réglementaire annuel des affichages',priorite:'normal',delai:'Ce mois'},
        {titre:'Planifier une revue complète des affichages à chaque changement de carte',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification visuelle de tous les affichages obligatoires',frequence:'Mensuel'},
        {titre:'Mise à jour des affichages lors de chaque changement de carte ou de tarifs',frequence:'À chaque changement de carte'},
        {titre:'Audit complet conformité affichage (grille DDPP)',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Affichages obligatoires manquants',seuil_alerte:0,unite:'éléments'},{label:'Jours depuis dernière vérification affichage',seuil_alerte:30,unite:'jours'}]},

    {id:'r_licence',nom:'Licence ou autorisation non conforme',categorie:'Juridique',niveau:'critique',probabilite:2,impact:3,velocite:1,
      description:'Exploiter un restaurant sans licence conforme ou avec une autorisation périmée est une infraction pénale pouvant entraîner la fermeture immédiate et une amende jusqu\'à 7 500 €.',
      actions:[
        {titre:'Vérifier la validité de votre licence (II, III ou IV selon les boissons servies)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Contrôler les autorisations d\'occupation et d\'exploitation en mairie',priorite:'urgent',delai:'Ce mois'},
        {titre:'Consulter votre mairie ou un avocat pour tout doute sur la conformité',priorite:'urgent',delai:'Ce mois'},
        {titre:'S\'assurer que la licence est bien attachée au local et non à la personne physique',priorite:'normal',delai:'Ce mois'},
        {titre:'Conserver tous les justificatifs de licence dans le dossier administratif',priorite:'planif',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification annuelle de la validité de toutes les licences et autorisations',frequence:'Annuel'},
        {titre:'Contrôle de la présence des licences affichées en salle',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Date expiration licence principale',seuil_alerte:60,unite:'jours avant'},{label:'Autorisations à renouveler cette année',seuil_alerte:0,unite:'autorisations'}]},

    {id:'r_erp',nom:'Autorisation ERP non conforme',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,
      description:'Des travaux non déclarés ou une modification d\'agencement sans mise à jour de l\'autorisation ERP peuvent entraîner une fermeture administrative immédiate lors d\'un contrôle.',
      actions:[
        {titre:'Contacter la mairie pour vérifier et régulariser l\'autorisation ERP si nécessaire',priorite:'urgent',delai:'Ce mois'},
        {titre:'Faire réaliser une visite de conformité par la commission de sécurité',priorite:'urgent',delai:'Ce mois'},
        {titre:'Vérifier que la capacité d\'accueil déclarée correspond à la réalité',priorite:'normal',delai:'Ce mois'},
        {titre:'Ne réaliser aucuns travaux futurs sans vérifier l\'impact sur l\'autorisation ERP',priorite:'normal',delai:'Continu'},
        {titre:'Conserver le registre de sécurité à jour et accessible lors des contrôles',priorite:'planif',delai:'Ce mois'}
      ],
      controles:[
        {titre:'Vérification que le registre de sécurité ERP est à jour',frequence:'Trimestriel'},
        {titre:'Contrôle de la conformité après tout aménagement ou travaux',frequence:'À chaque travaux'},
        {titre:'Visite préventive par la commission de sécurité',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Date dernière visite commission sécurité',seuil_alerte:365,unite:'jours'},{label:'Non-conformités identifiées lors de la dernière visite',seuil_alerte:0,unite:'points'}]},

    {id:'r_caisse',nom:'Données et caisse non sécurisées',categorie:'Numérique',niveau:'modere',probabilite:2,impact:2,velocite:2,
      description:'Un système de caisse non sauvegardé peut faire perdre plusieurs mois de données comptables. La collecte de données clients sans sécurité expose à une amende CNIL pouvant atteindre 4% du CA.',
      actions:[
        {titre:'Activer les sauvegardes automatiques quotidiennes sur le logiciel de caisse',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Vérifier que le logiciel de caisse est certifié NF525 (obligation légale depuis 2018)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Mettre à jour régulièrement les logiciels pour corriger les failles de sécurité',priorite:'urgent',delai:'Ce mois'},
        {titre:'Sécuriser l\'accès au back-office caisse par mot de passe individuel',priorite:'normal',delai:'Ce mois'},
        {titre:'Tester la restauration des données depuis la sauvegarde',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification que les sauvegardes automatiques ont bien tourné',frequence:'Hebdomadaire'},
        {titre:'Mise à jour des logiciels de caisse et de sécurité',frequence:'Mensuel'},
        {titre:'Test de restauration des données depuis la sauvegarde',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Jours depuis dernière sauvegarde vérifiée',seuil_alerte:7,unite:'jours'},{label:'Mises à jour logiciel en attente',seuil_alerte:0,unite:'mises à jour'}]},

    {id:'r_rgpd',nom:'Non-conformité RGPD',categorie:'Numérique',niveau:'modere',probabilite:2,impact:2,velocite:1,
      description:'Dès que vous collectez des emails, données de réservation ou informations de fidélité, le RGPD s\'applique. Une violation peut entraîner une amende CNIL jusqu\'à 4% du CA annuel.',
      actions:[
        {titre:'Ajouter une mention d\'information RGPD sur tous les formulaires de collecte',priorite:'urgent',delai:'Ce mois'},
        {titre:'Créer ou mettre à jour une politique de confidentialité accessible sur votre site',priorite:'urgent',delai:'Ce mois'},
        {titre:'Obtenir le consentement explicite pour toute communication commerciale',priorite:'urgent',delai:'Ce mois'},
        {titre:'Lister toutes les données collectées et leur finalité (registre des traitements)',priorite:'normal',delai:'Ce trimestre'},
        {titre:'Limiter la durée de conservation des données clients à ce qui est nécessaire',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Vérification de la présence des mentions RGPD sur les formulaires',frequence:'Trimestriel'},
        {titre:'Mise à jour du registre des traitements de données',frequence:'Annuel'},
        {titre:'Contrôle des consentements en base de données marketing',frequence:'Annuel'}
      ],
      indicateurs:[{label:'Formulaires sans mention RGPD',seuil_alerte:0,unite:'formulaires'},{label:'Mois depuis dernière mise à jour politique confidentialité',seuil_alerte:12,unite:'mois'}]},

    {id:'r_continuite',nom:'Absence de plan de continuité informatique',categorie:'Numérique',niveau:'modere',probabilite:2,impact:2,velocite:2,
      description:'La panne d\'un système de caisse ou de réservation en plein service peut paralyser l\'établissement et générer des pertes directes et une mauvaise expérience client.',
      actions:[
        {titre:'Préparer une procédure de prise de commande manuelle (carnet, stylo, calculatrice)',priorite:'urgent',delai:'Cette semaine'},
        {titre:'Garder un accès aux données de réservation sur un support hors connexion (impression hebdo)',priorite:'urgent',delai:'Ce mois'},
        {titre:'Former l\'équipe à la procédure de secours en cas de panne informatique',priorite:'urgent',delai:'Ce mois'},
        {titre:'Avoir un terminal de paiement de secours (lecteur mobile sans connexion caisse)',priorite:'normal',delai:'Ce mois'},
        {titre:'Souscrire un contrat de support avec intervention sous 4h pour la caisse',priorite:'planif',delai:'Ce trimestre'}
      ],
      controles:[
        {titre:'Test mensuel de la procédure de prise de commande manuelle',frequence:'Mensuel'},
        {titre:'Vérification que le terminal de secours est chargé et opérationnel',frequence:'Hebdomadaire'},
        {titre:'Exercice de simulation panne informatique avec l\'équipe',frequence:'Trimestriel'}
      ],
      indicateurs:[{label:'Procédure de secours documentée et affichée',seuil_alerte:1,unite:'document'},{label:'Membres de l\'équipe formés à la procédure de secours',seuil_alerte:100,unite:'%'}]}
  ],
  commerce:[
    {id:'c_rupture_stock',nom:'Rupture de stock sur produit phare',categorie:'Opérationnel',niveau:'critique',probabilite:3,impact:4,velocite:3,description:'Rupture d\'un produit à fort volume génère perte directe de CA et détourne le client vers un concurrent. Sur 1 semaine : 5 à 15% du CA mensuel.',actions:[{titre:'Identifier les 5 produits "vaches à lait" et définir un seuil de réapprovisionnement automatique',priorite:'urgent',delai:'Cette semaine'},{titre:'Tableau de bord stock hebdomadaire (Excel ou logiciel simple)',priorite:'normal',delai:'Ce mois'},{titre:'Négocier avec les fournisseurs une livraison garantie sous 48h',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Jours de stock produits phares',seuil_alerte:7,unite:'jours'},{label:'Taux de rupture mensuel',seuil_alerte:2,unite:'%'},{label:'Délai réapprovisionnement fournisseur',seuil_alerte:5,unite:'jours'}]},
    {id:'c_concurrent_online',nom:'Concurrence prix des pure players en ligne',categorie:'Commercial',niveau:'eleve',probabilite:4,impact:3,velocite:2,description:'Amazon/Cdiscount cassent les prix sur vos références. Une différence de 10% suffit à perdre la vente. 72% des achats locaux commencent par une recherche en ligne.',actions:[{titre:'Analyser les 20 références phares vs prix Amazon chaque mois',priorite:'urgent',delai:'Ce mois'},{titre:'Valoriser les avantages non-online : conseil, retour immédiat, relation client',priorite:'normal',delai:'Ce mois'},{titre:'Développer des exclusivités locales/artisanales non disponibles en ligne',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Écart prix moyen vs concurrent online',seuil_alerte:10,unite:'%'},{label:'Part ventes sur produits exclusifs',seuil_alerte:20,unite:'%'},{label:'Taux de conversion visiteurs boutique',seuil_alerte:25,unite:'%'}]},
    {id:'c_tresorerie_stock',nom:'Immobilisation excessive en stock',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:1,description:'Un stock mal géré immobilise du capital inutilement. Stock > 3 mois de CA = signal d\'alarme pour la trésorerie disponible.',actions:[{titre:'Calculer le ratio stock/CA et identifier les références > 90 jours de rotation',priorite:'urgent',delai:'Ce mois'},{titre:'Opération de déstockage (promo, lot, B2B) sur les références à faible rotation',priorite:'normal',delai:'Ce mois'},{titre:'Méthode ABC pour prioriser les commandes (20% des ref = 80% du CA)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Rotation moyenne du stock',seuil_alerte:60,unite:'jours'},{label:'Part du stock dans le bilan',seuil_alerte:40,unite:'%'},{label:'Taux de démarque mensuel',seuil_alerte:3,unite:'%'}]},
    {id:'c_loyer_zone',nom:'Loyer élevé / baisse de trafic piétonnier',categorie:'Commercial',niveau:'eleve',probabilite:3,impact:3,velocite:1,description:'Zone commerciale en déclin, chantier prolongé ou concurrent en face peuvent réduire le flux de 20 à 40%. Loyer > 12% du CA = structure déficitaire.',actions:[{titre:'Mesurer le trafic piétonnier réel (compteur de porte, Google Maps)',priorite:'normal',delai:'Ce mois'},{titre:'Renégocier le loyer avec le bailleur (données chiffrées à l\'appui)',priorite:'normal',delai:'Ce trimestre'},{titre:'Développer un canal complémentaire (boutique en ligne, click & collect)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Loyer en % du CA',seuil_alerte:12,unite:'%'},{label:'Trafic piétonnier vs N-1',seuil_alerte:-15,unite:'%'},{label:'CA par m²',seuil_alerte:3000,unite:'€/an/m²'}]},
    {id:'c_dependance_fournisseur',nom:'Dépendance à un fournisseur unique / grossiste',categorie:'Approvisionnement',niveau:'eleve',probabilite:2,impact:4,velocite:3,description:'Fournisseur > 50% des approvisionnements : sa défaillance paralyse la boutique. Ce risque est souvent sous-estimé car la relation est ancienne.',actions:[{titre:'Cartographier tous les fournisseurs par volume d\'achat',priorite:'urgent',delai:'Ce mois'},{titre:'Référencer un fournisseur alternatif pour les 5 familles importantes',priorite:'normal',delai:'Ce trimestre'},{titre:'Vérifier la santé financière des fournisseurs clés (Infogreffe) une fois par an',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'% achats chez le 1er fournisseur',seuil_alerte:50,unite:'%'},{label:'Nb fournisseurs référencés par gamme',seuil_alerte:2,unite:'fournisseurs'},{label:'Délai livraison moyen fournisseur principal',seuil_alerte:7,unite:'jours'}]},
    {id:'c_impaye_b2b',nom:'Impayés clients B2B',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:1,description:'Pour les commerces avec activité B2B, un client représentant 20% du CA qui règle à 90 jours ou fait défaut crée un trou de trésorerie immédiat.',actions:[{titre:'Mettre en place des CGV avec pénalités de retard légales',priorite:'urgent',delai:'Ce mois'},{titre:'Relancer systématiquement à J+7 après échéance (email auto + appel J+15)',priorite:'normal',delai:'Ce mois'},{titre:'Souscrire une assurance-crédit pour les clients > 5 000€ d\'encours',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Délai moyen paiement clients B2B',seuil_alerte:45,unite:'jours'},{label:'Encours impayés > 60 jours',seuil_alerte:5000,unite:'€'},{label:'Taux de créances irrécouvrables',seuil_alerte:1,unite:'%'}]},
    {id:'c_ecommerce',nom:'Absence ou faiblesse du canal e-commerce',categorie:'Commercial',niveau:'modere',probabilite:4,impact:3,velocite:1,description:'Sans présence en ligne, 72% des achats locaux qui commencent par une recherche Google passent à côté de vous.',actions:[{titre:'Mettre à jour le profil Google Business (horaires, photos, produits)',priorite:'urgent',delai:'Cette semaine'},{titre:'Ouvrir un module click & collect ou boutique en ligne (Wix, Shopify)',priorite:'normal',delai:'Ce trimestre'},{titre:'Activer Instagram Shopping pour les produits visuels',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Note Google Business',seuil_alerte:4.0,unite:'/5'},{label:'% CA canal en ligne ou click & collect',seuil_alerte:10,unite:'%'},{label:'Nouvelles photos publiées sur Google',seuil_alerte:1,unite:'/mois'}]}
  ],
  artisanat:[
    {id:'a_garantie_decennale',nom:'Mise en jeu de la garantie décennale',categorie:'Juridique',niveau:'critique',probabilite:2,impact:4,velocite:1,description:'Un sinistre engageant cette garantie sans assurance valide peut entraîner des dommages de plusieurs dizaines de milliers d\'euros et mettre fin à l\'activité.',actions:[{titre:'Vérifier que l\'assurance décennale couvre toutes les activités exercées (codes NACE exacts)',priorite:'urgent',delai:'Ce mois'},{titre:'Conserver une copie de chaque attestation d\'assurance pour tous les chantiers',priorite:'urgent',delai:'Ce mois'},{titre:'Remettre systématiquement l\'attestation au client avant chaque chantier (obligation légale)',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Date expiration assurance décennale',seuil_alerte:60,unite:'jours avant'},{label:'Attestation remise pour chaque chantier',seuil_alerte:100,unite:'%'},{label:'Réclamations / litiges clients en cours',seuil_alerte:0,unite:'litiges'}]},
    {id:'a_impaye_chantier',nom:'Impayé / client mauvais payeur en fin de chantier',categorie:'Financier',niveau:'critique',probabilite:3,impact:4,velocite:1,description:'Le solde de chantier (30-40% du total) est le plus exposé. Un client qui conteste à la réception peut bloquer le paiement. Recouvrement judiciaire : 12-24 mois.',actions:[{titre:'Exiger un acompte de 30% à la commande et 30% à mi-chantier',priorite:'urgent',delai:'Ce mois'},{titre:'Faire signer un PV de réception des travaux daté et signé par le client',priorite:'urgent',delai:'Ce mois'},{titre:'Inclure une clause de réserve de propriété dans les CGV',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Chantiers avec acompte 30% à la commande',seuil_alerte:100,unite:'%'},{label:'Délai moyen encaissement solde chantier',seuil_alerte:30,unite:'jours'},{label:'Encours impayés / CA',seuil_alerte:10,unite:'%'}]},
    {id:'a_compagnon_cle',nom:'Absence du compagnon clé / artisan indispensable',categorie:'Ressources Humaines',niveau:'critique',probabilite:3,impact:4,velocite:3,description:'L\'absence de l\'artisan principal arrête tous les chantiers. Des pénalités de retard contractuelles (0,5-1%/semaine de marché) peuvent s\'appliquer.',actions:[{titre:'Identifier un partenaire ou artisan indépendant capable de prendre le relais',priorite:'urgent',delai:'Ce mois'},{titre:'Inclure une clause de force majeure dans tous les devis/contrats',priorite:'normal',delai:'Ce mois'},{titre:'Souscrire une prévoyance artisan couvrant l\'incapacité dès le 1er jour',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Partenaire de remplacement identifié',seuil_alerte:1,unite:'contact'},{label:'Couverture prévoyance incapacité',seuil_alerte:1,unite:'contrat actif'},{label:'Chantiers avec pénalité de retard dans les contrats',seuil_alerte:0,unite:'%'}]},
    {id:'a_accident_chantier',nom:'Accident sur chantier (salarié ou tiers)',categorie:'Sécurité',niveau:'critique',probabilite:2,impact:4,velocite:3,description:'Le BTP a le plus fort taux d\'accidents en France. Un accident grave engage la responsabilité pénale du dirigeant si les règles de sécurité n\'étaient pas respectées.',actions:[{titre:'Vérifier que chaque chantier dispose d\'un plan de prévention et que les EPI sont portés',priorite:'urgent',delai:'Cette semaine'},{titre:'Former l\'équipe aux règles de sécurité chantier — recyclage annuel',priorite:'urgent',delai:'Ce mois'},{titre:'Vérifier que la RC Pro couvre les dommages aux tiers (minimum 2M€)',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Formations sécurité à jour',seuil_alerte:100,unite:'%'},{label:'EPI disponibles sur chaque chantier',seuil_alerte:100,unite:'%'},{label:'Accidents du travail sur 12 mois',seuil_alerte:0,unite:'accidents'}]},
    {id:'a_qualification_rge',nom:'Perte ou expiration de la qualification RGE',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,description:'Sans RGE, l\'artisan est exclu des travaux MaPrimeRénov\' / CEE, soit 40-60% des chantiers de rénovation.',actions:[{titre:'Vérifier la date d\'expiration RGE et déclencher le renouvellement 6 mois avant',priorite:'urgent',delai:'Ce mois'},{titre:'S\'assurer que les formations continues sont remplies (minimum 2j / 4 ans)',priorite:'normal',delai:'Ce trimestre'},{titre:'Afficher clairement la qualification RGE sur les devis et véhicules',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Mois avant expiration qualification RGE',seuil_alerte:6,unite:'mois'},{label:'Formations continues réalisées',seuil_alerte:100,unite:'%'},{label:'% CA de chantiers nécessitant la RGE',seuil_alerte:30,unite:'%'}]},
    {id:'a_materiel_vol',nom:'Panne ou vol d\'équipement critique',categorie:'Opérationnel',niveau:'eleve',probabilite:3,impact:3,velocite:3,description:'Panne ou vol d\'un véhicule utilitaire/matériel immobilise le chantier. Coût de remplacement ou location d\'urgence > 3 000€. Vols +30% en 5 ans.',actions:[{titre:'Lister tous les équipements et vérifier la couverture assurance (vol + dommages)',priorite:'urgent',delai:'Ce mois'},{titre:'Installer des balises GPS sur les véhicules et gros équipements (100-200€/an)',priorite:'normal',delai:'Ce mois'},{titre:'Identifier une société de location d\'urgence à moins de 30 km',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Équipements avec couverture assurance vol',seuil_alerte:100,unite:'%'},{label:'Véhicules avec balise GPS',seuil_alerte:100,unite:'%'},{label:'Dernière vérification état matériel',seuil_alerte:90,unite:'jours'}]},
    {id:'a_delai_materiaux',nom:'Délais de livraison matériaux / rupture négoce',categorie:'Approvisionnement',niveau:'modere',probabilite:3,impact:3,velocite:2,description:'Pénuries de matériaux (bois, acier, cuivre) peuvent décaler un chantier de plusieurs semaines et déclencher des pénalités contractuelles.',actions:[{titre:'Commander les matériaux critiques 4 à 6 semaines à l\'avance pour les gros chantiers',priorite:'urgent',delai:'Prochain chantier'},{titre:'Intégrer une clause de révision de prix matériaux dans chaque devis (valable 30 jours)',priorite:'normal',delai:'Ce mois'},{titre:'Diversifier les négoces fournisseurs (au moins 2 par famille de matériaux)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Délai livraison moyen matériaux vs N-1',seuil_alerte:20,unite:'% allongement'},{label:'Chantiers décalés pour rupture matériaux',seuil_alerte:1,unite:'/trimestre'},{label:'Stock sécurité matériaux de base',seuil_alerte:2,unite:'semaines'}]}
  ],
  services:[
    {id:'s_dependance_client',nom:'Dépendance excessive à un client unique',categorie:'Commercial',niveau:'critique',probabilite:3,impact:4,velocite:3,description:'Client > 30% du CA : sa perte menace directement la survie. Aggravé par les contrats courts ou les relations basées sur le relationnel d\'une personne.',actions:[{titre:'Fixer un objectif : aucun client > 25% du CA dans 18 mois',priorite:'urgent',delai:'Ce mois'},{titre:'Lancer une action commerciale sur un nouveau segment (10 prospects qualifiés/mois)',priorite:'urgent',delai:'Ce mois'},{titre:'Proposer des services additionnels pour multiplier les points de contact',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'% CA du client principal',seuil_alerte:30,unite:'%'},{label:'Nb de clients actifs',seuil_alerte:5,unite:'clients'},{label:'Nouveaux contrats signés / trimestre',seuil_alerte:2,unite:'contrats'}]},
    {id:'s_impaye',nom:'Impayés et retards de paiement clients',categorie:'Financier',niveau:'critique',probabilite:3,impact:4,velocite:1,description:'Délais de paiement longs (60-90 jours) + impayés récurrents. Un impayé représentant 2-3 mois de travail peut déstabiliser toute la trésorerie.',actions:[{titre:'Acompte de 30 à 50% à la signature de tout nouveau contrat',priorite:'urgent',delai:'Ce mois'},{titre:'Automatiser les relances : J+7 email, J+15 appel, J+30 mise en demeure',priorite:'normal',delai:'Ce mois'},{titre:'Utiliser l\'affacturage pour les grosses factures à long délai (coût : 1-3%)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'DSO (délai encaissement moyen)',seuil_alerte:45,unite:'jours'},{label:'Encours impayés > 60 jours',seuil_alerte:5000,unite:'€'},{label:'Taux recouvrement sur factures',seuil_alerte:98,unite:'%'}]},
    {id:'s_depart_expert',nom:'Départ d\'un expert ou collaborateur clé',categorie:'Ressources Humaines',niveau:'critique',probabilite:3,impact:4,velocite:2,description:'Le départ d\'un expert qui emmène ses clients peut amputer le CA de 15 à 30% immédiatement. La clause de non-concurrence doit être correctement rédigée.',actions:[{titre:'Auditer les contrats : clause de non-concurrence valide (périmètre, durée, compensation)',priorite:'urgent',delai:'Ce mois'},{titre:'Documenter les méthodes et processus clés (wiki interne)',priorite:'normal',delai:'Ce mois'},{titre:'Mettre en place un plan de rétention (participation, intéressement)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Contrats avec clause non-concurrence valide',seuil_alerte:100,unite:'%'},{label:'Méthodes et processus documentés',seuil_alerte:80,unite:'%'},{label:'NPS interne équipe',seuil_alerte:7,unite:'/10'}]},
    {id:'s_fin_contrat',nom:'Non-renouvellement d\'un contrat majeur',categorie:'Commercial',niveau:'eleve',probabilite:3,impact:4,velocite:1,description:'Un contrat à terme sans renouvellement laisse un vide de CA qu\'il faut 6-12 mois pour combler. Détection < 3 mois = peu de marge.',actions:[{titre:'Calendrier des renouvellements avec alerte 6 mois avant terme',priorite:'urgent',delai:'Ce mois'},{titre:'Points de satisfaction client trimestriels (pas seulement à la livraison)',priorite:'normal',delai:'Ce mois'},{titre:'Offre de renouvellement proactive 3 mois avant l\'échéance',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Contrats arrivant à terme dans 6 mois',seuil_alerte:1,unite:'contrats'},{label:'NPS client moyen',seuil_alerte:7,unite:'/10'},{label:'Taux de renouvellement contrats',seuil_alerte:80,unite:'%'}]},
    {id:'s_burnout',nom:'Burnout du dirigeant / dépendance au fondateur',categorie:'Ressources Humaines',niveau:'eleve',probabilite:3,impact:4,velocite:2,description:'Le dirigeant est souvent commercial + opérationnel + financier. Son indisponibilité paralyse tout. 40% des dirigeants de TPE montrent des signes d\'épuisement.',actions:[{titre:'Identifier les 3 tâches que seul le dirigeant peut faire et déléguer le reste',priorite:'urgent',delai:'Ce mois'},{titre:'Documenter les processus clés (commercial, facturation, suivi client)',priorite:'normal',delai:'Ce trimestre'},{titre:'Accord de réciprocité avec un partenaire pour la couverture vacances/maladie',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Heures travaillées / semaine (dirigeant)',seuil_alerte:55,unite:'h/sem'},{label:'Jours de congés pris dans l\'année',seuil_alerte:20,unite:'jours'},{label:'Processus documentés et délégués',seuil_alerte:70,unite:'%'}]},
    {id:'s_cgv',nom:'Litiges contractuels / CGV non conformes',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,description:'Des CGV mal rédigées ou une absence de clause de limitation de responsabilité exposent à des réclamations disproportionnées (5 000 à 50 000€ en frais).',actions:[{titre:'Faire réviser les CGV par un avocat spécialisé en droit commercial',priorite:'urgent',delai:'Ce trimestre'},{titre:'Cahier des charges signé avant tout démarrage de prestation',priorite:'normal',delai:'Ce mois'},{titre:'Limiter contractuellement la responsabilité au montant de la facture',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'CGV révisées par un juriste (ancienneté)',seuil_alerte:730,unite:'jours'},{label:'Prestations avec cahier des charges signé',seuil_alerte:100,unite:'%'},{label:'Litiges clients en cours',seuil_alerte:0,unite:'litiges'}]}
  ],
  sante:[
    {id:'sa_praticien_unique',nom:'Praticien unique / cabinet mono-médecin',categorie:'Ressources Humaines',niveau:'critique',probabilite:3,impact:4,velocite:3,description:'Cabinet avec un seul praticien : absent = fermé. Réagencement de tous les rendez-vous et prise en charge des patients urgents à gérer.',actions:[{titre:'Formaliser un accord de remplacement avec un confrère du secteur (réciprocité)',priorite:'urgent',delai:'Ce mois'},{titre:'Adhérer à un réseau de praticiens pour accéder à des remplaçants qualifiés',priorite:'normal',delai:'Ce trimestre'},{titre:'Informer les patients de la procédure en cas d\'absence (message automatique)',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Remplaçant identifié et disponible',seuil_alerte:1,unite:'contact'},{label:'Jours d\'absence praticien / an',seuil_alerte:30,unite:'jours'},{label:'Patients redirigés lors des absences',seuil_alerte:90,unite:'%'}]},
    {id:'sa_responsabilite',nom:'Mise en cause responsabilité médicale',categorie:'Juridique',niveau:'critique',probabilite:1,impact:4,velocite:1,description:'Une plainte patient déclenche une procédure Ordre + enquête ARS + litige civil. Sans faute prouvée, la défense représente 10 000 à 50 000€.',actions:[{titre:'Vérifier que la RCP est à jour et couvre tous les actes pratiqués',priorite:'urgent',delai:'Ce mois'},{titre:'Traçabilité complète des consultations et prescriptions (dossier médical)',priorite:'urgent',delai:'Ce mois'},{titre:'Recueillir systématiquement le consentement éclairé du patient',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'RCP à jour et couvrant tous les actes',seuil_alerte:1,unite:'contrat valide'},{label:'Dossiers patients complets',seuil_alerte:100,unite:'%'},{label:'Consentements signés pour actes invasifs',seuil_alerte:100,unite:'%'}]},
    {id:'sa_donnees_sante',nom:'Violation données de santé / RGPD',categorie:'Numérique',niveau:'critique',probabilite:2,impact:4,velocite:3,description:'Données de santé = plus sensibles au RGPD. Une fuite entraîne une notification CNIL obligatoire et une amende jusqu\'à 4% du CA mondial.',actions:[{titre:'Chiffrer les disques des ordinateurs contenant des données patients',priorite:'urgent',delai:'Cette semaine'},{titre:'Utiliser uniquement des logiciels certifiés HDS (Hébergeur Données Santé)',priorite:'urgent',delai:'Ce mois'},{titre:'Nommer un DPO ou utiliser un service mutualisé',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Ordinateurs avec chiffrement activé',seuil_alerte:100,unite:'%'},{label:'Logiciel de gestion certifié HDS',seuil_alerte:1,unite:'certifié'},{label:'Audit RGPD réalisé dans l\'année',seuil_alerte:1,unite:'fois/an'}]},
    {id:'sa_rejet_tiers_payant',nom:'Problèmes remboursement tiers payant / CPAM',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:1,description:'Rejets CPAM/mutuelles (erreur de code acte, numéro patient erroné) représentent 3 à 8% du CA. Sans suivi, le manque à gagner s\'accumule.',actions:[{titre:'Tableau de suivi mensuel des rejets CPAM et identification des causes',priorite:'urgent',delai:'Ce mois'},{titre:'Former le secrétariat à la procédure de régularisation des rejets',priorite:'normal',delai:'Ce mois'},{titre:'Activer la vérification des droits en temps réel (Vitale + ADRI)',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Taux de rejet tiers payant mensuel',seuil_alerte:3,unite:'%'},{label:'Délai moyen remboursement CPAM',seuil_alerte:30,unite:'jours'},{label:'Encours non récupéré sur rejets',seuil_alerte:2000,unite:'€'}]},
    {id:'sa_baisse_patientele',nom:'Baisse de patientèle / départ massif de patients',categorie:'Commercial',niveau:'eleve',probabilite:2,impact:3,velocite:1,description:'Nouveau praticien en zone, désertification médicale ou bad buzz : perte progressive de patientèle détectée trop tard sans suivi.',actions:[{titre:'Suivi mensuel des nouveaux patients, perdus et taux de retour',priorite:'normal',delai:'Ce mois'},{titre:'Demander systématiquement aux patients de laisser un avis Google ou Doctolib',priorite:'normal',delai:'Ce mois'},{titre:'Proposer des services différenciants : téléconsultation, horaires élargis',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Nouveaux patients / mois',seuil_alerte:5,unite:'patients'},{label:'Note Doctolib / Google',seuil_alerte:4.0,unite:'/5'},{label:'Délai moyen RDV disponible',seuil_alerte:10,unite:'jours'}]},
    {id:'sa_dpc',nom:'Défaut de DPC / formations obligatoires',categorie:'Juridique',niveau:'modere',probabilite:2,impact:3,velocite:1,description:'Les professionnels de santé doivent maintenir leur DPC à jour. Un défaut peut entraîner la suspension du conventionnement.',actions:[{titre:'Planifier les formations DPC obligatoires (minimum 21h / 3 ans)',priorite:'urgent',delai:'Ce mois'},{titre:'S\'abonner aux newsletters de l\'Ordre pour suivre les évolutions',priorite:'normal',delai:'Ce mois'},{titre:'Rejoindre une association professionnelle pour le suivi réglementaire',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Heures DPC réalisées / 3 ans',seuil_alerte:21,unite:'heures'},{label:'Convention CPAM à jour',seuil_alerte:1,unite:'convention active'},{label:'Codes CCAM mis à jour dans le logiciel',seuil_alerte:100,unite:'%'}]}
  ],
  tech:[
    {id:'t_churn',nom:'Churn MRR élevé / perte d\'abonnés',categorie:'Commercial',niveau:'critique',probabilite:3,impact:4,velocite:2,description:'Churn > 3%/mois = perte de 30% de la base par an. LTV s\'effondre, CAC dépasse rapidement la LTV. Premier signal de mort d\'un SaaS.',actions:[{titre:'Analyser les churns des 3 derniers mois : contacter chaque client perdu',priorite:'urgent',delai:'Ce mois'},{titre:'Score d\'engagement (connexions, features utilisées) et alerte avant résiliation',priorite:'normal',delai:'Ce mois'},{titre:'Programme de succès client : onboarding 30 jours, point à 90 jours',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Churn MRR mensuel',seuil_alerte:3,unite:'%'},{label:'NPS clients actifs',seuil_alerte:30,unite:'NPS'},{label:'Ratio LTV / CAC',seuil_alerte:3,unite:'ratio'}]},
    {id:'t_panne_prod',nom:'Bug critique / panne de production',categorie:'Opérationnel',niveau:'critique',probabilite:3,impact:4,velocite:3,description:'Panne production = tous les clients impactés simultanément. Au-delà de 4h, les clients B2B activent des SLA et les réseaux sociaux s\'emballent.',actions:[{titre:'Monitoring de disponibilité (Uptime Robot, Datadog) avec alerte SMS immédiate',priorite:'urgent',delai:'Cette semaine'},{titre:'Runbook de gestion de crise production : qui fait quoi, comment communiquer',priorite:'urgent',delai:'Ce mois'},{titre:'Tester le plan de reprise d\'activité une fois par trimestre',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Uptime mensuel',seuil_alerte:99.5,unite:'%'},{label:'MTTR (temps moyen résolution incident)',seuil_alerte:2,unite:'heures'},{label:'Incidents P1 sur 30 jours',seuil_alerte:1,unite:'incidents'}]},
    {id:'t_securite',nom:'Faille de sécurité / violation de données',categorie:'Numérique',niveau:'critique',probabilite:2,impact:4,velocite:3,description:'Une faille (injection SQL, fuite de tokens) déclenche une notification CNIL sous 72h. Pénalités RGPD : jusqu\'à 4% du CA.',actions:[{titre:'Audit de sécurité (pentesting) externe au moins une fois par an',priorite:'urgent',delai:'Ce trimestre'},{titre:'Programme de mise à jour automatique des dépendances (Dependabot, Renovate)',priorite:'urgent',delai:'Ce mois'},{titre:'Plan de réponse aux incidents : CNIL, communication clients, containment',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Dernier pentest externe',seuil_alerte:365,unite:'jours'},{label:'CVE critiques non patchées',seuil_alerte:0,unite:'CVE'},{label:'MFA activé sur tous les accès critiques',seuil_alerte:100,unite:'%'}]},
    {id:'t_burn_rate',nom:'Burn rate élevé / runway insuffisant',categorie:'Financier',niveau:'critique',probabilite:3,impact:4,velocite:1,description:'Runway < 12 mois sans MRR suffisant oblige à lever en urgence à des conditions défavorables. Premier cause de mort des startups.',actions:[{titre:'Calculer le runway exact (trésorerie / burn mensuel) et afficher la date à zéro',priorite:'urgent',delai:'Cette semaine'},{titre:'Identifier les 3 postes réductibles de 20% sans impact produit',priorite:'urgent',delai:'Ce mois'},{titre:'Activer les aides : BPI, CIR/CII, exonérations JEI',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Runway (mois)',seuil_alerte:12,unite:'mois'},{label:'Burn mensuel net',seuil_alerte:0,unite:'€'},{label:'MRR croissance mensuelle',seuil_alerte:10,unite:'%/mois'}]},
    {id:'t_depart_cto',nom:'Départ du CTO ou d\'un dev senior critique',categorie:'Ressources Humaines',niveau:'critique',probabilite:2,impact:4,velocite:3,description:'Départ du CTO = blocage de tout développement pendant 3 à 6 mois. La dette technique non documentée aggrave le risque.',actions:[{titre:'Revues de code systématiques pour diffuser la connaissance de l\'architecture',priorite:'urgent',delai:'Ce mois'},{titre:'Documenter l\'architecture technique, les ADR et procédures de déploiement',priorite:'urgent',delai:'Ce mois'},{titre:'Plan de rétention tech : BSPCE, télétravail flexible, projets stimulants',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Documentation architecture à jour',seuil_alerte:80,unite:'%'},{label:'Devs capables de toucher au cœur du système',seuil_alerte:2,unite:'devs'},{label:'Score rétention tech (enquête interne)',seuil_alerte:7,unite:'/10'}]},
    {id:'t_disruption',nom:'Disruption technologique / obsolescence produit',categorie:'Commercial',niveau:'eleve',probabilite:3,impact:4,velocite:2,description:'Une technologie (IA générative, no-code) peut rendre un SaaS obsolète en 12-18 mois. ChatGPT a détruit des dizaines de SaaS de rédaction en un an.',actions:[{titre:'Veille concurrentielle hebdomadaire (Product Hunt, Twitter/X tech, HackerNews)',priorite:'urgent',delai:'Ce mois'},{titre:'Identifier les fonctionnalités core non réplicables en 6 mois (moat)',priorite:'normal',delai:'Ce mois'},{titre:'Allouer 20% du temps produit à l\'exploration de nouvelles technologies (R&D)',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Veille concurrentielle formalisée',seuil_alerte:1,unite:'fois/semaine'},{label:'Fonctionnalités exclusives (moat)',seuil_alerte:3,unite:'features'},{label:'Temps R&D / temps développement total',seuil_alerte:20,unite:'%'}]}
  ],
  immobilier:[
    {id:'i_impaye_loyer',nom:'Impayé de loyer / locataire défaillant',categorie:'Financier',niveau:'critique',probabilite:3,impact:4,velocite:1,description:'Locataire qui cesse de payer : procédure d\'expulsion 12-24 mois. Pendant ce temps, aucun loyer perçu. Impayé moyen : 10 000 à 20 000€.',actions:[{titre:'Vérifier que chaque bail dispose d\'une GLI ou d\'un garant solvable',priorite:'urgent',delai:'Ce mois'},{titre:'Dès le 1er retard, mise en demeure formelle avant le 20 du mois suivant',priorite:'urgent',delai:'Prochain incident'},{titre:'Adhérer à Visale (garantie Action Logement) pour les locataires sans garant',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Baux avec GLI ou garant validé',seuil_alerte:100,unite:'%'},{label:'Loyers en retard > 30 jours',seuil_alerte:0,unite:'baux'},{label:'Délai moyen recouvrement impayé',seuil_alerte:30,unite:'jours'}]},
    {id:'i_vacance',nom:'Vacance locative prolongée',categorie:'Commercial',niveau:'critique',probabilite:3,impact:3,velocite:1,description:'Bien vide = 0 loyer mais charges maintenues (crédit, taxe foncière, syndic). Au-delà de 2 mois, la perte sèche dépasse souvent la rentabilité annuelle.',actions:[{titre:'Lancer une annonce multi-plateformes dès J-60 du départ du locataire',priorite:'urgent',delai:'Dès connaissance du départ'},{titre:'Analyser le prix demandé vs le marché local (3 annonces comparables à 500m)',priorite:'urgent',delai:'Cette semaine'},{titre:'Envisager la location meublée (LMNP) si la vacance est structurelle',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Taux de vacance sur le patrimoine',seuil_alerte:5,unite:'%'},{label:'Délai moyen de relocation après départ',seuil_alerte:30,unite:'jours'},{label:'Écart loyer demandé vs médian secteur',seuil_alerte:10,unite:'%'}]},
    {id:'i_dpe',nom:'Non-conformité DPE / passoire thermique',categorie:'Juridique',niveau:'critique',probabilite:3,impact:4,velocite:1,description:'Interdiction progressive : G depuis 2025, F en 2028, E en 2034. Un bien classé F ou G ne peut légalement plus être loué.',actions:[{titre:'DPE par diagnostiqueur certifié pour chaque bien du parc',priorite:'urgent',delai:'Ce trimestre'},{titre:'Planifier les travaux de rénovation énergétique et solliciter MaPrimeRénov\'',priorite:'urgent',delai:'Ce trimestre'},{titre:'Consulter un conseiller FAIRE pour prioriser les travaux (meilleur ratio coût/gain DPE)',priorite:'normal',delai:'Ce trimestre'}],indicateurs:[{label:'Biens classés F ou G dans le parc',seuil_alerte:0,unite:'biens'},{label:'DPE réalisé et à jour (< 10 ans)',seuil_alerte:100,unite:'%'},{label:'Budget rénovation énergétique planifié',seuil_alerte:1,unite:'budget alloué'}]},
    {id:'i_syndic_charges',nom:'Charges de copropriété imprévisibles / sinistre',categorie:'Financier',niveau:'eleve',probabilite:2,impact:3,velocite:2,description:'Vote en AG pour travaux de toiture/ravalement : appel de fonds 5 000 à 30 000€ par lot sans préavis.',actions:[{titre:'Épargne de précaution de 1 500€ par lot pour les appels de fonds',priorite:'urgent',delai:'Ce trimestre'},{titre:'Participer aux AG de copropriété et voter informé (compte-rendu syndic)',priorite:'normal',delai:'Prochaine AG'},{titre:'Demander au syndic le plan pluriannuel de travaux de chaque immeuble',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'Provision charges exceptionnelles',seuil_alerte:1500,unite:'€/lot'},{label:'Plan pluriannuel de travaux obtenu',seuil_alerte:1,unite:'document'},{label:'AG assistées / an par immeuble',seuil_alerte:1,unite:'AG/an'}]},
    {id:'i_taux',nom:'Hausse des taux d\'intérêt / refinancement',categorie:'Financier',niveau:'eleve',probabilite:3,impact:3,velocite:1,description:'+1 point sur un prêt variable = +10 à 20% sur la mensualité. Sur 500K€ d\'encours : 500 à 1 000€/mois supplémentaires.',actions:[{titre:'Répertorier tous les prêts : taux, type (fixe/variable), date échéance',priorite:'urgent',delai:'Ce mois'},{titre:'Simuler l\'impact d\'une hausse de 2 points sur les prêts variables',priorite:'urgent',delai:'Ce mois'},{titre:'Consulter un courtier pour renégocier ou passer les variables en fixe',priorite:'planif',delai:'Ce trimestre'}],indicateurs:[{label:'Part des prêts à taux variable',seuil_alerte:20,unite:'%'},{label:'Taux d\'effort global (mensualités / loyers)',seuil_alerte:70,unite:'%'},{label:'Couverture des mensualités par les loyers',seuil_alerte:120,unite:'%'}]},
    {id:'i_responsabilite_agence',nom:'Mise en cause responsabilité agence / gestion locative',categorie:'Juridique',niveau:'eleve',probabilite:2,impact:3,velocite:1,description:'Agence ou gestionnaire locatif mis en cause pour faute (état des lieux insuffisant, loyer mal fixé, sinistre non déclaré).',actions:[{titre:'Vérifier que la RCP couvre tous les types de mandats (minimum 500 000€)',priorite:'urgent',delai:'Ce mois'},{titre:'Standardiser les états des lieux avec photos datées et outil numérique',priorite:'normal',delai:'Ce mois'},{titre:'Registre de suivi des mandats et des échéances légales',priorite:'normal',delai:'Ce mois'}],indicateurs:[{label:'RCP à jour et montant adéquat',seuil_alerte:1,unite:'contrat valide'},{label:'États des lieux avec photos pour chaque bail',seuil_alerte:100,unite:'%'},{label:'Litiges propriétaires en cours',seuil_alerte:0,unite:'litiges'}]}
  ]
};

/* Helpers */
function buildOnboardingRisks(sector, problemes) {
  var sectorRisks = CLEARISK_DB[sector] || CLEARISK_DB['restauration'];
  var lvlColors = CK.levelColors;
  var lvlOrder = { critique:0, eleve:1, modere:2, faible:3 };
  var problemeMap = {
    tresorerie:['Financier','Trésorerie'],
    fournisseur:['Opérationnel'],
    rh:['Ressources Humaines','RH'],
    conformite:['Juridique','Conformité','Sanitaire'],
    reputation:['Réputation','Commercial'],
    cyber:['Numérique'],
    juridique:['Juridique','Assurance']
  };
  var sorted = sectorRisks.slice().sort(function(a,b) {
    if(lvlOrder[a.niveau]!==lvlOrder[b.niveau]) return lvlOrder[a.niveau]-lvlOrder[b.niveau];
    return b.probabilite-a.probabilite;
  });
  var prioritized=[], rest=[];
  sorted.forEach(function(r) {
    var isMatch = (problemes||[]).some(function(p) {
      return (problemeMap[p]||[]).some(function(c){ return r.categorie.toLowerCase().indexOf(c.toLowerCase())>-1; });
    });
    if(isMatch) prioritized.push(r);
    else rest.push(r);
  });
  var ordered = prioritized.concat(rest);
  return ordered.map(function(r) {
    return {
      id: r.id, name: r.nom, cat: r.categorie, level: r.niveau,
      status:'À traiter', date:"Aujourd'hui", source:'lib',
      color: lvlColors[r.niveau]||'#4A90D9',
      impact: r.impact-1, proba: r.probabilite-1,
      desc: r.description, _dbRef: r
    };
  });
}

function calcScoreInitial(sector, taille, anciennete, problemes) {
  var critiques = (CLEARISK_DB[sector]||[]).filter(function(r){return r.niveau==='critique';}).length;
  var base = 75 - critiques*4;
  if(anciennete==='3-10ans'||anciennete==='10ans+') base+=8;
  if(anciennete==='<1an') base-=8;
  base -= (problemes||[]).length * 3;
  if(taille==='solo') base-=5;
  return Math.max(22, Math.min(72, base));
}

/* ══════════════════════════════════════════════════
   ONBOARDING — NEW CLEAN VERSION
══════════════════════════════════════════════════ */
var onbStep = 1;
var onbData = { secteur:null, taille:null, anciennete:null, problemes:[] };

var SECTOR_NAMES = {};
var SECTOR_AVATARS = {};

function onbBuildProgress() {
  var prog = document.getElementById('onb-progress');
  if(!prog) return;
  prog.innerHTML = '';
  for(var i=1;i<=4;i++){
    var d = document.createElement('div');
    d.className = 'onb-prog-dot' + (i<=onbStep?' done':'');
    prog.appendChild(d);
  }
  document.getElementById('onb-step-ind').textContent = 'Étape ' + onbStep + ' / 4';
}

/* ═══════════════════════════════
   DIAGNOSTIC QUESTIONNAIRE (clearisk_v5)
═══════════════════════════════ */
var DIAG_QUESTIONS=[
  {bloc:'A',bl:'Finances',col:'#E24B4A',icon:'💰',key:'marge',text:'Quelle est votre marge brute approximative ?',hint:'(CA – coût d\'achat) / CA',opts:['Moins de 25% — très serrée','25% à 40%','40% à 60%','Plus de 60% — confortable']},
  {bloc:'A',bl:'Finances',col:'#E24B4A',icon:'💰',key:'treso',text:'Combien de mois pouvez-vous tenir sans encaissement ?',hint:'Trésorerie ÷ charges fixes mensuelles',opts:['Moins d\'1 mois','1 à 2 mois','2 à 4 mois','Plus de 4 mois']},
  {bloc:'A',bl:'Finances',col:'#E24B4A',icon:'💰',key:'pret',text:'Avez-vous des échéances de prêt dans les 12 prochains mois ?',opts:['Oui, et c\'est tendu','Oui, mais couvert','Non']},
  {bloc:'A',bl:'Finances',col:'#E24B4A',icon:'💰',key:'ca_trend',text:'Comment évolue votre CA sur les 12 derniers mois ?',opts:['En baisse de plus de 15%','Baisse légère (−5 à −15%)','Stable (±5%)','En croissance']},
  {bloc:'A',bl:'Finances',col:'#E24B4A',icon:'💰',key:'saisonnalite',text:'Votre activité est-elle très saisonnière ?',hint:'Ex : +50% en décembre, creux estival…',opts:['Oui, forte saisonnalité (>40% du CA sur 3 mois)','Saisonnalité modérée','Non, activité régulière']},
  {bloc:'B',bl:'Opérationnel',col:'#1A5CAB',icon:'⚙️',key:'fourn',text:'Combien de fournisseurs alternatifs pour vos produits clés ?',opts:['Aucun — fournisseur unique','1 alternatif','2 ou plus']},
  {bloc:'B',bl:'Opérationnel',col:'#1A5CAB',icon:'⚙️',key:'stock',text:'En combien de jours votre stock se renouvelle-t-il ?',hint:'Valeur stock / (CA / 365)',opts:['Moins de 30 jours','30 à 60 jours','60 à 90 jours','Plus de 90 jours — risque surstock']},
  {bloc:'B',bl:'Opérationnel',col:'#1A5CAB',icon:'⚙️',key:'rupture',text:'Avez-vous eu des ruptures de stock ces 12 derniers mois ?',opts:['Oui, plusieurs fois','Oui, une fois','Non']},
  {bloc:'C',bl:'RH',col:'#EF9F27',icon:'👥',key:'dirigeant',text:'Si vous êtes absent 2 semaines, votre commerce peut-il fonctionner ?',hint:'Clé de dépendance au dirigeant — risque souvent sous-estimé',opts:['Non, tout repose sur moi','Partiellement','Oui, l\'équipe est autonome']},
  {bloc:'C',bl:'RH',col:'#EF9F27',icon:'👥',key:'turnover',text:'Avez-vous eu des départs ou arrêts imprévus ces 12 mois ?',opts:['Oui, plusieurs','Oui, un','Non']},
  {bloc:'D',bl:'Commercial',col:'#1D9E75',icon:'📈',key:'concurrence',text:'Un concurrent direct s\'est-il renforcé près de vous ?',opts:['Oui, impact fort','Oui, mais limité','Non']},
  {bloc:'D',bl:'Commercial',col:'#1D9E75',icon:'📈',key:'google',text:'Quelle est votre note Google actuelle ?',opts:['Pas de fiche Google','Moins de 3,5','3,5 à 4,2','Plus de 4,2']},
  {bloc:'D',bl:'Commercial',col:'#1D9E75',icon:'📈',key:'canal',text:'Vendez-vous via une marketplace ? Quelle part du CA ?',opts:['Oui, +50% du CA','Oui, 20–50%','Oui, moins de 20%','Non']},
  {bloc:'E',bl:'Juridique',col:'#7c3aed',icon:'⚖️',key:'controle',text:'Avez-vous subi un contrôle officiel ces 3 dernières années ?',hint:'DGCCRF, Urssaf, etc.',opts:['Oui, avec redressement','Oui, sans suite','Non']},
  {bloc:'E',bl:'Juridique',col:'#7c3aed',icon:'⚖️',key:'assurance',text:'Êtes-vous couvert par une assurance RC Pro + perte d\'exploitation ?',opts:['Non, pas couvert','RC Pro uniquement','Oui, couverture complète']},
];

var DIAG_RISK_ENGINE=[
  {id:'r_treso',n:'Trésorerie insuffisante',cat:'Financier',level:function(a){return a.treso===0?'critique':a.treso===1?'eleve':'faible';},cond:function(a){return a.treso<=1;},impact:3,proba:function(a){return a.treso===0?3:2;},status:'À traiter',kri:'Ratio tréso < 1 mois',desc:'Incapacité à faire face aux obligations courantes. Risque de défaillance court terme si aucune mesure prise.',actions:['Ouvrir une ligne de crédit court terme','Négocier délai paiement fournisseurs (30j)','Mettre en place un suivi trésorerie hebdo']},
  {id:'r_ca',n:'Chute du CA (−15% ou plus)',cat:'Financier',level:function(a){return 'critique';},cond:function(a){return a.ca_trend===0;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'CA mensuel < 85% moy. N−1',desc:'Baisse brutale du chiffre d\'affaires menaçant la viabilité.',actions:['Analyser les causes de baisse par segment produit','Lancer une opération promotionnelle ciblée','Diversifier les canaux de vente']},
  {id:'r_marge',n:'Marge brute dégradée',cat:'Financier',level:function(a){return a.marge===0?'critique':'eleve';},cond:function(a){return a.marge<=1;},impact:2,proba:function(a){return 2;},status:'En cours',kri:'Marge brute < 25% du CA',desc:'Érosion des marges par hausse des coûts d\'achat ou pression concurrentielle sur les prix.',actions:['Renégocier les tarifs fournisseurs principaux','Auditer les produits à faible marge','Revoir la politique tarifaire']},
  {id:'r_pret',n:'Défaillance — remboursement prêt',cat:'Financier',level:function(a){return 'critique';},cond:function(a){return a.pret===0;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'Tréso < prochain remboursement',desc:'Échéances de prêt non couvertes par la trésorerie disponible. Risque bancaire immédiat.',actions:['Contacter sa banque pour renégocier l\'échéancier','Demander un différé partiel de remboursement']},
  {id:'r_saison',n:'Saisonnalité non anticipée',cat:'Financier',level:function(a){return 'eleve';},cond:function(a){return a.saisonnalite===0;},impact:2,proba:function(a){return 2;},status:'Surveillé',kri:'Tréso < 2 mois en période creuse',desc:'Creux saisonnier mettant en danger la trésorerie.',actions:['Constituer une réserve tréso avant la période creuse','Négocier des délais élargis avec les fournisseurs','Prévoir une activité complémentaire hors saison']},
  {id:'r_fourn',n:'Rupture fournisseur clé',cat:'Opérationnel',level:function(a){return 'critique';},cond:function(a){return a.fourn===0;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'Fournisseurs alternatifs = 0',desc:'Impossibilité d\'approvisionner les produits phares.',actions:['Identifier 2 fournisseurs alternatifs par produit clé','Négocier un stock de sécurité chez le fournisseur','Créer une fiche risque par fournisseur critique']},
  {id:'r_stock',n:'Surstock / invendus',cat:'Opérationnel',level:function(a){return 'eleve';},cond:function(a){return a.stock===3;},impact:2,proba:function(a){return 2;},status:'Surveillé',kri:'Rotation stock > 90 jours',desc:'Immobilisation excessive de trésorerie. Risque de dépréciation et de perte sèche.',actions:['Analyser la rotation par référence produit','Planifier déstockage ou promotions ciblées','Ajuster les commandes selon l\'historique des ventes']},
  {id:'r_rupture',n:'Ruptures de stock récurrentes',cat:'Opérationnel',level:function(a){return a.rupture===0?'eleve':'modere';},cond:function(a){return a.rupture<=1;},impact:2,proba:function(a){return a.rupture===0?3:2;},status:'À traiter',kri:'Ruptures > 1 fois / trimestre',desc:'Ruptures fréquentes dégradent la satisfaction client et détournent vers la concurrence.',actions:['Mettre en place un seuil de réapprovisionnement automatique','Diversifier les sources d\'approvisionnement','Analyser l\'historique des ventes pour mieux anticiper']},
  {id:'r_dirigeant',n:'Dépendance au dirigeant',cat:'Ressources Humaines',level:function(a){return a.dirigeant===0?'critique':'eleve';},cond:function(a){return a.dirigeant<=1;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'Commerce = 1 personne clé',desc:'Toute l\'activité repose sur une seule personne. Un arrêt = paralysie.',actions:['Former un collaborateur aux opérations clés','Documenter les procédures essentielles','Identifier un partenaire de secours']},
  {id:'r_turnover',n:'Turnover élevé du personnel',cat:'Ressources Humaines',level:function(a){return a.turnover===0?'eleve':'modere';},cond:function(a){return a.turnover<=1;},impact:2,proba:function(a){return 2;},status:'Surveillé',kri:'Départs imprévus > 1 / an',desc:'Départs fréquents désorganisent les équipes, dégradent la qualité et coûtent cher en recrutement.',actions:['Analyser les causes de départs (entretien de sortie)','Revoir la politique de rémunération et reconnaissance','Améliorer les conditions de travail et l\'organisation']},
  {id:'r_concurrence',n:'Pression concurrentielle accrue',cat:'Commercial',level:function(a){return a.concurrence===0?'eleve':'modere';},cond:function(a){return a.concurrence<=1;},impact:2,proba:function(a){return 2;},status:'Surveillé',kri:'Baisse part de marché locale',desc:'Un concurrent renforcé peut capter une partie de votre clientèle.',actions:['Analyser les forces/faiblesses vs concurrent','Renforcer votre offre sur les points différenciants','Fidéliser les clients existants']},
  {id:'r_google',n:'E-réputation dégradée',cat:'Commercial',level:function(a){return a.google<=1?'eleve':'modere';},cond:function(a){return a.google<=1;},impact:2,proba:function(a){return 2;},status:'À traiter',kri:'Note Google < 3,5 / 5',desc:'Note Google faible ou absence de fiche = perte de visibilité et de clients potentiels.',actions:['Créer ou optimiser la fiche Google Business','Répondre aux avis négatifs sous 48h','Mettre en place une stratégie de collecte d\'avis']},
  {id:'r_canal',n:'Dépendance marketplace',cat:'Commercial',level:function(a){return a.canal===0?'critique':a.canal===1?'eleve':'modere';},cond:function(a){return a.canal<=2;},impact:2,proba:function(a){return 2;},status:'Surveillé',kri:'CA marketplace > 20%',desc:'Forte dépendance à une plateforme externe expose aux hausses de commissions et déréférencements.',actions:['Développer un canal direct (site, téléphone)','Réduire la part marketplace sous 20% du CA','Négocier les conditions avec la plateforme']},
  {id:'r_controle',n:'Risque de redressement / contrôle',cat:'Juridique',level:function(a){return a.controle===0?'critique':'modere';},cond:function(a){return a.controle===0;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'Redressement en cours',desc:'Un redressement passé augmente significativement le risque de nouveau contrôle.',actions:['Mettre en conformité les points signalés lors du contrôle','Faire un audit préventif par un expert-comptable','Documenter toutes les pratiques commerciales et RH']},
  {id:'r_assurance',n:'Couverture assurantielle insuffisante',cat:'Juridique',level:function(a){return a.assurance===0?'critique':'eleve';},cond:function(a){return a.assurance<=1;},impact:3,proba:function(a){return 2;},status:'À traiter',kri:'Pas de RC Pro ou perte d\'exploitation',desc:'Sans RC Pro ou assurance perte d\'exploitation, un sinistre peut mettre fin à l\'activité.',actions:['Souscrire une RC Pro adaptée à l\'activité','Ajouter une garantie perte d\'exploitation','Faire comparer les offres par un courtier']},
];

var diagAnswers={};
var diagCurrentQ=0;

function diagRenderQ(){
  var q=DIAG_QUESTIONS[diagCurrentQ];
  var total=DIAG_QUESTIONS.length;
  var pct=Math.round((diagCurrentQ/total)*100);
  document.getElementById('diag-prog').style.width=pct+'%';
  document.getElementById('diag-prog-txt').textContent='Bloc '+q.bloc+' — '+q.bl+' · Question '+(diagCurrentQ+1)+' / '+total;
  document.getElementById('diag-step-ind').textContent=(diagCurrentQ+1)+' / '+total;
  var container=document.getElementById('diag-q-container');
  var html='<div style="background:#F8FAFC;border-radius:8px;padding:8px 14px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">'
    +'<div style="width:32px;height:32px;border-radius:7px;background:'+q.col+'18;display:flex;align-items:center;justify-content:center;font-size:15px;">'+q.icon+'</div>'
    +'<div><div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:'+q.col+';">Bloc '+q.bloc+' — '+q.bl+'</div>'
    +'<div style="font-size:11px;color:#94A3B8;">'+q.opts.length+' choix</div></div></div>';
  html+='<div style="font-size:14px;font-weight:500;color:#0A1F3D;margin-bottom:4px;line-height:1.5;">'+q.text+'</div>';
  if(q.hint)html+='<div style="font-size:11px;color:#94A3B8;margin-bottom:14px;font-style:italic;">'+q.hint+'</div>';
  else html+='<div style="margin-bottom:14px;"></div>';
  html+='<div style="display:flex;flex-direction:column;gap:7px;">';
  q.opts.forEach(function(opt,i){
    var sel=diagAnswers[q.key]===i;
    html+='<div class="q-opt'+(sel?' sel':'')+'" onclick="diagSelectOpt('+i+')">'
      +'<div class="q-radio"></div>'
      +'<span style="font-size:13px;">'+opt+'</span>'
      +'</div>';
  });
  html+='</div>';
  container.innerHTML=html;
  var nextBtn=document.getElementById('diag-next-btn');
  var prevBtn=document.getElementById('diag-prev-btn');
  var hasAnswer=diagAnswers[q.key]!==undefined;
  nextBtn.disabled=!hasAnswer;
  nextBtn.style.opacity=hasAnswer?'1':'.4';
  nextBtn.style.cursor=hasAnswer?'pointer':'not-allowed';
  nextBtn.textContent=diagCurrentQ===total-1?'Voir mes résultats →':'Suivant →';
  prevBtn.style.visibility=diagCurrentQ>0?'visible':'hidden';
  document.getElementById('diag-step-ind').textContent=(diagCurrentQ+1)+' / '+total;
}

function diagSelectOpt(i){
  var q=DIAG_QUESTIONS[diagCurrentQ];
  diagAnswers[q.key]=i;
  diagRenderQ();
}

function diagNext(){
  var q=DIAG_QUESTIONS[diagCurrentQ];
  if(diagAnswers[q.key]===undefined) return;
  if(diagCurrentQ===DIAG_QUESTIONS.length-1){diagShowScore();return;}
  diagCurrentQ++;
  diagRenderQ();
}

function diagPrev(){
  if(diagCurrentQ<=0) return;
  diagCurrentQ--;
  diagRenderQ();
}

function diagShowScore(){
  var detected=[];
  DIAG_RISK_ENGINE.forEach(function(r){
    if(r.cond(diagAnswers)){
      var lvl=r.level(diagAnswers);
      var proba=typeof r.proba==='function'?r.proba(diagAnswers):r.proba;
      var colMap=CK.levelColors;
      detected.push({id:r.id,name:r.n,cat:r.cat,level:lvl,status:r.status,date:"À l'instant",source:'clearisk',color:colMap[lvl],impact:r.impact,proba:proba,desc:r.desc,actions:r.actions,kri:r.kri});
    }
  });
  var crit=detected.filter(function(r){return r.level==='critique';}).length;
  var eleve=detected.filter(function(r){return r.level==='eleve';}).length;
  var score=100-crit*15-eleve*8-detected.filter(function(r){return r.level==='modere';}).length*3;
  score=Math.max(10,Math.min(100,score));
  var scoreLbl=score>=75?'Bonne résilience':score>=50?'Vigilance requise':'Situation préoccupante';
  var scoreSub=score>=75?'Quelques points à surveiller.':score>=50?'Des risques importants à traiter.':'Des actions urgentes s\'imposent.';
  var scoreCol=score>=75?'#1D9E75':score>=50?'#EF9F27':'#E24B4A';
  var circle=document.getElementById('score-circle');
  circle.textContent=score;
  circle.style.color=scoreCol;
  circle.style.borderColor=scoreCol;
  document.getElementById('score-lbl').textContent=scoreLbl;
  document.getElementById('score-sub').textContent=scoreSub;
  document.getElementById('kpi-total').textContent=detected.length;
  document.getElementById('kpi-crit').textContent=crit;
  document.getElementById('kpi-act').textContent=detected.reduce(function(s,r){return s+(r.actions?r.actions.length:0);},0);
  document.getElementById('onbOverlay').style.display='none';
  document.getElementById('scoreOverlay').style.display='flex';
  window._diagDetectedRisks=detected;
  window._diagScore=score;
}

function diagApplyResults(){
  var detected=window._diagDetectedRisks||[];
  var score=window._diagScore||50;
  if(detected.length>0){
    // Remplace les risques existants par ceux du diagnostic
    // On garde les risques custom existants et on fusionne
    var existingCustom=riskData.filter(function(r){return r.source==='custom';});
    riskData=detected.concat(existingCustom);

    // Sauvegarder chaque risque en Supabase
    detected.forEach(function(r){
      r._sbSaved = false;
      sbSaveRisk(r);
      sbSaveHistory({type:'risque', title:'Risque ajouté — '+r.name, desc:'Catégorie '+r.cat+' · Diagnostic Clearisk'});
    });

    // Mettre à jour modals pour les risques détectés
    detected.forEach(function(r){
      if(!modals[r.id]){
        var colMap=CK.levelColors;
        var actHTML=(r.actions||[]).map(function(a){
          return '<div class="modal-action-item" onclick="toggleMac(this)"><div class="mac-check"></div><div class="mac-label">'+a+'</div><div class="mac-due">À planifier</div></div>';
        }).join('');
        modals[r.id]={
          title:r.name,
          sub:r.cat+' · '+levelLabel[r.level]+' · Diagnostic Clearisk',
          content:'<div class="modal-section"><div class="ms-title">Vue d\'ensemble</div>'
            +'<div class="ms-row"><div class="ms-cell"><div class="ms-cell-label">Niveau</div><div class="ms-cell-value" style="color:'+colMap[r.level]+';">'+levelLabel[r.level]+'</div></div>'
            +'<div class="ms-cell"><div class="ms-cell-label">KRI</div><div class="ms-cell-value" style="font-size:11px;">'+r.kri+'</div></div></div></div>'
            +'<div class="modal-section"><div class="ms-title">Description</div><div class="ms-text">'+r.desc+'</div></div>'
            +(actHTML?'<div class="modal-section"><div class="ms-title">Plan d\'action</div>'+actHTML+'</div>':'')
        };
      }
    });

    // Préparer les suggestions de plans d'action et contrôles permanents
    _suggestRisks = [];
    detected.forEach(function(r){
      var dbRef=(CLEARISK_DB[ACCOUNT_SECTOR]||[]).find(function(d){return d.id===r.id;});
      if(dbRef && ((dbRef.actions&&dbRef.actions.length>0)||(dbRef.controles&&dbRef.controles.length>0))){
        _suggestRisks.push({risk:{id:r.id,name:r.name,cat:r.cat,color:r.color},dbRef:dbRef});
      }
    });
  }

  document.getElementById('scoreOverlay').style.display='none';
  var _crit=riskData.filter(function(r){return r.level==='critique';}).length;
  var _unadr=riskData.filter(function(r){return r.level==='critique'&&r.status!=='Traité';}).length;
  // Recalculer le score dynamiquement après fusion des données
  var score = calcScoreDynamic();
  updateScoreCard(score,_crit,_unadr);
  document.getElementById('badge-risques').textContent=_crit;
  renderDashboard();
  showPage('risques',document.getElementById('nav-risques'));

  // Ouvrir la modal de suggestions si des actions/contrôles sont disponibles
  if(_suggestRisks.length>0){
    openSuggestModal();
  } else {
    showToast(detected.length+' risques identifiés · Tableau de bord mis à jour ✓');
  }
}

function reopenDiag(){
  diagCurrentQ=0;
  diagAnswers={};
  diagRenderQ();
  document.getElementById('onbOverlay').style.display='flex';
}

function updateNavForSector(sector, nom, avatar) {
  var nc = document.getElementById('nav-company-name');
  var na = document.getElementById('nav-avatar-txt');
  var su = document.getElementById('sb-uname-txt');
  var av = document.getElementById('sb-av-txt');
  var av1 = document.getElementById('ep-av1');
  var nm1 = document.getElementById('ep-name1');
  if(nc) nc.textContent = nom;
  if(na) na.textContent = avatar;
  if(su) su.textContent = nom;
  if(av) av.textContent = avatar;
  if(av1) av1.textContent = avatar;
  if(nm1) nm1.textContent = nom;
}

/* ═══════════════════════════════
   DEMO SECTOR SWITCHER
═══════════════════════════════ */


function buildModalFromDB(id, dbRef) {
  var lvlColors = CK.levelColors;
  var lvlLabels = CK.levelLabel;
  var pvBadges = ['🐢 Lente','⚡ Moyenne','🚨 Rapide'];
  var pv = dbRef.velocite ? pvBadges[dbRef.velocite-1] : '—';
  var actionsHTML = (dbRef.actions||[]).map(function(a){
    var cls = a.priorite==='urgent'?'bc':a.priorite==='normal'?'bh':'bm';
    return '<div class="pa-action-card" style="margin-bottom:8px;">'
      +'<div class="pac-top"><div class="pac-title">'+a.titre+'</div>'
      +'<span class="ri-badge '+cls+'">'+a.delai+'</span></div></div>';
  }).join('');
  var indicsHTML = (dbRef.indicateurs||[]).map(function(ind){
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F4F6F9;">'
      +'<div style="flex:1;font-size:12px;color:#374151;">'+ind.label+'</div>'
      +'<div style="font-size:11px;color:#94A3B8;">Seuil : <strong style="color:#0A1F3D;">'+ind.seuil_alerte+' '+ind.unite+'</strong></div>'
      +'</div>';
  }).join('');
  var velociteLabel = ['Lente (peut attendre)','Moyenne (quelques semaines)','Rapide (impact en jours)'];
  modals[id] = {
    title: dbRef.nom,
    sub: dbRef.categorie + ' · ' + lvlLabels[dbRef.niveau] + ' · P:' + dbRef.probabilite + ' I:' + dbRef.impact + ' V:' + dbRef.velocite,
    content: '<div class="modal-section">'
      +'<div class="ms-title">Description du risque</div>'
      +'<div style="font-size:12px;color:#374151;line-height:1.65;padding:10px 0;">'+dbRef.description+'</div>'
      +'<div class="piv-row">'
      +'<span class="piv-badge" style="background:#FEF3E2;color:#7A4500;">📊 Probabilité : '+dbRef.probabilite+'/4</span>'
      +'<span class="piv-badge" style="background:#FDEAEA;color:#7A0000;">⚡ Impact : '+dbRef.impact+'/4</span>'
      +'<span class="piv-badge" style="background:#EBF4FF;color:#1A5CAB;">🌊 Vélocité : '+(velociteLabel[dbRef.velocite-1]||'—')+'</span>'
      +'</div></div>'
      +'<div class="modal-section"><div class="ms-title">Actions recommandées</div>'+actionsHTML+'</div>'
      +'<div class="modal-section"><div class="ms-title">Indicateurs à surveiller</div>'+indicsHTML+'</div>'
      +'<div class="modal-section" id="ms-ai-live-wrap" style="display:none;">'
      +'<div class="ms-title">Analyse IA Clearisk</div>'
      +'<div id="ms-ai-text-live" style="font-size:12px;color:#374151;line-height:1.65;"></div>'
      +'</div>'
  };
}

diagRenderQ();

/* ══════════════════════════════════════════════════
   RENDER DASHBOARD
══════════════════════════════════════════════════ */
function updateScoreCard(score, critCount, unaddressed) {
  var num = document.getElementById('sc-num');
  var status = document.getElementById('sc-status');
  var phrase = document.getElementById('sc-phrase');
  var fill = document.getElementById('sc-prog-fill');
  var updated = document.getElementById('sc-updated');
  if(!num) return;
  num.textContent = score;
  var zones = [
    { min:0,  max:39,  color:'#E24B4A', icon:'🚨', label:'Situation critique',
      text:'Votre entreprise est exposée à des risques majeurs non couverts. '+critCount+' risques critiques nécessitent une action dans les 7 prochains jours.' },
    { min:40, max:59,  color:'#EF9F27', icon:'⚠',  label:'Exposition élevée',
      text:'Plusieurs risques importants restent sans plan d\'action. Traitez les priorités en attente pour améliorer votre score.' },
    { min:60, max:74,  color:'#EF9F27', icon:'⚠',  label:'Vigilance requise',
      text:(unaddressed > 0 ? unaddressed+' risque'+(unaddressed>1?'s critiques':'critique')+' non adressé'+(unaddressed>1?'s':'')+' tirent votre résilience vers le bas.' : 'Continuez à traiter vos risques pour renforcer votre résilience.') },
    { min:75, max:89,  color:'#1D9E75', icon:'✓',  label:'Bonne maîtrise',
      text:'Votre gestion des risques est solide. Continuez à traiter les risques élevés pour atteindre le niveau Excellent.' },
    { min:90, max:100, color:'#1D9E75', icon:'★',  label:'Résilience excellente',
      text:'Félicitations — votre entreprise est parmi les mieux préparées. Continuez à réviser vos risques chaque trimestre.' }
  ];
  var zone = zones.find(function(z){ return score >= z.min && score <= z.max; }) || zones[2];
  status.textContent = zone.icon + ' ' + zone.label;
  status.style.color = zone.color;
  if(phrase) phrase.textContent = zone.text;
  if(fill) { fill.style.width = score + '%'; fill.style.background = zone.color; }
  if(updated) updated.textContent = 'Mis \u00e0 jour aujourd\'hui \u00b7 ' + riskData.length + ' risques actifs';
}

function _renderDashboardReal() {
  setTimeout(renderNotifPanel, 300);
  var _c = riskData.filter(function(r){ return r.level==='critique'; }).length;
  var _u = riskData.filter(function(r){ return r.level==='critique' && r.status!=='Traité'; }).length;

  /* ── Score ── */
  var lastScore = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length-1] : null;
  var score = lastScore ? lastScore.val : calcScoreDynamic();
  var scoreDelta = (lastScore && lastScore.delta) ? lastScore.delta : null;

  var scoreLabel;
  if(score >= 80)      scoreLabel = 'Bien';
  else if(score >= 60) scoreLabel = 'Vigilance requise';
  else if(score >= 40) scoreLabel = 'Exposition élevée';
  else                 scoreLabel = 'Situation critique';

  /* ── Score : grand chiffre — gris si aucun risque, coloré sinon ── */
  var scoreColor;
  if(riskData.length === 0) {
    scoreColor = '#94A3B8';
    scoreLabel = '—';
  } else if(score >= 80)      scoreColor = '#0F6E56';
  else if(score >= 60)        scoreColor = '#EF9F27';
  else if(score >= 40)        scoreColor = '#D85A30';
  else                        scoreColor = '#E24B4A';
  var circle = document.getElementById('ov-score-circle');
  if(circle) { circle.textContent = riskData.length === 0 ? '—' : score; circle.style.color = scoreColor; }

  var lbl = document.getElementById('ov-score-label');
  if(lbl) { lbl.textContent = scoreLabel; lbl.style.color = scoreColor; }

  var upd = document.getElementById('ov-score-updated');
  if(upd) {
    var now = new Date();
    var monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    upd.textContent = 'Mis à jour aujourd\'hui · ' + now.getDate() + ' ' + monthNames[now.getMonth()] + ' ' + now.getFullYear();
  }

  /* ── Pill delta ── */
  var deltaEl = document.getElementById('ov-score-delta');
  if(deltaEl) {
    if(scoreDelta) {
      var isPos = String(scoreDelta).indexOf('-') === -1;
      deltaEl.style.display = 'inline-flex';
      deltaEl.style.background = isPos ? '#E1F5EE' : '#FCEBEB';
      deltaEl.style.color = isPos ? '#0F6E56' : '#A32D2D';
      deltaEl.textContent = (isPos ? '↑ +' : '↓ ') + scoreDelta + ' pts ce mois';
    } else {
      deltaEl.style.display = 'none';
    }
  }

  /* ── KPI Risques ── */
  var kpiR = document.getElementById('ov-kpi-risques');
  var kpiRs = document.getElementById('ov-kpi-risques-sub');
  if(kpiR) kpiR.textContent = riskData.length;
  if(kpiRs) {
    if(riskData.length === 0) { kpiRs.textContent = '—'; kpiRs.style.color = '#94A3B8'; }
    else { kpiRs.textContent = _c + ' critique' + (_c>1?'s':''); kpiRs.style.color = _c > 0 ? '#A32D2D' : '#0F6E56'; }
  }

  /* ── KPI Actions ── */
  var actTotal = actionData.filter(function(a){ return !a.done; }).length;
  var actUrgent = actionData.filter(function(a){ return a.priority==='urgent' && !a.done; }).length;
  var kpiA = document.getElementById('ov-kpi-actions');
  var kpiAs = document.getElementById('ov-kpi-actions-sub');
  if(kpiA) kpiA.textContent = actTotal;
  if(kpiAs) {
    if(actionData.length === 0) { kpiAs.textContent = '—'; kpiAs.style.color = '#94A3B8'; }
    else { kpiAs.textContent = actUrgent > 0 ? actUrgent + ' urgente' + (actUrgent>1?'s':'') : 'Aucune urgente'; kpiAs.style.color = actUrgent > 0 ? '#854F0B' : '#0F6E56'; }
  }

  /* ── KPI Contrôles ── */
  var ctrlLate = ctrlData.filter(function(c){ return c.statut==='retard' || c.statut==='nonconforme'; }).length;
  var ctrlWarn = ctrlData.filter(function(c){ return c.statut==='averifier'; }).length;
  var kpiC = document.getElementById('ov-kpi-ctrl');
  var kpiCs = document.getElementById('ov-kpi-ctrl-sub');
  if(kpiC) kpiC.textContent = ctrlLate;
  if(kpiCs) {
    if(ctrlData.length === 0) { kpiCs.textContent = '—'; kpiCs.style.color = '#94A3B8'; }
    else { kpiCs.textContent = ctrlWarn > 0 ? ctrlWarn + ' à vérifier' : (ctrlLate > 0 ? ctrlLate + ' en retard' : 'Aucun retard'); kpiCs.style.color = ctrlLate > 0 ? '#A32D2D' : (ctrlWarn > 0 ? '#854F0B' : '#0F6E56'); }
  }

  /* ── Risques prioritaires ── */
  var lvlOrder = {critique:0, eleve:1, modere:2, faible:3};
  var lvlColors = CK.levelColors;
  var lvlLabel2 = CK.levelLabel;
  var sorted = riskData.slice().sort(function(a,b){ return (lvlOrder[a.level]||9)-(lvlOrder[b.level]||9); });
  var top5 = sorted.filter(function(r){ return r.status!=='Traité'; }).slice(0,5);
  var rl = document.getElementById('ov-risques-list');
  if(rl) {
    if(riskData.length === 0) {
      rl.innerHTML = '<div style="font-size:12px;color:#94A3B8;font-style:italic;padding:6px 0;">Aucun risque enregistré.</div>';
    } else if(!top5.length) {
      rl.innerHTML = '<div style="font-size:12px;color:#0F6E56;font-style:italic;padding:6px 0;">Aucun risque actif — bonne situation ✓</div>';
    } else {
      rl.innerHTML = top5.map(function(r){
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F1F5F9;">'
          +'<div style="width:7px;height:7px;border-radius:50%;background:'+lvlColors[r.level]+';flex-shrink:0;"></div>'
          +'<span style="font-size:13px;color:#0A1F3D;flex:1;">'+escHtml(r.name)+'</span>'
          +'<span style="font-size:11px;color:#94A3B8;margin-right:16px;">'+escHtml(r.cat)+'</span>'
          +'<span style="font-size:12px;font-weight:500;color:'+lvlColors[r.level]+';">'+lvlLabel2[r.level]+'</span>'
          +'</div>';
      }).join('');
    }
  }

  /* ── Actions urgentes — triées par urgence de date, code couleur ── */
  var dueOrder = {late:0, week:1, month:2, quarter:3, year:4};
  var dueLabels = {week:'Cette semaine', month:'Ce mois', quarter:'Ce trimestre', year:'Cette année', done:'Fait', late:'En retard'};
  var dueColors = {late:'#E24B4A', week:'#EF9F27', month:'#94A3B8', quarter:'#94A3B8', year:'#94A3B8'};
  var urgentFirst = actionData.filter(function(a){ return !a.done; }).sort(function(a,b){
    var oa = (a.priority==='urgent' ? 0 : 10) + (dueOrder[a.due]||5);
    var ob = (b.priority==='urgent' ? 0 : 10) + (dueOrder[b.due]||5);
    return oa - ob;
  }).slice(0,5);
  var al = document.getElementById('ov-actions-list');
  if(al) {
    if(actionData.length === 0) {
      al.innerHTML = '<div style="font-size:12px;color:#94A3B8;font-style:italic;padding:6px 0;">Aucune action créée.</div>';
    } else if(!urgentFirst.length) {
      al.innerHTML = '<div style="font-size:12px;color:#0F6E56;font-style:italic;padding:6px 0;">✓ Toutes les actions sont traitées.</div>';
    } else {
      al.innerHTML = urgentFirst.map(function(a){
        var dueKey = a.due || 'month';
        var dueStr = a.dueLabel || dueLabels[dueKey] || dueKey;
        var dueCol = dueColors[dueKey] || '#94A3B8';
        return '<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #F1F5F9;">'
          +'<div style="width:14px;height:14px;border-radius:3px;border:1.5px solid #CBD5E1;flex-shrink:0;margin-top:2px;"></div>'
          +'<div style="flex:1;">'
          +'<div style="font-size:13px;color:#0A1F3D;line-height:1.4;">'+escHtml(a.name)+'</div>'
          +'<div style="font-size:11px;font-weight:500;margin-top:3px;color:'+dueCol+';">'+dueStr+'</div>'
          +'</div>'
          +'</div>';
      }).join('');
    }
  }

  /* ── Contrôles permanents ── */
  var ctrlBad = ctrlData.filter(function(c){ return c.statut==='retard'||c.statut==='nonconforme'||c.statut==='averifier'||c.statut==='nonplanifie'; })
    .sort(function(a,b){ var sa=a.statut==='retard'||a.statut==='nonconforme'?0:a.statut==='averifier'?1:2; var sb=b.statut==='retard'||b.statut==='nonconforme'?0:b.statut==='averifier'?1:2; return sa-sb; })
    .slice(0,4);
  var ctrlStatutColor = {averifier:'#D97706', retard:'#A32D2D', nonconforme:'#A32D2D', conforme:'#0F6E56', nonplanifie:'#94A3B8'};
  var ctrlStatutLabel = {averifier:'À vérifier', retard:'En retard', nonconforme:'Non conforme', conforme:'Conforme', nonplanifie:'Non planifié'};
  var cl = document.getElementById('ov-ctrl-list');
  if(cl) {
    if(ctrlData.length === 0) {
      cl.innerHTML = '<div style="font-size:12px;color:#94A3B8;font-style:italic;padding:6px 0;">Aucun contrôle planifié pour le moment.</div>';
    } else if(!ctrlBad.length) {
      cl.innerHTML = '<div style="font-size:12px;color:#0F6E56;font-style:italic;padding:6px 0;">✓ Tout est conforme.</div>';
    } else {
      cl.innerHTML = ctrlBad.map(function(c){
        var prochStr = typeof ctrl_calcProchaine==='function' ? (function(){ var p=ctrl_calcProchaine(c); return p?(typeof p==='string'?p:p.label):'—'; })() : '—';
        var col = ctrlStatutColor[c.statut] || '#94A3B8';
        var lbl = ctrlStatutLabel[c.statut] || c.statut;
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #F1F5F9;">'
          +'<div style="flex:1;">'
          +'<div style="font-size:13px;color:#0A1F3D;">'+escHtml(c.nom)+'</div>'
          +'<div style="font-size:11px;color:#94A3B8;margin-top:2px;">'+escHtml(c.cat)+' · '+escHtml(prochStr)+'</div>'
          +'</div>'
          +'<span style="font-size:12px;font-weight:500;color:'+col+';margin-right:8px;">'+lbl+'</span>'
          +'<button onclick="ctrl_openVal(\''+c.id+'\')" style="font-size:11px;padding:3px 10px;border:1px solid #E2E8F0;border-radius:5px;background:#fff;color:#0A1F3D;cursor:pointer;white-space:nowrap;">Valider</button>'
          +'</div>';
      }).join('');
    }
  }

  /* ── Catégories de risques ── */
  var cats = {};
  var catOrder = ['Financier','Sanitaire','Juridique','Opérationnel','Commercial','Ressources Humaines'];
  var lvlScore = {critique:0, eleve:30, modere:60, faible:90};
  var lvlColorsBar = CK.levelColors;
  riskData.forEach(function(r){
    if(!cats[r.cat]) cats[r.cat] = {worst:'faible', count:0};
    cats[r.cat].count++;
    if((lvlScore[r.level]||50) < (lvlScore[cats[r.cat].worst]||50)) cats[r.cat].worst = r.level;
  });
  var catKeys = Object.keys(cats);
  if(catOrder) catKeys.sort(function(a,b){ var ia=catOrder.indexOf(a); var ib=catOrder.indexOf(b); return (ia===-1?99:ia)-(ib===-1?99:ib); });
  var catEl = document.getElementById('ov-categories-list');
  if(catEl) {
    if(!catKeys.length) {
      catEl.innerHTML = '<div style="font-size:12px;color:#94A3B8;font-style:italic;padding:6px 0;">Aucun risque enregistré.</div>';
    } else {
      catEl.innerHTML = catKeys.map(function(cat){
        var d = cats[cat];
        var barPct = Math.max(15, 100 - (lvlScore[d.worst]||50));
        var barColor = lvlColorsBar[d.worst] || '#94A3B8';
        return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #F1F5F9;">'
          +'<span style="font-size:12px;color:#0A1F3D;width:130px;flex-shrink:0;">'+cat+'</span>'
          +'<div style="flex:1;height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden;">'
          +'<div style="width:'+barPct+'%;height:100%;border-radius:3px;background:'+barColor+';"></div>'
          +'</div>'
          +'<div style="width:8px;height:8px;border-radius:50%;background:'+barColor+';flex-shrink:0;"></div>'
          +'</div>';
      }).join('');
    }
  }

  /* ── Évolution du score ── */
  var histoEl = document.getElementById('ov-histo-list');
  if(histoEl) {
    if(!scoreHistory.length) {
      histoEl.innerHTML = '<div style="font-size:12px;color:#94A3B8;font-style:italic;padding:6px 0;">Aucun historique disponible.</div>';
    } else {
      var last8 = scoreHistory.slice(-8);
      var maxVal = Math.max.apply(null, last8.map(function(h){ return h.val||0; })) || 100;
      var monthNamesShort = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
      histoEl.innerHTML = last8.map(function(h, i){
        var pct = Math.round((h.val / maxVal) * 100);
        var prev = i > 0 ? last8[i-1].val : null;
        var delta = prev !== null ? h.val - prev : null;
        var deltaStr = delta !== null ? (delta >= 0 ? '<span style="color:#0F6E56;">+'+delta+'</span>' : '<span style="color:#A32D2D;">'+delta+'</span>') : '<span style="color:#94A3B8;">—</span>';
        var label = h.label || (h.date ? (function(){ var d=new Date(h.date); return monthNamesShort[d.getMonth()]; })() : '');
        return '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">'
          +'<span style="font-size:11px;color:#94A3B8;width:36px;">'+label+'</span>'
          +'<div style="flex:1;height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden;">'
          +'<div style="width:'+pct+'%;height:100%;border-radius:3px;background:#1D9E75;"></div>'
          +'</div>'
          +'<span style="font-size:11px;color:#0A1F3D;width:24px;text-align:right;">'+h.val+'</span>'
          +'<span style="font-size:11px;width:30px;text-align:right;">'+deltaStr+'</span>'
          +'</div>';
      }).join('');
    }
  }
}

/* ══════════════════════════════════════════════════
   RADAR CHART
══════════════════════════════════════════════════ */
var radarAxes = [
  {label:'Financier', key:'financier', color:'#E24B4A'},
  {label:'Juridique', key:'juridique', color:'#D85A30'},
  {label:'Opérationnel', key:'operationnel', color:'#EF9F27'},
  {label:'Humain / RH', key:'rh', color:'#7F77DD'},
  {label:'Réputation', key:'reputation', color:'#D4537E'}
];

function getAxisScore(key) {
  var catMap = {
    financier:['Financier','Trésorerie'],
    juridique:['Juridique','Juridique / RH'],
    operationnel:['Opérationnel','Matériel','Commercial','Sanitaire'],
    rh:['RH / Opérationnel','RH'],
    reputation:['Réputation']
  };
  var cats = catMap[key]||[];
  var relevant = riskData.filter(function(r){
    return cats.some(function(c){ return r.cat.toLowerCase().indexOf(c.toLowerCase()) > -1; });
  });
  if(!relevant.length) return 70;
  var lvlW = {critique:0,eleve:30,modere:60,faible:90};
  var avg = relevant.reduce(function(s,r){ return s + (lvlW[r.level]||50); },0) / relevant.length;
  return Math.round(avg);
}

function drawRadar() {
  var svg = document.getElementById('radarSvg');
  if(!svg) return;
  var cx=90,cy=90,r=70,n=radarAxes.length;
  svg.innerHTML = '';
  [0.25,0.5,0.75,1].forEach(function(f){
    var pts = radarAxes.map(function(_,i){
      var a = (Math.PI*2*i/n) - Math.PI/2;
      return [(cx+r*f*Math.cos(a)).toFixed(1),(cy+r*f*Math.sin(a)).toFixed(1)].join(',');
    }).join(' ');
    var poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    poly.setAttribute('points',pts); poly.setAttribute('fill','none');
    poly.setAttribute('stroke','#E2E8F0'); poly.setAttribute('stroke-width','1');
    svg.appendChild(poly);
  });
  radarAxes.forEach(function(_,i){
    var a = (Math.PI*2*i/n) - Math.PI/2;
    var line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',cx); line.setAttribute('y1',cy);
    line.setAttribute('x2',(cx+r*Math.cos(a)).toFixed(1)); line.setAttribute('y2',(cy+r*Math.sin(a)).toFixed(1));
    line.setAttribute('stroke','#E2E8F0'); line.setAttribute('stroke-width','1');
    svg.appendChild(line);
  });
  var scores = radarAxes.map(function(ax){ return getAxisScore(ax.key)/100; });
  var dataPts = scores.map(function(s,i){
    var a = (Math.PI*2*i/n) - Math.PI/2;
    return [(cx+r*s*Math.cos(a)).toFixed(1),(cy+r*s*Math.sin(a)).toFixed(1)].join(',');
  }).join(' ');
  var dataPoly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
  dataPoly.setAttribute('points',dataPts); dataPoly.setAttribute('fill','rgba(10,31,61,.12)');
  dataPoly.setAttribute('stroke','#0A1F3D'); dataPoly.setAttribute('stroke-width','2');
  svg.appendChild(dataPoly);
  radarAxes.forEach(function(ax,i){
    var s = scores[i];
    var a = (Math.PI*2*i/n) - Math.PI/2;
    var x = cx+r*s*Math.cos(a), y = cy+r*s*Math.sin(a);
    var dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx',x.toFixed(1)); dot.setAttribute('cy',y.toFixed(1));
    dot.setAttribute('r','4'); dot.setAttribute('fill',ax.color);
    dot.setAttribute('stroke','#fff'); dot.setAttribute('stroke-width','1.5');
    svg.appendChild(dot);
    var lx = cx+(r+16)*Math.cos(a), ly = cy+(r+16)*Math.sin(a);
    var txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',lx.toFixed(1)); txt.setAttribute('y',ly.toFixed(1));
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('dominant-baseline','middle');
    txt.setAttribute('font-size','8'); txt.setAttribute('fill','#71869A');
    txt.textContent = ax.label;
    svg.appendChild(txt);
  });
  var legend = document.getElementById('radarLegend');
  if(legend) legend.innerHTML = radarAxes.map(function(ax,i){
    var pct = Math.round(scores[i]*100);
    return '<div class="radar-leg-item"><div class="radar-leg-dot" style="background:'+ax.color+';"></div>'
      +'<div class="radar-leg-info"><div class="radar-leg-name">'+ax.label+'</div>'
      +'<div class="radar-leg-bar"><div class="radar-leg-fill" style="width:'+pct+'%;background:'+ax.color+';"></div></div></div>'
      +'<div class="radar-leg-pct">'+pct+'%</div></div>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   CASH-BURN
══════════════════════════════════════════════════ */
function calcCashBurn() {
  var tres = parseFloat(document.getElementById('cb-tresorerie').value)||0;
  var charges = parseFloat(document.getElementById('cb-charges').value)||1;
  var ca = parseFloat(document.getElementById('cb-ca').value)||0;
  var pct = parseFloat(document.getElementById('cb-pct').value)||0;
  var caLost = ca * pct/100;
  var margin = (ca - caLost) * 0.3;
  var netBurn = charges - margin;
  var months = netBurn > 0 ? Math.floor(tres / netBurn) : 99;
  var el = document.getElementById('cbMonths');
  var det = document.getElementById('cbDetail');
  var warn = document.getElementById('cbWarn');
  if(!el) return;
  el.textContent = months >= 99 ? '∞' : months;
  if(det) det.textContent = 'Perte de CA : ' + Math.round(caLost).toLocaleString('fr') + ' €/mois · Burn rate : ' + (netBurn>0?Math.round(netBurn).toLocaleString('fr'):'0') + ' €/mois';
  if(warn) warn.innerHTML = months < 3 ? '<span class="cb-result-warn">🚨 Risque faillite — action immédiate</span>' : months < 6 ? '<span class="cb-result-warn">⚠️ Marge faible — diversifier urgemment</span>' : '<span class="cb-result-ok">✅ Résilience correcte sur '+months+' mois</span>';
}

/* ══════════════════════════════════════════════════
   PARTNER SCORE
══════════════════════════════════════════════════ */
var partnerData = [];

function renderPartners() {
  var el = document.getElementById('partnerList');
  if(!el) return;
  el.innerHTML = partnerData.map(function(p){
    var sc = p.score < 40 ? '#E24B4A' : p.score < 65 ? '#EF9F27' : '#1D9E75';
    var ini = p.name.split(' ').slice(0,2).map(function(w){return w[0];}).join('').toUpperCase();
    return '<div class="ps-row"><div class="ps-avatar" style="background:'+p.color+';">'+ini+'</div>'
      +'<div class="ps-info"><div class="ps-name">'+p.name+'</div><div class="ps-meta">'+p.type+' · '+p.pct+'% dépendance · délai '+p.payDelay+'j</div></div>'
      +'<div class="ps-score-wrap"><div class="ps-score" style="color:'+sc+';">'+p.score+'</div>'
      +'<div class="ps-score-label">Score risque</div>'
      +'<div class="ps-gauge"><div class="ps-gauge-fill" style="width:'+p.score+'%;background:'+sc+';"></div></div></div></div>';
  }).join('');
}

/* ══════════════════════════════════════════════════
   AI INSIGHTS
══════════════════════════════════════════════════ */
function generateAIInsight(type) { showToast('Analyse IA temporairement indisponible'); }

/* ══════════════════════════════════════════════════
   AI CHAT
══════════════════════════════════════════════════ */
var chatOpen = false;
/* Ajout établissement depuis Mon Compte */
function addEtabFromCompte() {
  var nomEl = document.getElementById('new-etab-nom');
  var villeEl = document.getElementById('new-etab-ville');
  var av2 = document.getElementById('ep-av2');
  var name2 = document.getElementById('ep-name2');
  var detail2 = document.getElementById('ep-detail2');
  var e2 = document.getElementById('ep-e2');
  if(!nomEl || !villeEl || !av2 || !name2 || !detail2 || !e2) { showToast('Erreur : impossible d\'ajouter l\'établissement', true); return; }
  var nom = nomEl.value.trim() || 'Nouvel établissement';
  var ville = villeEl.value.trim() || '—';
  var ini = nom.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
  av2.textContent = ini;
  name2.textContent = nom;
  detail2.textContent = ville + ' · Secondaire';
  e2.style.display = 'flex';
  nomEl.value = '';
  villeEl.value = '';
  showToast('Établissement "' + nom + '" créé — dashboard disponible');
}

/* Init */

/* ── OVERVIEW DATE/TIME ── */
function updateOverviewSub() {
  var el = document.getElementById('overview-sub');
  if (!el) return;
  var now = new Date();
  var dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  var todayStr = dayNames[now.getDay()] + ' ' + now.getDate() + ' ' + monthNames[now.getMonth()] + ' ' + now.getFullYear();
  var h = String(now.getHours()).padStart(2,'0');
  var m = String(now.getMinutes()).padStart(2,'0');
  el.textContent = "Aujourd'hui · " + todayStr + " · " + h + "h" + m;

  try {
    var _sb = getSb();
    if (_sb) {
      _sb.auth.getUser().then(function(res) {
        if (res.data && res.data.user) {
          var lastSign = res.data.user.last_sign_in_at;
          if (lastSign) {
            var d = new Date(lastSign);
            var lastDay = dayNames[d.getDay()];
            var lastDate = d.getDate() + ' ' + monthNames[d.getMonth()];
            var lh = String(d.getHours()).padStart(2,'0');
            var lm = String(d.getMinutes()).padStart(2,'0');
            el.textContent = "Aujourd'hui · " + todayStr + " · " + h + "h" + m + "   ·   Dernière connexion : " + lastDay + " " + lastDate + " à " + lh + "h" + lm;
          }
        }
      });
    }
  } catch(e) {}
}

/* ── MON COMPTE ── */


function loadProfilData() {
  try {
    getSb().auth.getUser().then(function(res) {
      if (!res.data || !res.data.user) return;
      var u = res.data.user;
      var m = u.user_metadata || {};
      var setVal = function(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val || '—';
      };
      var setInp = function(id, val) {
        var el = document.getElementById(id);
        if (el) el.value = val || '';
      };
      setVal('mc-v-prenom', m.prenom);    setInp('mc-i-prenom', m.prenom);
      setVal('mc-v-nom', m.nom);          setInp('mc-i-nom', m.nom);
      setVal('mc-v-email', u.email);      setInp('mc-i-email', u.email);
      setVal('mc-v-entreprise', m.entreprise); setInp('mc-i-entreprise', m.entreprise);
      setVal('mc-v-ville', m.ville);      setInp('mc-i-ville', m.ville);
      setVal('mc-v-secteur', m.secteur);

      /* Avatar initiales — depuis le nom de l'entreprise */
      var initiales = m.entreprise ? m.entreprise.trim().split(/\s+/).slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase() : '—';
      var avEl = document.getElementById('mc-etab-av');
      if (avEl) avEl.textContent = initiales;
      var nameEl = document.getElementById('mc-etab-name');
      if (nameEl) nameEl.textContent = m.entreprise || '—';
      var metaEl = document.getElementById('mc-etab-meta');
      if (metaEl) metaEl.textContent = (m.ville || '—') + ' · ' + (m.secteur || '—');

      /* Nav avatar */
      var navAv = document.getElementById('nav-avatar-txt');
      if (navAv) navAv.textContent = initiales;
      var avmAv = document.getElementById('avm-av');
      if (avmAv) avmAv.textContent = initiales;
      var avmName = document.getElementById('avm-name');
      if (avmName) avmName.textContent = m.entreprise || '';
      var avmSector = document.getElementById('avm-sector');
      if (avmSector) avmSector.textContent = m.secteur || '';
    });
  } catch(e) {}
}

function mcToggleEdit() {
  ['prenom','nom','entreprise','ville','email'].forEach(function(f) {
    document.getElementById('mc-v-'+f).style.display = 'none';
    document.getElementById('mc-i-'+f).style.display = 'block';
  });
  document.getElementById('mc-btn-edit').style.display = 'none';
  document.getElementById('mc-btn-save').style.display = 'inline-block';
}

function mcSaveEdit() {
  var prenom     = document.getElementById('mc-i-prenom').value.trim();
  var nom        = document.getElementById('mc-i-nom').value.trim();
  var entreprise = document.getElementById('mc-i-entreprise').value.trim();
  var ville      = document.getElementById('mc-i-ville').value.trim();
  var newEmail   = document.getElementById('mc-i-email').value.trim();
  var oldEmail   = document.getElementById('mc-v-email').textContent.trim();

  var btn = document.getElementById('mc-btn-save');
  btn.textContent = 'Enregistrement…';
  btn.disabled = true;

  var metaUpdates = { prenom: prenom, nom: nom, entreprise: entreprise, ville: ville };
  var userUpdate = { data: metaUpdates };
  if (newEmail && newEmail !== oldEmail) userUpdate.email = newEmail;

  getSb().auth.updateUser(userUpdate).then(function(res) {
    btn.textContent = 'Enregistrer';
    btn.disabled = false;
    if (res.error) {
      showToast('Erreur : ' + res.error.message, true);
      return;
    }
    /* Update displayed values */
    ['prenom','nom','entreprise','ville','email'].forEach(function(f) {
      var inp = document.getElementById('mc-i-'+f);
      var val = document.getElementById('mc-v-'+f);
      if (val) val.textContent = inp.value || '—';
      if (val) val.style.display = 'block';
      if (inp) inp.style.display = 'none';
    });
    document.getElementById('mc-btn-edit').style.display = 'inline-block';
    document.getElementById('mc-btn-save').style.display = 'none';

    /* Update nav + etablissement */
    var initiales = entreprise ? entreprise.trim().split(/\s+/).slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase() : '—';
    ['nav-avatar-txt','avm-av'].forEach(function(id) {
      var el = document.getElementById(id); if(el) el.textContent = initiales;
    });
    var avmName = document.getElementById('avm-name'); if(avmName) avmName.textContent = entreprise;

    if (newEmail && newEmail !== oldEmail) {
      showToast('Modifications enregistrées — un email de confirmation a été envoyé à ' + newEmail);
    } else {
      showToast('Modifications enregistrées ✓');
    }
  });
}

function mcShowPwdForm() {
  document.getElementById('mc-pwd-view').style.display = 'none';
  document.getElementById('mc-pwd-form').style.display = 'block';
  document.getElementById('mc-pwd-old').value = '';
  document.getElementById('mc-pwd-new').value = '';
  document.getElementById('mc-pwd-confirm').value = '';
  setTimeout(function(){ document.getElementById('mc-pwd-old').focus(); }, 50);
}

function mcHidePwdForm() {
  document.getElementById('mc-pwd-form').style.display = 'none';
  document.getElementById('mc-pwd-view').style.display = 'flex';
}

async function mcSavePwd() {
  var oldPwd  = document.getElementById('mc-pwd-old').value;
  var newPwd  = document.getElementById('mc-pwd-new').value;
  var confirm = document.getElementById('mc-pwd-confirm').value;
  if (!oldPwd) { showToast('Veuillez saisir votre ancien mot de passe', true); return; }
  if (newPwd.length < 8) { showToast('Le nouveau mot de passe doit faire au moins 8 caractères', true); return; }
  if (newPwd !== confirm) { showToast('Les mots de passe ne correspondent pas', true); return; }
  var btn = document.getElementById('mc-pwd-save-btn');
  btn.textContent = 'Enregistrement…'; btn.disabled = true;
  try {
    var sb = getSb();
    var email = document.getElementById('mc-v-email').textContent.trim();
    var checkRes = await sb.auth.signInWithPassword({ email: email, password: oldPwd });
    if (checkRes.error) {
      btn.textContent = 'Enregistrer'; btn.disabled = false;
      showToast('Ancien mot de passe incorrect', true); return;
    }
    var updateRes = await sb.auth.updateUser({ password: newPwd });
    btn.textContent = 'Enregistrer'; btn.disabled = false;
    if (updateRes.error) { showToast('Erreur : ' + updateRes.error.message, true); return; }
    showToast('Mot de passe modifié ✓');
    mcHidePwdForm();
  } catch(e) {
    btn.textContent = 'Enregistrer'; btn.disabled = false;
    showToast('Erreur lors du changement de mot de passe', true);
  }
}

async function loadSubscriptionData() {
  try {
    var sb = getSb();
    if (!sb) return;
    var userRes = await sb.auth.getUser();
    if (!userRes.data || !userRes.data.user) return;
    var meta = userRes.data.user.user_metadata || {};
    var months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    if (meta.subscription_end) {
      var d = new Date(meta.subscription_end);
      var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
      var renewEl = document.getElementById('mc-plan-renew');
      var resilDate = document.getElementById('mc-resil-date');
      if (renewEl) renewEl.textContent = 'Renouvellement le ' + dateStr;
      if (resilDate) resilDate.textContent = dateStr;
    }
    if (meta.plan) {
      var planName = document.getElementById('mc-plan-name');
      if (planName) planName.textContent = meta.plan;
    }
  } catch(e) {}
}


/* ── MODALE RÉSILIATION ── */
function openResilModal() {
  var overlay = document.getElementById('resilOverlay');
  if(overlay) { overlay.style.display = 'flex'; }
  /* Reset */
  var radios = document.querySelectorAll('input[name="resil-reason"]');
  radios.forEach(function(r){ r.checked = false; });
  var comment = document.getElementById('resil-comment');
  if(comment) comment.value = '';
}

function closeResilModal() {
  var overlay = document.getElementById('resilOverlay');
  if(overlay) overlay.style.display = 'none';
}

function closeResilModalOutside(e) {
  if(e.target === document.getElementById('resilOverlay')) closeResilModal();
}

function submitResiliation() {
  var checked = document.querySelector('input[name="resil-reason"]:checked');
  if(!checked) { showToast('Veuillez sélectionner une raison', true); return; }
  var raison = checked.value;
  var comment = (document.getElementById('resil-comment').value || '').trim();
  var email = document.getElementById('mc-v-email') ? document.getElementById('mc-v-email').textContent.trim() : '—';
  var entreprise = document.getElementById('mc-v-entreprise') ? document.getElementById('mc-v-entreprise').textContent.trim() : '—';
  var now = new Date();
  var dateStr = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});

  var btn = document.querySelector('#resilOverlay button[onclick="submitResiliation()"]');
  if(btn) { btn.textContent = 'Envoi…'; btn.disabled = true; }

  fetch('https://formspree.io/f/VOTRE_ID_FORMSPREE', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: 'Résiliation Clearisk — ' + entreprise,
      entreprise: entreprise,
      email: email,
      raison: raison,
      commentaire: comment || '(aucun)',
      date: dateStr
    })
  })
  .then(function(res) {
    closeResilModal();
    if(res.ok) {
      showToast('Demande envoyée — nous vous contacterons sous 24h');
    } else {
      showToast('Demande enregistrée — nous vous contacterons sous 24h');
    }
    setTimeout(function(){ try { handleLogout(); } catch(e) {} }, 3000);
  })
  .catch(function() {
    closeResilModal();
    showToast('Demande enregistrée — nous vous contacterons sous 24h');
    setTimeout(function(){ try { handleLogout(); } catch(e) {} }, 3000);
  });
}

/* ── FACTURES LOADER ── */
async function loadFactures() {
  var list = document.getElementById('factures-list');
  var sub = document.getElementById('factures-sub');
  if (!list) return;

  list.innerHTML = '<div style="padding:3rem 0;text-align:center;color:#94A3B8;font-size:12px;">Chargement de vos factures…</div>';

  function escFac(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(val) {
    if (!val) return '—';
    var d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    var months = ['jan.','fév.','mar.','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatAmount(val) {
    if (!val && val !== 0) return '—';
    var n = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(n)) return String(val);
    /* Stripe renvoie parfois en centimes */
    if (n > 1000 && Number.isInteger(n)) n = n / 100;
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  async function doLoad() {
    try {
      var sb = getSb();
      if (!sb) throw new Error('non_connecte');

      var sessionRes = await sb.auth.getSession();
      var token = sessionRes.data && sessionRes.data.session ? sessionRes.data.session.access_token : null;
      if (!token) throw new Error('session_expiree');

      var res = await fetch('https://ycakrdaxsvxbdcvpfygq.supabase.co/functions/v1/stripe-invoices', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      });

      var json = await res.json();
      if (json.error) throw new Error('api_error');

      var invoices = json.invoices || [];

      if (sub) sub.textContent = invoices.length + ' facture' + (invoices.length > 1 ? 's' : '') + ' · Clearisk';

      if (invoices.length === 0) {
        list.innerHTML = '<div style="padding:3rem 0;text-align:center;color:#94A3B8;font-size:13px;">Aucune facture pour le moment.</div>';
        return;
      }

      list.innerHTML = invoices.map(function(inv) {
        return '<div class="fac-row">'
          + '<div class="fac-ref">' + escFac(inv.number || inv.id) + '</div>'
          + '<div class="fac-label">' + escFac(inv.description || '—') + '</div>'
          + '<div class="fac-date">' + formatDate(inv.date) + '</div>'
          + '<div class="fac-amount">' + formatAmount(inv.amount) + '</div>'
          + '<div>'
          + (inv.pdf
            ? '<a href="' + escFac(inv.pdf) + '" target="_blank" rel="noopener" class="fac-dl"><svg viewBox="0 0 16 16"><path d="M8 2v8M5 7l3 3 3-3M3 13h10"/></svg>PDF</a>'
            : '<span style="font-size:11px;color:#94A3B8;">—</span>')
          + '</div>'
          + '</div>';
      }).join('');

    } catch (err) {
      if (sub) sub.textContent = 'Historique de vos paiements Clearisk';
      list.innerHTML = '<div style="padding:3rem 0;text-align:center;color:#94A3B8;font-size:13px;">'
        + 'Impossible de charger vos factures.<br>'
        + '<button onclick="loadFactures()" style="margin-top:14px;font-size:11px;color:#0A1F3D;padding:6px 14px;border:1px solid #E2E8F0;border-radius:6px;background:#fff;cursor:pointer;font-family:inherit;">Réessayer</button>'
        + '</div>';
    }
  }

  await doLoad();
}

/* ══════════════════════════════════════════════════
   SUPABASE — CHARGEMENT ET SAUVEGARDE DES DONNÉES
══════════════════════════════════════════════════ */

async function sbLoadAllData() {
  var sb = getSb();
  if(!sb) return;
  try {
    var user = await sb.auth.getUser();
    if(!user.data || !user.data.user) return;
    var uid = user.data.user.id;

    /* Secteur depuis user_metadata */
    var meta = user.data.user.user_metadata || {};
    if(meta.secteur) {
      var sectorMap = {'Restauration':'restauration','Commerce':'commerce','Garage':'garage'};
      ACCOUNT_SECTOR = sectorMap[meta.secteur] || 'restauration';
    }
    var resRisks = await sb.from('risks').select('*').eq('user_id', uid);
    if(resRisks.data && resRisks.data.length > 0) {
      var lvlColors = CK.levelColors;
      riskData = resRisks.data.map(function(r) {
        return {
          id: r.id, name: r.name, cat: r.cat, level: r.level,
          status: r.status, date: r.created_at ? r.created_at.slice(0,10) : '',
          source: 'db', color: lvlColors[r.level]||'#94A3B8',
          impact: r.impact||1, proba: r.proba||1, desc: r.desc||''
        };
      });
      /* Reconstituer modalMeta depuis les descriptions */
      riskData.forEach(function(r) {
        if(r.desc) {
          if(!modalMeta[r.id]) modalMeta[r.id] = {};
          modalMeta[r.id].desc = r.desc;
        }
      });
    }

    /* Actions */
    var resActions = await sb.from('actions').select('*').eq('user_id', uid);
    if(resActions.data && resActions.data.length > 0) {
      var dueLabels = {week:'Cette semaine',month:'Ce mois',quarter:'Ce trimestre',year:'Cette année',done:'Fait'};
      actionData = resActions.data.map(function(a) {
        return {
          id: a.id, name: a.name, risk: a.risk||'', cat: a.cat||'',
          priority: a.priority||'normal', due: a.due||'month',
          dueLabel: dueLabels[a.due]||a.due||'Ce mois', done: a.done||false,
          note: a.note||'', // BUG#2 FIX — recharge les remarques depuis Supabase
          riskId: a.risk_id||null, // BUG#3 FIX — recharge l'ID du risque lié
          _sbSaved: true
        };
      });
    }

    /* Contrôles */
    var resCtrls = await sb.from('controls').select('*').eq('user_id', uid);
    if(resCtrls.data && resCtrls.data.length > 0) {
      ctrlData = resCtrls.data.map(function(c) {
        return {
          id: c.id, nom: c.nom, cat: c.cat||'', niveau: c.niveau||'1',
          freq: c.freq||'mensuel', resp: c.resp||'—',
          statut: c.statut||'nonplanifie',
          dernierDate: c.dernier_date||'—', note: c.note||'',
          riskId: c.risk_id||null, risk: c.risk||null,
          _sbSaved: true
        };
      });
    }

    /* Score history */
    var resScore = await sb.from('score_history').select('*').eq('user_id', uid).order('created_at', {ascending: true});
    if(resScore.data && resScore.data.length > 0) {
      scoreHistory = resScore.data.map(function(s) {
        return {month: s.month, val: s.val, delta: s.delta||null, label: s.month, current: false};
      });
      if(scoreHistory.length > 0) scoreHistory[scoreHistory.length-1].current = true;
    }

    /* Historique */
    var resHisto = await sb.from('history').select('*').eq('user_id', uid).order('created_at', {ascending: false});
    if(resHisto.data && resHisto.data.length > 0) {
      var dotMap = {
        action:  {bg:'#EAFAF3', color:'#1D9E75'},
        risque:  {bg:'#FDEAEA', color:'#E24B4A'},
        alerte:  {bg:'#FEF3E2', color:'#EF9F27'},
        score:   {bg:'#EBF4FF', color:'#1A5CAB'}
      };
      histoData = resHisto.data.map(function(h) {
        var dots = dotMap[h.type] || {bg:'#F4F6F9', color:'#94A3B8'};
        return {
          type: h.type, date: h.date_label||'', month: h.month||'',
          title: h.title, desc: h.desc||'',
          dotBg: dots.bg, dotColor: dots.color,
          scoreVal: h.score_val||null, scoreDelta: h.score_delta||null
        };
      });
    }

  } catch(e) {
    showToast('Erreur de connexion, réessayez.', true);
  }

  /* ── Sauvegarde automatique du score mensuel ──
     FIX : le score du mois courant est toujours mis à jour (upsert)
     pour refléter l'état réel des risques à tout moment.
     Le delta est calculé par rapport au mois précédent. */
  try {
    var monthNames2 = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
    var nowDate = new Date();
    var currentMonth = monthNames2[nowDate.getMonth()] + ' ' + nowDate.getFullYear();
    if(riskData.length > 0 || actionData.length > 0 || ctrlData.length > 0) {
      var currentScore = calcScoreDynamic();
      // Delta par rapport au mois précédent uniquement (pas par rapport au début du mois courant)
      var prevEntry = scoreHistory.filter(function(s){ return s.month !== currentMonth; });
      var prevVal2 = prevEntry.length > 0 ? prevEntry[prevEntry.length-1].val : null;
      var delta2 = prevVal2 !== null ? (currentScore - prevVal2) : null;
      var deltaStr2 = delta2 !== null ? String(delta2) : null;
      // Mise à jour en RAM
      var existingIdx = scoreHistory.findIndex ? scoreHistory.findIndex(function(s){ return s.month === currentMonth; }) : -1;
      if(existingIdx >= 0) {
        scoreHistory[existingIdx].val = currentScore;
        scoreHistory[existingIdx].delta = deltaStr2;
      } else {
        if(scoreHistory.length > 0) scoreHistory[scoreHistory.length-1].current = false;
        scoreHistory.push({month: currentMonth, val: currentScore, delta: deltaStr2, label: currentMonth, current: true});
      }
      // Upsert en base (sbSaveScore utilise maintenant upsert)
      await sbSaveScore(currentMonth, currentScore, deltaStr2);
    }
  } catch(e2) {
    /* score non sauvegardé — pas bloquant pour le client */
  }
}

async function sbSaveRisk(r) {
  var sb = getSb(); if(!sb) return;
  var user = await sb.auth.getUser();
  if(!user.data || !user.data.user) return;
  var uid = user.data.user.id;
  if(!r.id) r.id = genId();
  var payload = {id:r.id, user_id:uid, name:r.name, cat:r.cat, level:r.level, status:r.status, impact:r.impact||1, proba:r.proba||1, desc:r.desc||''};
  await sb.from('risks').upsert(payload);
  r._sbSaved = true;
}

async function sbDeleteRisk(id) {
  var sb = getSb(); if(!sb) return;
  await sb.from('risks').delete().eq('id', id);
}

async function sbSaveHistory(entry) {
  // Pousser immédiatement dans histoData local pour affichage instantané
  var dotMap2 = {
    action:  {bg:'#EAFAF3', color:'#1D9E75'},
    risque:  {bg:'#FDEAEA', color:'#E24B4A'},
    alerte:  {bg:'#FEF3E2', color:'#EF9F27'},
    score:   {bg:'#EBF4FF', color:'#1A5CAB'}
  };
  var now2 = new Date();
  var mois2 = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var dots2 = dotMap2[entry.type] || {bg:'#F4F6F9', color:'#94A3B8'};
  histoData.unshift({
    type: entry.type,
    date: ('0'+now2.getDate()).slice(-2)+'/'+('0'+(now2.getMonth()+1)).slice(-2)+'/'+now2.getFullYear(),
    month: mois2[now2.getMonth()] + ' ' + now2.getFullYear(),
    title: entry.title,
    desc: entry.desc||'',
    dotBg: dots2.bg, dotColor: dots2.color,
    scoreVal: entry.scoreVal||null, scoreDelta: entry.scoreDelta||null
  });
  if(typeof renderHisto === 'function' && document.getElementById('page-histo') && document.getElementById('page-histo').style.display !== 'none') renderHisto();

  // Sauvegarder en Supabase
  var sb = getSb(); if(!sb) return;
  var user = await sb.auth.getUser();
  if(!user.data || !user.data.user) return;
  var uid = user.data.user.id;
  var now = new Date();
  var mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  await sb.from('history').insert({
    id: genId(),
    user_id: uid,
    type: entry.type,
    title: entry.title,
    desc: entry.desc||'',
    month: mois[now.getMonth()] + ' ' + now.getFullYear(),
    date_label: ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+now.getFullYear(),
    score_val: entry.scoreVal||null,
    score_delta: entry.scoreDelta||null
  });
}

async function sbSaveScore(month, val, delta) {
  var sb = getSb(); if(!sb) return;
  var user = await sb.auth.getUser();
  if(!user.data || !user.data.user) return;
  var uid = user.data.user.id;
  // FIX : upsert sur (user_id, month) — met à jour le score du mois en cours à chaque modification
  var existing = await sb.from('score_history').select('id').eq('user_id', uid).eq('month', month).maybeSingle();
  var rowId = (existing && existing.data && existing.data.id) ? existing.data.id : genId();
  await sb.from('score_history').upsert({id: rowId, user_id: uid, month: month, val: val, delta: delta||null});
}

async function sbSaveModalMeta(riskId, desc) {
  var sb = getSb(); if(!sb) return;
  await sb.from('risks').update({desc: desc}).eq('id', riskId);
}

async function sbSaveAction(a) {
  var sb = getSb(); if(!sb) return;
  var user = await sb.auth.getUser();
  if(!user.data || !user.data.user) return;
  var uid = user.data.user.id;
  if(!a.id) a.id = genId();
  var payload = {id:a.id, user_id:uid, name:a.name, risk:a.risk||'', cat:a.cat||'', priority:a.priority||'normal', due:a.due||'month', done:a.done||false, note:a.note||'', risk_id:a.riskId||null}; // BUG#2+BUG#3 FIX
  await sb.from('actions').upsert(payload);
  a._sbSaved = true;
}

async function sbSaveControl(c) {
  var sb = getSb(); if(!sb) return;
  var user = await sb.auth.getUser();
  if(!user.data || !user.data.user) return;
  var uid = user.data.user.id;
  if(!c.id) c.id = genId();
  var payload = {id:c.id, user_id:uid, nom:c.nom, cat:c.cat||'', freq:c.freq||'mensuel', resp:c.resp||'—', statut:c.statut||'nonplanifie', dernier_date:c.dernierDate||'—', note:c.note||'', risk_id:c.riskId||null, risk:c.risk||null};
  await sb.from('controls').upsert(payload);
  c._sbSaved = true;
}

/* ── MENU MOBILE HAMBURGER ── */
function toggleMobileMenu() {
  var sidebar = document.getElementById('mainSidebar');
  var overlay = document.getElementById('mobileOverlay');
  var btn = document.getElementById('navHamburger');
  if(!sidebar) return;
  var isOpen = sidebar.classList.contains('mobile-open');
  if(isOpen) {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('open');
    btn.classList.remove('open');
  } else {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('open');
    btn.classList.add('open');
  }
}
function closeMobileMenu() {
  var sidebar = document.getElementById('mainSidebar');
  var overlay = document.getElementById('mobileOverlay');
  var btn = document.getElementById('navHamburger');
  if(sidebar) sidebar.classList.remove('mobile-open');
  if(overlay) overlay.classList.remove('open');
  if(btn) btn.classList.remove('open');
}

/* ── TOUCHE ECHAP — ferme toute fenêtre ouverte ── */
document.addEventListener('keydown', function(e) {
  if(e.key !== 'Escape') return;
  // Ordre de priorité : du plus récent au plus ancien
  if(document.getElementById('confirmActionOverlay') && document.getElementById('confirmActionOverlay').classList.contains('open')) { closeConfirmAction(); return; }
  if(document.getElementById('confirmOverlay') && document.getElementById('confirmOverlay').classList.contains('open')) { closeConfirm(); return; }
  if(document.getElementById('ctrlOverlayConfirm') && document.getElementById('ctrlOverlayConfirm').classList.contains('open')) { ctrl_closeConfirm(); return; }
  if(document.getElementById('ctrlOverlayEdit') && document.getElementById('ctrlOverlayEdit').classList.contains('open')) { document.getElementById('ctrlOverlayEdit').classList.remove('open'); return; }
  if(document.getElementById('ctrlOverlayAdd') && document.getElementById('ctrlOverlayAdd').classList.contains('open')) { ctrl_closeAdd(); return; }
  if(document.getElementById('ctrlOverlayVal') && document.getElementById('ctrlOverlayVal').classList.contains('open')) { ctrl_closeVal(); return; }
  if(document.getElementById('addRiskOverlay') && document.getElementById('addRiskOverlay').classList.contains('open')) { closeAddRisk(); return; }
  if(document.getElementById('actionAddOverlay') && document.getElementById('actionAddOverlay').classList.contains('open')) { closeAddAction(); return; }
  if(document.getElementById('actionEditOverlay') && document.getElementById('actionEditOverlay').classList.contains('open')) { closePanel(); return; }
  if(document.getElementById('modalOverlay') && document.getElementById('modalOverlay').classList.contains('open')) { closeModal(); return; }
  if(document.getElementById('resilOverlay') && document.getElementById('resilOverlay').style.display === 'flex') { closeResilModal(); return; }
  if(document.getElementById('invoiceOverlay') && document.getElementById('invoiceOverlay').classList.contains('open')) { closeInvoice(); return; }
});

/* ── Hook debounce vers la vraie fonction renderDashboard ── */
_renderDashboardFn = _renderDashboardReal;

window.addEventListener('load', async function(){
  loadProfilData();
  await sbLoadAllData();
  renderDashboard();
  renderCartoFilterPills();
  riskData.forEach(function(r) {
    r._sbSaved = true;
    if(!modals[r.id]) {
      var dbRef = (CLEARISK_DB['restauration']||[]).find(function(d){return d.id===r.id;});
      if(dbRef) buildModalFromDB(r.id, dbRef);
    }
  });
  actionData.forEach(function(a){
    a._sbSaved = true;
    if(!a.riskColor) {
      var lvlColors2 = CK.levelColors;
      var matchRisk = riskData.find(function(r){ return r.name === a.risk; });
      a.riskColor = matchRisk ? (lvlColors2[matchRisk.level]||'#94A3B8') : '#94A3B8';
    }
  });
  ctrlData.forEach(function(c){ c._sbSaved = true; });
});


/* ── AVATAR MENU ── */
function toggleAvatarMenu(e) {
  e.stopPropagation();
  var menu = document.getElementById('avatarMenu');
  menu.classList.toggle('open');
}
function closeAvatarMenu() {
  var menu = document.getElementById('avatarMenu');
  if(menu) menu.classList.remove('open');
}
/* closeAvatarMenu géré par listener global */


/* ── NOTIFICATIONS ── */
var notifRead = {};

function generateNotifs() {
  var notifs = [];

  // Risques critiques non traités
  riskData.forEach(function(r) {
    if(r.level === 'critique' && r.status !== 'Traité') {
      notifs.push({
        id: 'risk_' + r.id,
        type: 'critique',
        color: '#E24B4A',
        text: '<strong>' + escHtml(r.name) + '</strong> — risque critique sans plan d\'action.',
        time: 'Aujourd\'hui',
        action: 'Ajouter une action',
        onclick: "closeNotifPanel();showPage('risques',document.getElementById('nav-risques'));setTimeout(function(){openRiskModal('" + r.id + "');setTimeout(function(){switchRmTab('actions');},120);},200);"
      });
    }
  });

  // Actions urgentes non faites
  actionData.forEach(function(a) {
    if(a.priority === 'urgent' && !a.done) {
      notifs.push({
        id: 'action_' + a.id,
        type: 'urgent',
        color: '#EF9F27',
        text: '<strong>' + escHtml(a.name) + '</strong> — action urgente en attente.',
        time: 'Cette semaine',
        action: 'Voir le plan',
        onclick: "closeNotifPanel();showPage('actions',document.getElementById('nav-actions'));"
      });
    }
  });

  // Contrôles en retard ou non conformes
  ctrlData.forEach(function(c) {
    if(c.statut === 'retard' || c.statut === 'nonconforme') {
      notifs.push({
        id: 'ctrl_late_' + c.id,
        type: 'ctrl_late',
        color: '#E24B4A',
        text: '<strong>' + escHtml(c.nom) + '</strong> — contrôle ' + (c.statut === 'retard' ? 'en retard' : 'non conforme') + '.',
        time: 'Aujourd\'hui',
        action: 'Voir le contrôle',
        onclick: "closeNotifPanel();showPage('controles',document.getElementById('nav-controles'));"
      });
    }
  });

  // Contrôles à vérifier
  ctrlData.forEach(function(c) {
    if(c.statut === 'averifier') {
      notifs.push({
        id: 'ctrl_check_' + c.id,
        type: 'ctrl_check',
        color: '#EF9F27',
        text: '<strong>' + escHtml(c.nom) + '</strong> — contrôle à vérifier.',
        time: 'Cette semaine',
        action: 'Vérifier',
        onclick: "closeNotifPanel();showPage('controles',document.getElementById('nav-controles'));"
      });
    }
  });

  // Score en baisse — uniquement si scoreHistory a au moins 2 points réels
  if(scoreHistory.length >= 2) {
    var lastVal = scoreHistory[scoreHistory.length-1].val;
    var prevVal = scoreHistory[scoreHistory.length-2].val;
    var diff = lastVal - prevVal;
    if(diff < 0) {
      notifs.push({
        id: 'score_down',
        type: 'score',
        color: '#4A90D9',
        text: 'Votre score de résilience a baissé de <strong>' + Math.abs(diff) + ' pts</strong> ce mois-ci.',
        time: 'Ce mois',
        action: 'Voir le tableau de bord',
        onclick: "closeNotifPanel();showPage('overview',document.getElementById('nav-overview'));"
      });
    }
  }

  return notifs.slice(0, 10);
}


function renderNotifPanel() {
  var notifs = generateNotifs();
  var unread = notifs.filter(function(n) { return !notifRead[n.id]; }).length;
  var badge = document.getElementById('notifBadge');
  if(badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  var list = document.getElementById('notifList');
  if(!list) return;
  if(notifs.length === 0) {
    list.innerHTML = '<div class="notif-empty">Aucune notification — tout est à jour ✓</div>';
    return;
  }
  list.innerHTML = '';
  notifs.forEach(function(n) {
    var isUnread = !notifRead[n.id];
    var div = document.createElement('div');
    div.className = 'notif-item' + (isUnread ? ' unread' : '');
    div.innerHTML = '<div class="notif-dot-wrap"><div class="notif-dot" style="background:' + n.color + ';opacity:' + (isUnread ? '1' : '0.3') + ';"></div></div>'
      + '<div class="notif-body">'
      + '<div class="notif-text">' + n.text + '</div>'
      + '<div class="notif-time">' + n.time + '</div>'
      + '<button class="notif-action-btn">' + escHtml(n.action) + '</button>'
      + '</div>';
    var btn = div.querySelector('.notif-action-btn');
    (function(notif) {
      btn.addEventListener('click', function() {
        markNotifRead(notif.id);
        var fn = new Function(notif.onclick);
        fn();
      });
    })(n);
    list.appendChild(div);
  });
}

function toggleNotifPanel(e) {
  e.stopPropagation();
  closeAvatarMenu();
  var panel = document.getElementById('notifPanel');
  var isOpen = panel.classList.contains('open');
  panel.classList.toggle('open');
  if(!isOpen) {
    // Marquer toutes les notifs comme lues dès l'ouverture → badge à 0
    var notifs = generateNotifs();
    notifs.forEach(function(n) { notifRead[n.id] = true; });
    renderNotifPanel();
  }
}

function closeNotifPanel() {
  var panel = document.getElementById('notifPanel');
  if(panel) panel.classList.remove('open');
}

function markNotifRead(id) {
  notifRead[id] = true;
  renderNotifPanel();
}

function clearAllNotifs() {
  var notifs = generateNotifs();
  notifs.forEach(function(n) { notifRead[n.id] = true; });
  renderNotifPanel();
}

/* closeNotifPanel géré par listener global */


/* ── WELCOME OVERLAY ── */
(function() {
  var overlay = document.getElementById('welcomeOverlay');
  var companyEl = document.getElementById('welcomeCompany');
  if (!overlay) return;

  // Remove overlay from DOM after animation ends
  overlay.addEventListener('animationend', function(e) {
    if (e.animationName === 'wFadeOut') {
      overlay.remove();
    }
  });

  // Try to get company name from Supabase
  try {
    var _sb = getSb();
    if (_sb) {
      _sb.auth.getUser().then(function(res) {
        if (res.data && res.data.user && res.data.user.user_metadata) {
          var name = res.data.user.user_metadata.entreprise;
          if (name && companyEl) companyEl.textContent = name;
        }
      });
    }
  } catch(e) {}
})();


/* ══════════════════════════════════════════════════
   DONNÉES
══════════════════════════════════════════════════ */

var ctrlData = [];

var activeNiveau='tous', activeFreq='tous', activeStatut='tous', valCtrlId=null;
var histData={}; /* {ctrlId: [{date, statut, note, resp}]} */

var FREQ_DAYS={quotidien:1,hebdomadaire:7,mensuel:30,trimestriel:90,semestriel:180,annuel:365};
var FREQ_LABEL={quotidien:'Quotidien',hebdomadaire:'Hebdomadaire',mensuel:'Mensuel',trimestriel:'Trimestriel',semestriel:'Semestriel',annuel:'Annuel'};
var NIV_BADGE={'1':'<span class="lvl-1">Niv. 1</span>','2':'<span class="lvl-2">Niv. 2</span>','3':'<span class="lvl-3">Niv. 3</span>'};
var STATUT_BADGE={conforme:'<span class="badge b-ok">Conforme</span>',averifier:'<span class="badge b-warn">À vérifier</span>',retard:'<span class="badge b-late">En retard</span>',nonconforme:'<span class="badge b-late">Non conforme</span>',nonplanifie:'<span class="badge b-np">Non planifié</span>'};
var DOT_COLOR={conforme:'#1D9E75',averifier:'#EF9F27',retard:'#E24B4A',nonconforme:'#E24B4A',nonplanifie:'#94A3B8'};

function ctrl_calcProchaine(c){
  if(!c.dernierDate||c.dernierDate==='—') return {label:'À planifier',color:'#94A3B8',urgent:false};
  var p=c.dernierDate.split('/');
  if(p.length!==3) return {label:'À planifier',color:'#94A3B8',urgent:false};
  var next=new Date(p[2],p[1]-1,p[0]);
  next.setDate(next.getDate()+(FREQ_DAYS[c.freq]||30));
  var diff=Math.round((next-new Date())/86400000);
  var ds=('0'+next.getDate()).slice(-2)+'/'+('0'+(next.getMonth()+1)).slice(-2)+'/'+next.getFullYear();
  if(diff<0)  return {label:'En retard de '+Math.abs(diff)+'j',color:'#E24B4A',urgent:true};
  if(diff<=7) return {label:ds+' · J-'+diff,color:'#E24B4A',urgent:true};
  if(diff<=14)return {label:ds,color:'#EF9F27',urgent:false};
  return {label:ds,color:'#71869A',urgent:false};
}

/* ── ÉDITION CONTRÔLE ── */
function ctrl_openEdit(id){
  var c = ctrlData.find(function(x){return x.id===id;});
  if(!c) return;
  document.getElementById('edit-ctrl-id').value = id;
  document.getElementById('edit-nom').value = c.nom||'';
  document.getElementById('edit-niveau').value = c.niveau||'1';
  document.getElementById('edit-freq').value = c.freq||'mensuel';
  document.getElementById('edit-resp').value = c.resp||'';
  document.getElementById('edit-cat').value = c.cat||'Autre';
  document.getElementById('edit-desc').value = c.note||'';
  var riskSel = document.getElementById('edit-risk');
  riskSel.innerHTML = '<option value="">— Aucun risque associé —</option>';
  riskData.forEach(function(r){ riskSel.innerHTML += '<option value="'+r.id+'"'+(c.riskId===r.id?' selected':'')+'>'+escHtml(r.name)+'</option>'; });
  document.getElementById('ctrlOverlayEdit').classList.add('open');
}
function ctrl_closeEdit(){
  document.getElementById('ctrlOverlayEdit').classList.remove('open');
}
function ctrl_saveEdit(){
  var id = document.getElementById('edit-ctrl-id').value;
  var c = ctrlData.find(function(x){return x.id===id;});
  if(!c) return;
  var nom = document.getElementById('edit-nom').value.trim();
  if(!nom) return showToast('Le nom est obligatoire');
  c.nom = nom;
  c.niveau = document.getElementById('edit-niveau').value;
  c.freq = document.getElementById('edit-freq').value;
  c.resp = document.getElementById('edit-resp').value.trim().toUpperCase();
  c.cat = document.getElementById('edit-cat').value||'Autre';
  c.note = document.getElementById('edit-desc').value.trim();
  var riskId = document.getElementById('edit-risk').value;
  if(riskId){ c.riskId=riskId; var r=riskData.find(function(x){return x.id===riskId;}); if(r) c.risk=r.name; }
  else { c.riskId=null; c.risk=null; }
  sbSaveControl(c);
  ctrl_closeEdit();
  ctrl_render();
  renderDashboard();
  showToast('Contrôle mis à jour ✓');
}

/* ── PLANIFIER CONTRÔLE ── */
var _planCtrlId = null;
function ctrl_openPlanifier(id){
  _planCtrlId = id;
  var c = ctrlData.find(function(x){return x.id===id;});
  if(!c) return;
  if(document.getElementById('plan-ctrl-name')) document.getElementById('plan-ctrl-name').textContent = c.nom+' · '+(FREQ_LABEL[c.freq]||c.freq);
  var today = new Date();
  if(document.getElementById('plan-date')) document.getElementById('plan-date').value = today.getFullYear()+'-'+pad2(today.getMonth()+1)+'-'+pad2(today.getDate());
  if(document.getElementById('plan-by')) document.getElementById('plan-by').value = '';
  if(document.getElementById('plan-note')) document.getElementById('plan-note').value = '';
  var el = document.getElementById('ctrlOverlayPlan');
  if(el) el.classList.add('open');
}
function ctrl_closePlanifier(){
  var el = document.getElementById('ctrlOverlayPlan');
  if(el) el.classList.remove('open');
  _planCtrlId = null;
}
function ctrl_confirmPlanifier(){
  var dateVal = document.getElementById('plan-date') ? document.getElementById('plan-date').value : '';
  var by = document.getElementById('plan-by') ? document.getElementById('plan-by').value.trim().toUpperCase() : '';
  if(!dateVal) return showToast('Veuillez choisir une date');
  if(!by) return showToast('Veuillez saisir vos initiales');
  var c = ctrlData.find(function(x){return x.id===_planCtrlId;});
  if(!c) return;
  var d = new Date(dateVal);
  c.dernierDate = pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear();
  c.statut = 'conforme';
  if(document.getElementById('plan-note')) c.note = document.getElementById('plan-note').value.trim();
  sbSaveControl(c);
  sbSaveHistory({type:'action', title:'Contrôle planifié — '+c.nom, desc:'Premier passage le '+c.dernierDate+' · Validé par '+by});
  ctrl_closePlanifier();
  ctrl_render();
  renderDashboard();
  showToast('Contrôle planifié ✓');
}

function pad2(n){ return n<10?'0'+n:String(n); }

function ctrl_filterPill(statut) {
  activeStatut = statut;
  ['tous','retard','averifier','conforme'].forEach(function(k) {
    var btn = document.getElementById('ctrl-f-'+k);
    if(btn) { btn.style.background = k===statut?'#0A1F3D':'#fff'; btn.style.color = k===statut?'#fff':'#64748B'; }
  });
  ctrl_render();
}

function ctrl_render(){
  var filtered=ctrlData.filter(function(c){
    var nOk=activeNiveau==='tous'||c.niveau===activeNiveau;
    var fOk=activeFreq==='tous'||c.freq===activeFreq;
    var sOk=true;
    if(activeStatut==='retard') sOk=c.statut==='retard'||c.statut==='nonconforme';
    else if(activeStatut==='averifier') sOk=c.statut==='averifier';
    else if(activeStatut==='conforme')  sOk=c.statut==='conforme';
    return nOk&&fOk&&sOk;
  });
  var groups={retard:[],averifier:[],conforme:[],other:[]};
  filtered.forEach(function(c){
    if(c.statut==='retard'||c.statut==='nonconforme') groups.retard.push(c);
    else if(c.statut==='averifier') groups.averifier.push(c);
    else if(c.statut==='conforme')  groups.conforme.push(c);
    else                            groups.other.push(c);
  });


  var html=''; var total=0;
  [{key:'retard',label:'En retard'},{key:'averifier',label:'À vérifier'},{key:'conforme',label:'Conformes'},{key:'other',label:'Non planifiés'}]
  .forEach(function(sec){
    var items=groups[sec.key];
    if(!items.length) return;
    html+='<div style="font-size:11px;font-weight:500;color:#94A3B8;letter-spacing:.06em;text-transform:uppercase;margin:16px 0 8px;">'+sec.label+'</div>';
    items.forEach(function(c){
      total++;
      var proch=ctrl_calcProchaine(c);
      var echLabel = proch ? proch.label : 'À planifier';
      var echColor = DOT_CTRL[c.statut]||'#94A3B8';
      var riskLinked = c.risk || (c.riskId ? ((riskData.find(function(r){return r.id===c.riskId;})||{}).name||null) : null);
      var dernierTxt = c.dernierDate&&c.dernierDate!=='—' ? '<span style="color:#94A3B8;"> · Dernier : '+c.dernierDate+'</span>' : '';
      var isNonPlanifie = c.statut==='nonplanifie';
      var actionBtn = '<button onclick="event.stopPropagation();ctrl_openVal(\''+c.id+'\')" style="font-size:11px;padding:4px 12px;border:0.5px solid #E2E8F0;border-radius:5px;background:#fff;color:#0A1F3D;cursor:pointer;white-space:nowrap;flex-shrink:0;">✓ Valider</button>';
      html+='<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:0.5px solid #F1F5F9;cursor:pointer;" onclick="ctrl_openEdit(\''+c.id+'\')">'
        +'<div style="width:8px;height:8px;border-radius:50%;background:'+(DOT_CTRL[c.statut]||'#94A3B8')+';flex-shrink:0;"></div>'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:13px;color:#0A1F3D;font-weight:500;">'+escHtml(c.nom)+'</div>'
        +'<div style="font-size:11px;color:#94A3B8;margin-top:2px;">'+escHtml(c.cat)+' · '+(FREQ_LABEL[c.freq]||c.freq)+escHtml(dernierTxt)+'</div>'
        +'</div>'
        +(riskLinked?'<span style="font-size:11px;color:#94A3B8;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">'+riskLinked+'</span>':'<span style="font-size:11px;color:#CBD5E1;flex:1;">—</span>')
        +'<span style="font-size:11px;font-weight:500;color:'+echColor+';white-space:nowrap;min-width:90px;text-align:right;">'+echLabel+'</span>'
        +'<span style="font-size:11px;font-weight:500;color:'+(SCOL_CTRL[c.statut]||'#94A3B8')+';white-space:nowrap;min-width:80px;text-align:right;">'+(SLBL_CTRL[c.statut]||c.statut)+'</span>'
        +actionBtn
        +'<button onclick="event.stopPropagation();ctrl_delCtrl(\''+c.id+'\')" style="font-size:12px;color:#94A3B8;background:none;border:none;cursor:pointer;padding:4px;flex-shrink:0;" title="Supprimer">✕</button>'
        +'</div>';
    });
  });

  if(!total) html='<div style="font-size:13px;color:#94A3B8;font-style:italic;padding:60px 0;text-align:center;">Aucun contrôle permanent pour le moment.</div>';
  html+='<div style="font-size:11px;color:#94A3B8;margin-top:12px;">'+total+' contrôle(s) sur '+ctrlData.length+'</div>';
  document.getElementById('ctrl-table-wrap').innerHTML=html;

  var late=ctrlData.filter(function(c){return c.statut==='retard'||c.statut==='nonconforme';}).length;
  var warn=ctrlData.filter(function(c){return c.statut==='averifier';}).length;
  var ok  =ctrlData.filter(function(c){return c.statut==='conforme';}).length;
  document.getElementById('ctrl-kpi-late').textContent=late;
  document.getElementById('ctrl-kpi-warn').textContent=warn;
  document.getElementById('ctrl-kpi-ok').textContent=ok;
  document.getElementById('ctrl-kpi-total').textContent=ctrlData.length;

  var subEl=document.getElementById('ctrl-page-sub');
  if(subEl) subEl.textContent='Mis à jour le '+formatDateFr();
}

/* ════════════════════════════════════════
   PANNEAU PROCHAINES ÉCHÉANCES
════════════════════════════════════════ */
var MOIS_LONG=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
var MOIS_COURT=['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];

var _calYear = new Date().getFullYear();
var _calMonth = new Date().getMonth();

function ctrl_openEcheances(){
  _calYear = new Date().getFullYear();
  _calMonth = new Date().getMonth();
  ctrl_renderCalendar();
  ctrl_renderEchList();
  document.getElementById('ctrlEchOverlay').classList.add('open');
  document.getElementById('ctrlEchPanel').classList.add('open');
}

function ctrl_calPrev(){ _calMonth--; if(_calMonth<0){_calMonth=11;_calYear--;} ctrl_renderCalendar(); ctrl_renderEchList(); }
function ctrl_calNext(){ _calMonth++; if(_calMonth>11){_calMonth=0;_calYear++;} ctrl_renderCalendar(); ctrl_renderEchList(); }
function ctrl_calSetMonth(m){ _calMonth=parseInt(m); ctrl_renderCalendar(); ctrl_renderEchList(); }
function ctrl_calSetYear(y){ _calYear=parseInt(y); ctrl_renderCalendar(); ctrl_renderEchList(); }

function ctrl_getNextOccurrences(c, year, month) {
  /* Retourne toutes les dates de ce contrôle dans le mois donné */
  var dates = [];
  if(!c.dernierDate || c.dernierDate==='—') return dates;
  var p = c.dernierDate.split('/');
  if(p.length!==3) return dates;
  var base = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
  var freq = FREQ_DAYS[c.freq]||30;
  var cur = new Date(base);
  var limit = new Date(year, month+1, 15);
  var start = new Date(year, month, 1);
  var iterations = 0;
  while(cur <= limit && iterations < 400) {
    iterations++;
    cur = new Date(base.getTime() + freq * 24*60*60*1000 * iterations);
    if(cur.getFullYear()===year && cur.getMonth()===month) dates.push(new Date(cur));
  }
  return dates;
}

function ctrl_renderCalendar(){
  var MOIS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var JOURS=['L','M','M','J','V','S','D'];
  var moisOpts = MOIS.map(function(m,i){ return '<option value="'+i+'"'+(i===_calMonth?' selected':'')+'>'+m+'</option>'; }).join('');
  var yearCur = new Date().getFullYear();
  var yearOpts = '';
  for(var y=yearCur-1; y<=yearCur+20; y++) yearOpts+='<option value="'+y+'"'+(y===_calYear?' selected':'')+'>'+y+'</option>';
  var navHtml = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
    +'<button onclick="ctrl_calPrev()" style="background:none;border:0.5px solid #E2E8F0;border-radius:5px;cursor:pointer;padding:4px 8px;font-size:12px;color:#94A3B8;">◀</button>'
    +'<select onchange="ctrl_calSetMonth(this.value)" style="font-size:12px;border:0.5px solid #E2E8F0;border-radius:5px;padding:4px 8px;color:#0A1F3D;background:#fff;cursor:pointer;">'+moisOpts+'</select>'
    +'<select onchange="ctrl_calSetYear(this.value)" style="font-size:12px;border:0.5px solid #E2E8F0;border-radius:5px;padding:4px 8px;color:#0A1F3D;background:#fff;cursor:pointer;">'+yearOpts+'</select>'
    +'<button onclick="ctrl_calNext()" style="background:none;border:0.5px solid #E2E8F0;border-radius:5px;cursor:pointer;padding:4px 8px;font-size:12px;color:#94A3B8;">▶</button>'
    +'</div>';
  var firstDay = (new Date(_calYear, _calMonth, 1).getDay()+6)%7;
  var daysInMonth = new Date(_calYear, _calMonth+1, 0).getDate();
  var today = new Date();
  var dayMap = {};
  ctrlData.forEach(function(c){
    ctrl_getNextOccurrences(c, _calYear, _calMonth).forEach(function(d){
      var k = d.getDate();
      if(!dayMap[k]) dayMap[k] = [];
      dayMap[k].push(c.statut);
    });
  });
  var gridHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:8px;">';
  JOURS.forEach(function(j){ gridHtml+='<div style="text-align:center;font-size:10px;color:#94A3B8;padding:4px 0;">'+j+'</div>'; });
  for(var i=0;i<firstDay;i++) gridHtml+='<div></div>';
  for(var d=1;d<=daysInMonth;d++){
    var isToday = today.getDate()===d && today.getMonth()===_calMonth && today.getFullYear()===_calYear;
    var events = dayMap[d]||[];
    var dotColor = events.length>0 ? (events.indexOf('retard')>-1||events.indexOf('nonconforme')>-1 ? '#E24B4A' : events.indexOf('averifier')>-1?'#EF9F27':'#1D9E75') : 'transparent';
    gridHtml+='<div style="text-align:center;padding:4px 2px;">'
      +'<div style="width:26px;height:26px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;'+(isToday?'background:#0A1F3D;color:#fff;font-weight:500;':'color:#0A1F3D;')+'">'+d+'</div>'
      +(events.length>0?'<div style="width:5px;height:5px;border-radius:50%;background:'+dotColor+';margin:2px auto 0;"></div>':'<div style="height:7px;"></div>')
      +'</div>';
  }
  gridHtml+='</div>';
  document.getElementById('ech-calendar').innerHTML = navHtml + gridHtml;
}

function ctrl_renderEchList(){
  var STATUT_LBL={retard:'En retard',nonconforme:'Non conforme',averifier:'À vérifier',conforme:'Conforme',nonplanifie:'Non planifié'};

  /* Regrouper par semaine du mois */
  var weeks = [[], [], [], [], []];
  ctrlData.forEach(function(c){
    var occ = ctrl_getNextOccurrences(c, _calYear, _calMonth);
    occ.forEach(function(d){
      var week = Math.floor((d.getDate()-1)/7);
      weeks[week].push({ctrl:c, date:d});
    });
  });

  /* Aussi montrer les contrôles sans date dans le mois */
  var noDate = ctrlData.filter(function(c){ return !c.dernierDate||c.dernierDate==='—'; });

  var MOIS_LONG2=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  var html = '';
  var hasAny = false;

  weeks.forEach(function(items, wi){
    if(!items.length) return;
    hasAny = true;
    var firstD = items[0].date.getDate();
    var lastD = Math.min(firstD+6, new Date(_calYear,_calMonth+1,0).getDate());
    html+='<div class="ech-month">Semaine du '+firstD+' au '+lastD+' '+MOIS_LONG2[_calMonth]+'</div>';
    items.forEach(function(item){
      var c=item.ctrl, d=item.date;
      var col=DOT_CTRL[c.statut]||'#94A3B8';
      var sc=STATUT_COLOR[c.statut]||'#94A3B8';
      var lbl=STATUT_LBL[c.statut]||c.statut;
      html+='<div class="ech-item" style="cursor:pointer;" onclick="ctrl_closeEcheances();ctrl_openVal(\''+c.id+'\')">'
        +'<div class="ech-day"><div class="ech-day-num" style="color:'+col+';">'+('0'+d.getDate()).slice(-2)+'</div><div class="ech-day-mon" style="color:'+col+';">'+['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][d.getMonth()]+'</div></div>'
        +'<div class="ech-info"><div class="ech-name">'+escHtml(c.nom)+'</div>'
        +'<div class="ech-meta">'+(FREQ_LABEL[c.freq]||c.freq)+' · '+escHtml(c.cat)+'</div>'
        +'<span class="ech-badge" style="background:transparent;color:'+sc+';padding:0;font-weight:500;">'+lbl+'</span>'
        +'</div></div>';
    });
  });

  if(noDate.length > 0) {
    hasAny = true;
    html+='<div class="ech-month">Non planifiés</div>';
    noDate.forEach(function(c){
      html+='<div class="ech-item" style="cursor:pointer;" onclick="ctrl_closeEcheances();ctrl_openPlanifier(\''+c.id+'\')">' 
        +'<div class="ech-day"><div class="ech-day-num" style="color:#94A3B8;">—</div><div class="ech-day-mon"></div></div>'
        +'<div class="ech-info"><div class="ech-name">'+escHtml(c.nom)+'</div>'
        +'<div class="ech-meta">'+(FREQ_LABEL[c.freq]||c.freq)+' · '+c.cat+'</div>'
        +'<span style="font-size:10px;color:#0A1F3D;font-weight:500;">Planifier →</span>'
        +'</div></div>';
    });
  }

  if(!hasAny) html='<div style="padding:2rem;text-align:center;font-size:12px;color:#94A3B8;font-style:italic;">Aucune échéance ce mois-ci.</div>';
  document.getElementById('ech-body').innerHTML = html;
}

function ctrl_exportICS(){
  var RRULE = {quotidien:'FREQ=DAILY', hebdomadaire:'FREQ=WEEKLY', mensuel:'FREQ=MONTHLY', trimestriel:'FREQ=MONTHLY;INTERVAL=3', semestriel:'FREQ=MONTHLY;INTERVAL=6', annuel:'FREQ=YEARLY'};
  var lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Clearisk//Controles//FR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  var now = new Date();
  var stamp = now.getFullYear()+pad2(now.getMonth()+1)+pad2(now.getDate())+'T'+pad2(now.getHours())+pad2(now.getMinutes())+pad2(now.getSeconds())+'Z';

  ctrlData.forEach(function(c){
    var dtstart;
    if(c.dernierDate && c.dernierDate!=='—'){
      var p=c.dernierDate.split('/');
      if(p.length===3){
        var next=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
        next.setDate(next.getDate()+(FREQ_DAYS[c.freq]||30));
        dtstart=next.getFullYear()+pad2(next.getMonth()+1)+pad2(next.getDate());
      }
    }
    if(!dtstart){ var d2=new Date(); dtstart=d2.getFullYear()+pad2(d2.getMonth()+1)+pad2(d2.getDate()); }
    var rrule = RRULE[c.freq]||'FREQ=MONTHLY';
    var desc = 'Contrôle permanent Clearisk\\nCatégorie : '+c.cat+'\\nFréquence : '+(FREQ_LABEL[c.freq]||c.freq);
    lines.push('BEGIN:VEVENT');
    lines.push('UID:clearisk-ctrl-'+c.id+'@clearisk.fr');
    lines.push('DTSTAMP:'+stamp);
    lines.push('DTSTART;VALUE=DATE:'+dtstart);
    lines.push('RRULE:'+rrule);
    lines.push('SUMMARY:✓ '+c.nom);
    lines.push('DESCRIPTION:'+desc);
    lines.push('CATEGORIES:Clearisk,Contrôle');
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');

  var blob = new Blob([lines.join('\r\n')], {type:'text/calendar;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='clearisk-controles.ics'; a.click();
  URL.revokeObjectURL(url);
  showToast('Calendrier exporté — importez le fichier .ics dans votre agenda ✓');
}


function ctrl_closeEcheances(){
  document.getElementById('ctrlEchOverlay').classList.remove('open');
  document.getElementById('ctrlEchPanel').classList.remove('open');
}
function ctrl_setNiv(v){activeNiveau=v;ctrl_closeDD();ctrl_render();}
function ctrl_setFreq(v){activeFreq=v;ctrl_closeDD();ctrl_render();}

function ctrl_toggleDD(e,which){
  e.stopPropagation();
  var dd=document.getElementById(which+'-dd');
  var ar=document.getElementById(which+'-arrow');
  var open=dd&&dd.classList.contains('open');
  ctrl_closeDD();
  if(!open&&dd){dd.classList.add('open');if(ar)ar.classList.add('open');}
}
function ctrl_closeDD(){
  document.querySelectorAll('.col-dropdown.open').forEach(function(d){d.classList.remove('open');});
  document.querySelectorAll('.col-arrow.open').forEach(function(a){a.classList.remove('open');});
}
/* ctrl_closeDD géré par listener global */

function ctrl_openAdd(){
  // Peupler le select des risques
  var sel = document.getElementById('ctrl-f-risk');
  if(sel) {
    sel.innerHTML = '<option value="">— Aucun risque associé —</option>';
    riskData.forEach(function(r){
      var opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  }
  document.getElementById('ctrlOverlayAdd').classList.add('open');
  document.getElementById('f-nom').focus();
}
function ctrl_closeAdd(){
  document.getElementById('ctrlOverlayAdd').classList.remove('open');
  ['f-nom','f-resp','f-date','f-ctrl-desc'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  ['f-niveau','f-freq','ctrl-f-cat','ctrl-f-risk'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
}
function ctrl_saveAdd(){
  var nom=document.getElementById('f-nom').value.trim();
  var niv=document.getElementById('f-niveau').value;
  var freq=document.getElementById('f-freq').value;
  var resp=document.getElementById('f-resp').value.trim();
  var cat=document.getElementById('ctrl-f-cat').value||'Autre';
  var desc=document.getElementById('f-ctrl-desc').value.trim();
  var riskSel=document.getElementById('ctrl-f-risk');
  var riskId=riskSel?riskSel.value:'';
  var riskName='';
  if(riskId){
    var rLinked=riskData.find(function(r){return r.id===riskId;});
    if(rLinked){ riskName=rLinked.name; if(!cat||cat==='Autre') cat=rLinked.cat; }
  }
  if(!nom)  return showToast('Le nom est obligatoire');
  if(!niv)  return showToast('Choisissez un niveau');
  if(!freq) return showToast('Choisissez une fréquence');
  if(!resp) return showToast('Le responsable est obligatoire');
  var dateVal = document.getElementById('f-date').value;
  var dernierDate = '—';
  var statut = 'nonplanifie';
  if(dateVal) {
    var freqDays = {quotidien:1,hebdomadaire:7,mensuel:30,trimestriel:91,semestriel:182,annuel:365};
    var d = new Date(dateVal);
    d.setDate(d.getDate() - (freqDays[freq]||30));
    dernierDate = ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
    statut = 'averifier';
  }
  var newCtrl = {id:genId(),nom:nom,cat:cat,niveau:niv,freq:freq,resp:resp,statut:statut,dernierDate:dernierDate,note:desc,riskId:riskId||null,risk:riskName||null};
  ctrlData.push(newCtrl);
  sbSaveControl(newCtrl);
  sbSaveHistory({type:'action', title:'Contrôle ajouté — '+nom, desc:(riskName?'Risque : '+riskName+' · ':'')+'Fréquence '+freq});
  ctrl_closeAdd();
  ctrl_render();
  renderDashboard();
  showToast('Contrôle créé');
}

function ctrl_openVal(id){
  var c=ctrlData.find(function(x){return x.id===id;});
  if(!c)return;
  valCtrlId=id;
  document.getElementById('val-title').textContent=c.nom;
  document.getElementById('val-sub').textContent=c.cat+' · '+FREQ_LABEL[c.freq];
  document.getElementById('val-note').value='';
  document.getElementById('val-by').value='';
  document.getElementById('val-result').value='conforme';
  document.getElementById('ctrlOverlayVal').classList.add('open');
}
function ctrl_closeVal(){document.getElementById('ctrlOverlayVal').classList.remove('open');valCtrlId=null;}
function ctrl_confirmVal(){
  if(!valCtrlId)return;
  var c=ctrlData.find(function(x){return x.id===valCtrlId;});
  if(!c)return;
  var result=document.getElementById('val-result').value;
  var by=(document.getElementById('val-by').value||'').trim().toUpperCase();
  var note=(document.getElementById('val-note').value||'').trim();
  if(!by) return showToast('Indiquez les initiales du validateur');
  var t=new Date();
  var dateStr=('0'+t.getDate()).slice(-2)+'/'+('0'+(t.getMonth()+1)).slice(-2)+'/'+t.getFullYear();
  if(!histData[c.id]) histData[c.id]=[];
  histData[c.id].unshift({date:dateStr,statut:result,note:note,resp:by});
  c.statut=result;
  c.note=note;
  c.dernierDate=dateStr;
  sbSaveControl(c);
  sbSaveHistory({type:'action', title:'Contrôle validé — '+c.nom, desc:'Résultat : '+result+' · Par '+by});
  ctrl_closeVal();ctrl_render();showToast('Contrôle validé par '+by);
}

var delCtrlId=null;
function ctrl_delCtrl(id){
  var c=ctrlData.find(function(x){return x.id===id;});
  if(!c)return;
  delCtrlId=id;
  document.getElementById('confirm-name').textContent=c.nom;
  document.getElementById('confirm-del-btn').onclick=function(){
    var sb=getSb();
    if(sb){ sb.from('controls').delete().eq('id',delCtrlId).then(function(res){ if(res.error) showToast('Erreur suppression — réessayez', true); }); }
    ctrlData=ctrlData.filter(function(x){return x.id!==delCtrlId;});
    ctrl_closeConfirm();ctrl_render();showToast('Contrôle supprimé');
  };
  document.getElementById('ctrlOverlayConfirm').classList.add('open');
}
function ctrl_closeConfirm(){
  document.getElementById('ctrlOverlayConfirm').classList.remove('open');
  delCtrlId=null;
}



/* ── HISTORIQUE ── */

function ctrl_openHist(id){
  var c=ctrlData.find(function(x){return x.id===id;});
  if(!c)return;
  document.getElementById('hist-title').textContent=c.nom;
  document.getElementById('hist-sub').textContent=c.cat+' · '+FREQ_LABEL[c.freq];
  var entries=histData[id]||[];
  var body=document.getElementById('hist-body');
  if(!entries.length){
    body.innerHTML='<div class="hist-empty">Aucune validation enregistrée.<br>Validez ce contrôle pour démarrer l\'historique.</div>';
  } else {
    var html='';
    entries.forEach(function(e){
      html+='<div class="hist-entry">'
        +'<div class="hist-date-col">'+e.date+'</div>'
        +'<div class="hist-content">'
        +'<div class="hist-result"><span class="dot" style="background:'+STATUT_COLOR[e.statut]+';width:6px;height:6px;border-radius:50%;display:inline-block;"></span><span style="font-size:12px;font-weight:500;color:'+STATUT_COLOR[e.statut]+';">'+STATUT_LABEL[e.statut]+'</span></div>'
        +(e.note?'<div class="hist-note">'+e.note+'</div>':'')
        +'<div class="hist-by">Validé par '+e.resp+'</div>'
        +'</div>'
        +'</div>';
    });
    body.innerHTML=html;
  }
  document.getElementById('ctrlHistOverlay').classList.add('open');
}
function ctrl_closeHistDirect(){document.getElementById('ctrlHistOverlay').classList.remove('open');}
function ctrl_closeHist(e){if(e.target===document.getElementById('ctrlHistOverlay'))ctrl_closeHistDirect();}

/* ── TOAST ── */
var _tt=null;
/* showToast — alias vers la fonction principale définie plus haut */
function _showToastAlias(msg,isError){
  var t=document.getElementById('toast');
  t.textContent=msg;t.style.background=isError?'#E24B4A':'#0A1F3D';
  t.classList.add('show');
  var duration = isError ? 5000 : 3500;
  if(_tt)clearTimeout(_tt);
  _tt=setTimeout(function(){t.classList.remove('show');},duration);
}

['ctrlOverlayAdd','ctrlOverlayVal'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){
    if(e.target===this){this.classList.remove('open');if(id==='ctrlOverlayVal')valCtrlId=null;}
  });
});

ctrl_render();


/* ── ALIASES pour compatibilité dashboard ── */
function renderCtrl(){ ctrl_render(); }
function ctrlConfirmVal(){ ctrl_confirmVal(); }
function ctrlCloseHistDirect(){ ctrl_closeHistDirect(); }
function confirmValCtrl(){ ctrl_confirmVal(); }
function openCtrlHist(id){ ctrl_openHist(id); }
function filterCtrl(f, btn){
  if(btn){ document.querySelectorAll('#page-controles .pa-filter').forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); }
  else {
    var pill = document.getElementById('ctrl-f-'+f);
    document.querySelectorAll('#page-controles .pa-filter').forEach(function(b){b.classList.remove('active');});
    if(pill) pill.classList.add('active');
  }
  // Même comportement opacity que Plan d'action
  ['retard','averifier','conforme','tous'].forEach(function(k){
    var kpi = document.getElementById('ctrl-kpi-card-'+k);
    if(kpi) kpi.style.opacity = (f==='tous' || f===k) ? '1' : '0.4';
  });
  ctrl_render();
}

window.addEventListener('load',function(){setTimeout(function(){if(typeof renderCtrl==='function')renderCtrl();},100);});

/* ── REVUES ── */
var _currentValRevId = null;

function openAddRevue() {
  var nomEl = document.getElementById('rev-nom');
  var dateEl = document.getElementById('rev-date');
  var recurEl = document.getElementById('rev-recur');
  var respEl = document.getElementById('rev-resp');
  if(nomEl) nomEl.value = '';
  if(recurEl) recurEl.value = '';
  if(respEl) respEl.value = '';
  if(dateEl) {
    var today = new Date();
    dateEl.value = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  }
  var modal = document.getElementById('addRevueModal');
  if(modal) { modal.style.display = 'flex'; }
}

function closeAddRevue() {
  var modal = document.getElementById('addRevueModal');
  if(modal) modal.style.display = 'none';
}

function saveRevue() {
  var nom = (document.getElementById('rev-nom') ? document.getElementById('rev-nom').value : '').trim();
  var date = document.getElementById('rev-date') ? document.getElementById('rev-date').value : '';
  var recur = document.getElementById('rev-recur') ? document.getElementById('rev-recur').value : '';
  var resp = (document.getElementById('rev-resp') ? document.getElementById('rev-resp').value : '').trim();
  if(!nom) { showToast("L'intitulé est obligatoire", true); return; }
  if(!date) { showToast('La date est obligatoire', true); return; }
  var d = new Date(date);
  var dateStr = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  sbSaveHistory({
    type: 'action',
    title: 'Revue planifiée — ' + nom,
    desc: 'Date : ' + dateStr + (recur ? ' · ' + recur : '') + (resp ? ' · Responsable : ' + resp : '')
  });
  closeAddRevue();
  showToast('Revue planifiée ✓');
}

function openValRev(id, titre) {
  _currentValRevId = id || null;
  var titreEl = document.getElementById('val-rev-titre');
  var noteEl = document.getElementById('val-rev-note-inp');
  if(titreEl) titreEl.textContent = titre || 'Valider la revue';
  if(noteEl) noteEl.value = '';
  var modal = document.getElementById('valRevueModal');
  if(modal) modal.style.display = 'flex';
}

function closeValRev() {
  var modal = document.getElementById('valRevueModal');
  if(modal) modal.style.display = 'none';
  _currentValRevId = null;
}

function confirmValRev() {
  var note = (document.getElementById('val-rev-note-inp') ? document.getElementById('val-rev-note-inp').value : '').trim();
  sbSaveHistory({
    type: 'action',
    title: 'Revue validée',
    desc: note || 'Aucune observation'
  });
  closeValRev();
  showToast('Revue validée ✓');
}

/* ── LISTENER GLOBAL UNIQUE — ferme tous les panels/dropdowns au clic extérieur ── */
document.addEventListener('click', function(e) {
  if(!e.target.closest('.rt-dropdown') && !e.target.closest('.rt-th-filter')) {
    closeRtDropdowns();
    closeCartoDropdowns();
  }
  if(!e.target.closest('#avatarMenu') && !e.target.closest('#nav-avatar-txt')) {
    closeAvatarMenu();
  }
  if(!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn')) {
    closeNotifPanel();
  }
  ctrl_closeDD();
  if(typeof etabPanelOpen !== 'undefined' && etabPanelOpen) {
    var panel = document.getElementById('etab-panel');
    var user = document.getElementById('sb-user');
    if(panel && !panel.contains(e.target) && user && !user.contains(e.target)) closeEtabPanel();
  }
});

/* ── FOOTER YEAR ── */
(function(){ var el = document.getElementById('footer-year'); if(el) el.textContent = new Date().getFullYear(); })();
