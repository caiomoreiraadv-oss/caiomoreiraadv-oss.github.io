/* ============================================================
   PT-2026 · cloud.js · Camada nuvem + integrações nativas
   ------------------------------------------------------------
   • Login com Google (Firebase Auth) — real, com config única
   • Sincronização realtime entre os 4 (Firestore, offline-first)
   • Localização ao vivo dos 4 ("Onde estão") via Firestore
   • Fallbacks NATIVOS de iPhone sem config nenhuma:
       - localização: WhatsApp / link de Mapas no grupo
       - sync: código colável (já em extras.js)
   • Painel Integrações: Booking, Splitwise, Google Calendar,
       Google Maps offline, Apple Wallet, Clima do iPhone
   Carregado após extras.js. Não reescreve o monólito.
   Firebase só baixa da rede SE houver config (offline preservado).
   ============================================================ */
(function(){
  'use strict';
  if(window.__PT2026_CLOUD__) return;
  window.__PT2026_CLOUD__ = true;

  var G = window;
  function dep(){ return typeof G.state==='object' && typeof G.renderMais==='function' && G.__PT2026_EXTRAS__; }
  if(dep()) boot(); else {
    var n=0, iv=setInterval(function(){ n++; if(dep()){ clearInterval(iv); boot(); } else if(n>80){ clearInterval(iv); } }, 100);
  }

  function boot(){
    var state=G.state, saveState=G.saveState, $=G.$, $$=G.$$, ICONS=G.ICONS||{}, DAYS=G.DAYS||[], PROFILES=G.PROFILES||[];
    var PCOLOR={ caio:'#D4A85F', amanda:'#C25E3D', bruna:'#5E7355', lucas:'#3E6E78' };
    var PIDS=['amanda','bruna','caio','lucas'];
    var TRIP='portugal2026';
    function pname(id){ var p=PROFILES.find(function(x){return x.id===id;}); return p?p.name:(id||'').charAt(0).toUpperCase()+(id||'').slice(1); }
    function activeId(){
      var a=(typeof G.getActiveProfile==='function'&&G.getActiveProfile())||null;
      if(a&&a.id&&a.id!=='guest') return a.id;
      return state.activeProfile&&state.activeProfile!=='guest'?state.activeProfile:'caio';
    }
    function ic(n){ return ICONS[n]||ICONS.doc||''; }
    function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c];}); }
    function toast(m){ if(typeof G.x2toast==='function'){G.x2toast(m);return;} var d=document.createElement('div'); d.className='x2-toast'; d.textContent=m; document.body.appendChild(d); setTimeout(function(){d.classList.add('in');},10); setTimeout(function(){d.classList.remove('in');setTimeout(function(){d.remove();},300);},2400); }
    function copy(t){ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('Copiado');},function(){prompt('Copie:',t);});} else prompt('Copie:',t); }
    function mount(html){ var c=$('#mais-content'); if(c){ c.innerHTML=html; try{window.scrollTo(0,0);}catch(e){} } }
    function back(){ return '<div class="pad" style="margin-top:16px"><button class="btn ghost sm" data-sub="home" style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;transform:rotate(180deg)">›</span> voltar</button></div>'; }
    function jget(k,f){ try{ return JSON.parse(localStorage.getItem(k)) || f; }catch(e){ return f; } }
    function jset(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ toast('Memória cheia — apague um anexo antigo'); return false; } }
    function fileToDataUrl(file){
      return new Promise(function(res,rej){
        if(typeof G.compressImage==='function' && /^image\//.test(file.type)){ G.compressImage(file,1400,0.78).then(res,function(){ raw(); }); }
        else raw();
        function raw(){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }
      });
    }
    function lightbox(src){ var o=document.createElement('div'); o.className='x2-lb'; o.innerHTML='<img src="'+src+'" alt=""><button class="x2-lb-x" aria-label="Fechar">×</button>'; o.onclick=function(){ o.remove(); }; document.body.appendChild(o); }
    function loadScript(src){ return new Promise(function(res,rej){ var s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
    var _pdfjs=null;
    function extractDoc(file, prog){
      // devolve {text, dataUrl}. PDF: camada de texto via pdf.js. Imagem: OCR via tesseract.js.
      // Bibliotecas baixadas só agora (sob demanda) — uso normal do app continua offline/leve.
      return fileToDataUrl(file).then(function(dataUrl){
        var isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name||'');
        if(isPdf){
          prog && prog('Lendo o PDF…');
          var P = _pdfjs ? Promise.resolve(_pdfjs)
            : import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs').then(function(m){
                m.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
                _pdfjs=m; return m;
              });
          return P.then(function(pdfjs){
            return file.arrayBuffer().then(function(buf){
              return pdfjs.getDocument({data:new Uint8Array(buf)}).promise.then(function(pdf){
                var pages=[];
                for(var i=1;i<=pdf.numPages;i++) pages.push(i);
                return pages.reduce(function(acc,n){
                  return acc.then(function(txt){
                    return pdf.getPage(n).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
                      return txt+' '+tc.items.map(function(it){ return it.str; }).join(' ');
                    });
                  });
                }, Promise.resolve('')).then(function(text){ return { text:text, dataUrl:dataUrl }; });
              });
            });
          });
        }
        // imagem → OCR
        prog && prog('Lendo a imagem (OCR)… pode levar alguns segundos');
        var T = window.Tesseract ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
        return T.then(function(){
          return window.Tesseract.recognize(file, 'por+eng', { logger:function(m){ if(m.status==='recognizing text' && prog) prog('Lendo a imagem… '+Math.round((m.progress||0)*100)+'%'); } })
            .then(function(r){ return { text:(r&&r.data&&r.data.text)||'', dataUrl:dataUrl }; });
        });
      });
    }
    function guessName(text, fname){
      var firstLine=(String(text||'').split(/\n|\r/).map(function(s){return s.trim();}).filter(function(s){return s.length>3;})[0]||'').slice(0,60);
      if(firstLine) return firstLine;
      return (fname||'').replace(/\.(pdf|jpe?g|png|heic|webp)$/i,'').replace(/[_-]+/g,' ').slice(0,60);
    }

    /* ---------- config Firebase ---------- */
    var FB_KEY='pt2026:fb:cfg', ME_KEY='pt2026:fb:me', SHARE_KEY='pt2026:fb:share';
    function fbCfg(){ try{ return JSON.parse(localStorage.getItem(FB_KEY)||'null'); }catch(e){ return null; } }
    function setFbCfg(o){ localStorage.setItem(FB_KEY, JSON.stringify(o)); }
    var FB=null, fbReady=false, fbErr=null;
    function buildInvite(){
      var cfg=fbCfg(); if(!cfg) return '';
      try{ var p=btoa(unescape(encodeURIComponent(JSON.stringify({fb:cfg,t:TRIP})))); return location.origin+location.pathname+'#join='+p; }
      catch(e){ return ''; }
    }
    function acceptInvite(){
      try{
        var h=(location.hash||'')+'&'+(location.search||'');
        var m=/[#&?]join=([^&]+)/.exec(h); if(!m) return false;
        var data=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
        if(data && data.fb && data.fb.apiKey && data.fb.projectId){
          if(!fbCfg()) setFbCfg(data.fb); // não sobrescreve quem já é gerente
          try{ history.replaceState(null,'',location.pathname); }catch(e){}
          setTimeout(function(){ toast('Convite aceito — entre com Google'); }, 600);
          return true;
        }
      }catch(e){}
      return false;
    }

    function loadFirebase(){
      if(FB) return Promise.resolve(FB);
      var cfg=fbCfg();
      if(!cfg||!cfg.apiKey||!cfg.projectId) return Promise.reject(new Error('sem config'));
      if(!cfg.databaseURL) return Promise.reject(new Error('falta databaseURL — crie o Realtime Database e cole a URL na config'));
      var V='https://www.gstatic.com/firebasejs/10.12.2/';
      return Promise.all([
        import(V+'firebase-app.js'),
        import(V+'firebase-auth.js'),
        import(V+'firebase-database.js')
      ]).then(function(m){
        var appM=m[0], authM=m[1], dbM=m[2];
        var app=appM.initializeApp(cfg);
        var auth=authM.getAuth(app);
        var db=dbM.getDatabase(app);
        FB={ app:app, auth:auth, db:db, a:authM, d:dbM };
        fbReady=true;
        return FB;
      }).catch(function(e){ fbErr=e; throw e; });
    }
    function rref(path){ return FB.d.ref(FB.db, path); }

    /* ---------- AUTH (Google via Firebase) ---------- */
    var gToken=null; // token OAuth Google (escopo Calendar) capturado no login
    function captureToken(fb,res){
      try{ if(res){ var c=fb.a.GoogleAuthProvider.credentialFromResult(res); if(c&&c.accessToken) gToken={t:c.accessToken, exp:Date.now()+3300000}; } }catch(e){}
    }
    function googleSignIn(){
      return loadFirebase().then(function(fb){
        var prov=new fb.a.GoogleAuthProvider();
        prov.addScope('https://www.googleapis.com/auth/calendar.events');
        prov.setCustomParameters({ prompt:'select_account' });
        // REDIRECT SEMPRE. O popup é bloqueado por padrão no Chrome desktop e
        // deixava o login preso em "Abrindo Google…". Redirect funciona em
        // qualquer ambiente: a página vai ao Google e volta; o login é
        // finalizado em checkRedirect()→getRedirectResult() no arranque.
        return fb.a.signInWithRedirect(fb.auth, prov);
      });
    }
    // Identidade GENÉRICA: qualquer conta Google entra. O "lugar" (slot) é
    // atribuído automaticamente por ordem de chegada, sem e-mail fixo —
    // assim o app serve qualquer grupo em viagens futuras.
    var SLOTS=['caio','amanda','bruna','lucas'];
    function hashSlot(uid){ var h=0,s=String(uid||''); for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return SLOTS[h%SLOTS.length]; }
    function membersRef(){ return rref('trips/'+TRIP+'/members'); }
    function assignSlot(u, cb){
      var local=localStorage.getItem(ME_KEY);
      if(local){ registerMember(u, local); return cb(local); }
      try{
        FB.d.get(membersRef()).then(function(snap){
          var m=snap.val()||{}, mine=null, taken={};
          Object.keys(m).forEach(function(uid){ if(m[uid]&&m[uid].slot){ taken[m[uid].slot]=uid; if(uid===u.uid) mine=m[uid].slot; } });
          var slot=mine;
          if(!slot){ for(var i=0;i<SLOTS.length;i++){ if(!taken[SLOTS[i]]){ slot=SLOTS[i]; break; } } }
          if(!slot) slot=hashSlot(u.uid); // >4 pessoas: compartilha bucket de cor
          registerMember(u, slot);
          cb(slot);
        }).catch(function(){ cb(hashSlot(u.uid)); });
      }catch(e){ cb(hashSlot(u.uid)); }
    }
    function registerMember(u, slot){
      try{ FB.d.set(rref('trips/'+TRIP+'/members/'+u.uid), { name:u.displayName||'', email:u.email||'', photo:u.photoURL||'', slot:slot, ts:Date.now() }); }catch(e){}
    }
    var authBound=false;
    function bindAuthState(){
      if(!FB || authBound) return;
      authBound=true;
      FB.a.onAuthStateChanged(FB.auth, function(u){
        if(!u) return;
        var gp={ email:u.email, name:u.displayName, picture:u.photoURL, sub:u.uid };
        function go(pid){
          localStorage.setItem(ME_KEY, pid);
          try{ G.saveGoogleProfileFor && G.saveGoogleProfileFor(pid, gp); }catch(e){}
          try{ G.setActiveProfile(pid); }catch(e){}
          try{ G.updateProfileAvatar&&G.updateProfileAvatar(); }catch(e){}
          startSync();
          afterLogin();
          var cur=document.querySelector('.view.active');
          if(cur&&cur.dataset.view==='mais') try{ G.renderMais(); }catch(e){}
        }
        assignSlot(u, go); // identidade pela conta Google; lugar auto-atribuído
      });
    }
    function checkRedirect(){
      loadFirebase().then(function(fb){
        fb.a.getRedirectResult(fb.auth).then(function(res){ captureToken(fb,res); bindAuthState(); }).catch(function(){ bindAuthState(); });
      }).catch(function(){});
    }
    /* ---------- pós-login: tela única de consentimento ---------- */
    var CONSENT_KEY='pt2026:fb:consent', GCAL_DONE='pt2026:fb:gcal';
    function tripWindowNow(){ var t=new Date(); return t>=new Date('2026-05-22T00:00:00') && t<=new Date('2026-05-29T23:59:59'); }
    function slotKey(){ return localStorage.getItem(ME_KEY) || (FB&&FB.auth&&FB.auth.currentUser&&FB.auth.currentUser.uid) || 'caio'; }
    function quizDone(){
      var k=slotKey();
      try{ if(localStorage.getItem('pt2026:quiz:'+k)) return true; }catch(e){}
      try{ var q=state.x2&&state.x2.quiz; if(q&&q[k]&&q[k].profile) return true; }catch(e){}
      return false;
    }
    // sinal "primeiro sync chegou" — p/ não recobrar o quiz de quem já respondeu
    // em outro aparelho/endereço (o resultado vem sincronizado do Firebase).
    var firstSyncDone=false, syncWaiters=[];
    function flushSync(){ if(firstSyncDone) return; firstSyncDone=true; var w=syncWaiters.slice(); syncWaiters=[]; w.forEach(function(f){ try{ f(); }catch(e){} }); }
    function whenSynced(cb){
      if(firstSyncDone || !FB || !FB.auth || !FB.auth.currentUser){ cb(); return; }
      syncWaiters.push(cb);
      setTimeout(flushSync, 6000); // rede lenta/offline: decide assim mesmo, não trava
    }
    function backfillQuizLocal(){
      try{ var k=slotKey(); if(localStorage.getItem('pt2026:quiz:'+k)) return;
        var q=state.x2&&state.x2.quiz&&state.x2.quiz[k];
        if(q&&q.profile) localStorage.setItem('pt2026:quiz:'+k, JSON.stringify({profile:q.profile, grad:q.grad||'', ts:q.ts||Date.now()}));
      }catch(e){}
    }
    function afterLogin(){
      if(localStorage.getItem(SHARE_KEY)==='1' && tripWindowNow() && !watchId) startShareLocation();
      if(!localStorage.getItem(CONSENT_KEY)){ setTimeout(function(){ consentScreen(maybeQuiz); }, 400); return; }
      maybeQuiz();
    }
    function tripSet(){ return !!(state.x2 && state.x2.trip && (state.x2.trip.start || (state.x2.trip.dests))); }
    function maybeFlight(){
      if(tripSet()) return;
      if(localStorage.getItem('pt2026:trip:skip:'+slotKey())==='1') return;
      setTimeout(flightSetup, 350);
    }
    function maybeQuiz(){
      if(quizDone()){ backfillQuizLocal(); maybeFlight(); return; }
      // localStorage vazio (aparelho/endereço novo): espera o 1º sync.
      // Se o perfil já existir no Firebase, NÃO recobra o quiz.
      whenSynced(function(){
        if(quizDone()){ backfillQuizLocal(); maybeFlight(); return; }
        setTimeout(quizScreen, 350);
      });
    }
    function pushCalendar(){
      if(!gToken || gToken.exp<Date.now()) return false;
      if(localStorage.getItem(GCAL_DONE)==='1') return true;
      var EV=G.EVENTS||[], DD=G.DAYS||[];
      var items=EV.map(function(ev){ var d=DD.filter(function(x){return x.n===ev.day;})[0]; return (d&&G.eventToGcal)?G.eventToGcal(ev,d):null; }).filter(Boolean);
      var i=0, ok=0;
      (function nx(){
        if(i>=items.length){ if(ok>0){ localStorage.setItem(GCAL_DONE,'1'); toast(ok+' passeios no Google Calendar'); } return; }
        fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',{method:'POST',headers:{'Authorization':'Bearer '+gToken.t,'Content-Type':'application/json'},body:JSON.stringify(items[i])})
          .then(function(r){ if(r.ok) ok++; }).catch(function(){}).then(function(){ i++; setTimeout(nx,90); });
      })();
      return true;
    }
    function consentScreen(cb){
      if(document.getElementById('cl-consent')){ return; }
      var inWin=tripWindowNow();
      var o=document.createElement('div'); o.id='cl-consent'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.96)';
      o.innerHTML='<div style="background:var(--surface);max-width:420px;width:100%;border-radius:20px;padding:24px;max-height:84vh;overflow:auto">'+
        '<h2 class="serif" style="font-size:21px">Deixar o PT-2026 completo</h2>'+
        '<p class="text-soft text-small" style="margin:8px 0 14px">Bem-vindo, '+esc(pname(localStorage.getItem(ME_KEY)||'caio'))+'. Permita o que o iPhone deixa um app fazer — o resto entra pontualmente.</p>'+
        '<div style="display:flex;flex-direction:column;gap:12px;text-align:left;font-size:13px;line-height:1.45">'+
          '<div>📍 <strong>Localização ao vivo entre os quatro</strong> — só no período <strong>22–29/05/2026</strong>, visível só para vocês, dentro do app.</div>'+
          '<div>🔔 <strong>Notificações</strong> — lembretes do próximo compromisso.</div>'+
          '<div>📅 <strong>Google Calendar</strong> — os passeios do roteiro entram na sua agenda agora.</div>'+
          '<div>✉️ <strong>Voo / hotel</strong> — encaminhe o e-mail de confirmação (TAP/Booking) que o app preenche. <span class="text-muted">(Apple e Booking não permitem importação automática — isto é o caminho real.)</span></div>'+
        '</div>'+
        '<button id="cl-allow" class="x2-btn-primary" style="margin-top:18px">Permitir tudo</button>'+
        '<button id="cl-skip" class="btn ghost sm" style="display:block;margin:10px auto 0">agora não</button>'+
        '<p class="text-muted text-small" style="margin-top:10px;text-align:center">'+(inWin?'Período da viagem ativo.':'Fora do período — a localização só liga em 22/05.')+'</p>'+
      '</div>';
      document.body.appendChild(o);
      $('#cl-skip').onclick=function(){ localStorage.setItem(CONSENT_KEY,'skip'); o.remove(); cb&&cb(); };
      $('#cl-allow').onclick=function(){
        localStorage.setItem(CONSENT_KEY,'1');
        try{ if('Notification' in window && Notification.requestPermission) Notification.requestPermission(); }catch(e){}
        if(navigator.geolocation){
          navigator.geolocation.getCurrentPosition(function(){
            localStorage.setItem(SHARE_KEY,'1');
            if(tripWindowNow() && !watchId) startShareLocation();
          }, function(){}, {enableHighAccuracy:true,timeout:12000});
        }
        if(!pushCalendar()) toast('Calendar: reentre com Google p/ enviar os passeios');
        o.remove();
        toast('Tudo pronto, '+pname(localStorage.getItem(ME_KEY)||'caio'));
        cb&&cb();
      };
    }
    /* ---------- QUIZ de perfil (obrigatório no 1º login) ----------
       Gradação: toda opção representa o viajante em ALGUM grau.
       1ª = MUITO · 2ª = BEM · 3ª = ÀS VEZES · 4ª = NÃO.
       O perfil (com a nuance) fica visível aos colegas → evita atritos. */
    var QLV=['muito','bem','às vezes','não'];
    var QLVC=['#2A3F31','#3F5B47','#C25E3D','#8C8276'];
    var QUIZ=[
      { dim:'Ritmo', q:'Na viagem, o meu dia ideal é…', opts:[
        {s:'acorda cedo', t:'Acordar cedo e aproveitar o máximo possível do roteiro'},
        {s:'acorda tarde', t:'Acordar tarde — e não me incomodo se o grupo sair sem mim no horário marcado'},
        {s:'ritmo relax', t:'Moderado: um roteiro mais relax, sem correria'},
        {s:'imprevisível', t:'Imprevisível: se a noitada empolgar, me esbaldo e o dia seguinte que espere'} ]},
      { dim:'Comida', q:'Diante da mesa, eu sou de…', opts:[
        {s:'aventureiro', t:'Experimentar tudo — pratos locais, frutos do mar, o desconhecido'},
        {s:'cauteloso', t:'Preferir o familiar e seguro; não curto arriscar no prato'},
        {s:'equilibrado', t:'Equilíbrio: provo coisas novas, sem exageros'},
        {s:'prático', t:'Tanto faz, desde que seja prático e rápido'} ]},
      { dim:'Dinheiro', q:'Com gastos na viagem, eu…', opts:[
        {s:'econômico', t:'Economizo: busco o melhor preço e evito gasto supérfluo'},
        {s:'gasta sem culpa', t:'Gasto sem culpa: férias é para aproveitar, preço não me trava'},
        {s:'custo-benefício', t:'Custo-benefício: pago bem pelo que realmente vale'},
        {s:'despreocupado', t:'Não fico controlando; acerto depois com o grupo'} ]},
      { dim:'Cultura', q:'Museus, igrejas e história…', opts:[
        {s:'cultural a fundo', t:'Amo: quero tempo para museus e história a fundo'},
        {s:'pula cultura', t:'Pouco: prefiro pular e curtir a cidade e áreas livres'},
        {s:'principais pontos', t:'Os principais: só os imperdíveis, sem maratona'},
        {s:'depende do grupo', t:'Depende do grupo e do clima do dia'} ]},
      { dim:'Roteiro', q:'Em relação ao roteiro, eu…', opts:[
        {s:'segue à risca', t:'Sigo o plano à risca, com horários'},
        {s:'improviso total', t:'Improviso total; roteiro me prende'},
        {s:'plano com folgas', t:'Plano-base com folgas para mudar no caminho'},
        {s:'fluxo do grupo', t:'Vou no fluxo do que o grupo decidir'} ]}
    ];
    function quizScreen(){
      if(document.getElementById('cl-quiz')) return;
      var i=0, ranks=[]; // ranks[i] = array de índices de opção, ordem de identificação (mais→menos)
      var o=document.createElement('div'); o.id='cl-quiz'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.98)';
      o.innerHTML='<div id="qz-box" style="background:var(--surface);max-width:460px;width:100%;border-radius:20px;padding:24px;max-height:90vh;overflow:auto"></div>';
      document.body.appendChild(o);
      // obrigatório: sem fechar tocando fora
      function render(){
        var Q=QUIZ[i], chosen=ranks[i]||[];
        var box=$('#qz-box');
        box.innerHTML='<div class="eyebrow">Perfil de viajante · '+(i+1)+' de '+QUIZ.length+'</div>'+
          '<h2 class="serif" style="font-size:20px;margin-top:6px">'+esc(Q.q)+'</h2>'+
          '<p class="text-soft text-small" style="margin:6px 0 14px">Todas representam você em <em>algum</em> momento — mas em graus diferentes. Toque na ordem: 1º a que <strong>te representa MUITO</strong>, 2º <strong>BEM</strong>, 3º <strong>ÀS VEZES</strong>, 4º a que <strong>NÃO</strong> te representa.</p>'+
          '<div id="qz-opts">'+Q.opts.map(function(op,idx){
            var pos=chosen.indexOf(idx);
            var on=pos>-1;
            var lv=on?QLV[pos]:'';
            return '<button class="qz-op" data-i="'+idx+'" style="display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:12px 14px;margin-top:8px;border-radius:12px;border:1px solid '+(on?'transparent':'var(--line)')+';background:'+(on?QLVC[pos]:'var(--surface-2)')+';color:'+(on?'#fff':'var(--ink)')+';font:inherit;line-height:1.35">'+
              '<span style="flex:none;min-width:62px;text-align:center;padding:4px 8px;border-radius:999px;border:1px solid '+(on?'rgba(255,255,255,.6)':'var(--line)')+';font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase">'+(on?lv:'·')+'</span>'+
              '<span>'+esc(op.t)+'</span></button>';
          }).join('')+'</div>'+
          '<div style="display:flex;gap:10px;margin-top:16px">'+
            (chosen.length?'<button id="qz-clear" class="btn ghost sm">Limpar</button>':'')+
            '<button id="qz-next" class="x2-btn-primary" style="flex:1;'+(chosen.length===Q.opts.length?'':'opacity:.5;pointer-events:none')+'">'+(i===QUIZ.length-1?'Concluir':'Próxima')+'</button>'+
          '</div>';
        $$('.qz-op', box).forEach(function(b){ b.onclick=function(){
          var idx=parseInt(b.dataset.i,10); ranks[i]=ranks[i]||[];
          var p=ranks[i].indexOf(idx);
          if(p>-1) ranks[i].splice(p,1); else if(ranks[i].length<Q.opts.length) ranks[i].push(idx);
          render();
        }; });
        var cl=$('#qz-clear'); if(cl) cl.onclick=function(){ ranks[i]=[]; render(); };
        var nx=$('#qz-next'); if(nx) nx.onclick=function(){
          if((ranks[i]||[]).length!==Q.opts.length) return;
          if(i<QUIZ.length-1){ i++; render(); } else finishQuiz(ranks);
        };
      }
      render();
    }
    function finishQuiz(ranks){
      var lines=[], grad=[];
      QUIZ.forEach(function(Q,qi){
        var order=(ranks[qi]||[]).map(function(oi){ return Q.opts[oi].s; });
        if(order.length===Q.opts.length){
          // AI: principal + secundário (a nuance que evita rótulo rígido)
          lines.push(Q.dim+': '+order[0]+(order[1]?(' (e às vezes '+order[1]+')'):''));
          // grupo: gradação completa em linguagem humana
          grad.push(Q.dim+' — '+order.map(function(s,k){ return s+' ('+QLV[k]+')'; }).join(', '));
        }
      });
      var profile=lines.join(' · ');
      var gradTxt=grad.join('\n');
      var key=slotKey(), me=localStorage.getItem(ME_KEY)||'caio';
      try{ localStorage.setItem('pt2026:quiz:'+key, JSON.stringify({profile:profile, grad:gradTxt, ts:Date.now()})); }catch(e){}
      state.x2=state.x2||{}; state.x2.quiz=state.x2.quiz||{};
      state.x2.quiz[me]={ profile:profile, grad:gradTxt, name:pname(me), ts:Date.now() };
      saveState();
      var box=$('#qz-box');
      if(box) box.innerHTML='<h2 class="serif" style="font-size:20px">Perfil traçado ✓</h2>'+
        '<p class="text-soft text-small" style="margin:10px 0">Ninguém é só uma coisa. Foi assim que você se descreveu — e os outros vão ver isto para evitar atritos:</p>'+
        '<div class="tl-card" style="font-size:12.5px;line-height:1.7;white-space:pre-wrap">'+esc(gradTxt)+'</div>'+
        '<button id="qz-done" class="x2-btn-primary" style="margin-top:16px">Começar a viagem</button>';
      var d=$('#qz-done'); if(d) d.onclick=function(){ var ov=document.getElementById('cl-quiz'); if(ov) ov.remove(); toast('Perfil salvo'); var cur=document.querySelector('.view.active'); if(cur&&cur.dataset.view==='perfil') try{ G.renderPerfil(); }catch(e){} maybeFlight(); };
    }
    function flightSetup(){
      if(document.getElementById('cl-flt')) return;
      var t=(state.x2&&state.x2.trip)||{};
      var o=document.createElement('div'); o.id='cl-flt'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.97)';
      o.innerHTML='<div style="background:var(--surface);max-width:460px;width:100%;border-radius:20px;padding:24px;max-height:90vh;overflow:auto">'+
        '<div style="display:flex;justify-content:space-between;gap:10px"><h2 class="serif" style="font-size:20px">Suas passagens e o período</h2><button id="fl-skip" class="x2-del" style="font-size:13px">agora não</button></div>'+
        '<p class="text-soft text-small" style="margin:8px 0 14px">Suba a passagem (PDF ou imagem) e o app lê sozinho — ou preencha à mão. Vale para o grupo todo.</p>'+
        '<label class="x2-att-add" style="width:100%;height:auto;padding:16px;border-radius:14px;flex-direction:column;gap:6px;text-align:center">'+
          '<input type="file" accept="image/*,application/pdf" id="fl-doc" style="display:none">'+ic('plane')+
          '<strong style="font-size:14px">Subir passagem (PDF ou imagem)</strong>'+
          '<span style="font-weight:400;color:var(--ink-muted);font-size:11.5px">extrai trecho, datas e localizador automaticamente</span></label>'+
        '<div id="fl-prog" class="text-muted text-small" style="margin-top:8px;display:none"></div>'+
        '<div style="border-top:1px solid var(--line);margin:14px 0"></div>'+
        '<div class="eyebrow">Ou preencha à mão</div>'+
        '<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="x2-l">Início</label><input id="fl-s" class="x2-in" type="date" value="'+esc(t.start||'')+'"></div><div style="flex:1"><label class="x2-l">Fim</label><input id="fl-e" class="x2-in" type="date" value="'+esc(t.end||'')+'"></div></div>'+
        '<label class="x2-l" style="margin-top:10px">Destinos (na ordem)</label><input id="fl-d" class="x2-in" placeholder="Ex.: Porto, Vale do Douro, Lisboa" value="'+esc(t.dests||'')+'">'+
        '<button id="fl-save" class="x2-btn-primary" style="margin-top:16px">Salvar</button>'+
      '</div>';
      document.body.appendChild(o);
      var prog=$('#fl-prog');
      $('#fl-skip').onclick=function(){ try{ localStorage.setItem('pt2026:trip:skip:'+slotKey(),'1'); }catch(e){} o.remove(); };
      function saveTrip(extra){
        state.x2=state.x2||{};
        var cur=state.x2.trip||{};
        state.x2.trip={ start:($('#fl-s').value||cur.start||''), end:($('#fl-e').value||cur.end||''), dests:(($('#fl-d').value||'').trim()||cur.dests||''), by:localStorage.getItem(ME_KEY)||'caio', ts:Date.now() };
        saveState();
      }
      $('#fl-save').onclick=function(){
        if(!($('#fl-s').value)&&!($('#fl-d').value||'').trim()){ toast('Informe o período ou os destinos'); return; }
        saveTrip(); o.remove(); toast('Período salvo'); var v=document.querySelector('.view.active'); if(v&&v.dataset.view==='hoje') try{ G.renderHoje&&G.renderHoje(); }catch(e){}
      };
      var fd=$('#fl-doc');
      if(fd) fd.onchange=function(e){
        var f=e.target.files&&e.target.files[0]; if(!f) return;
        prog.style.display='block'; prog.textContent='Lendo a passagem…';
        extractDoc(f, function(m){ prog.textContent=m; }).then(function(r){
          // cria/garante reserva de Transporte com o arquivo
          try{
            var id='s'+Date.now()+Math.random().toString(36).slice(2,5);
            stays().push({ id:id, cat:'transporte', type:'voo', name:(guessName(r.text,f.name)||'Voo'), city:'', conf:(parseRes(r.text||'').conf||''), inDate:'', by:localStorage.getItem(ME_KEY)||'caio', ts:Date.now() });
            var mf=stayFiles(); mf[id]={name:f.name,d:r.dataUrl}; jset(STAYFILE_KEY,mf);
          }catch(_){}
          if(aiKey()){
            askAI('Do texto de uma passagem aérea, devolva SOMENTE nesta forma, sem mais nada:\nINICIO=dd/mm/aaaa\nFIM=dd/mm/aaaa\nDESTINOS=cidade1, cidade2, cidade3\nTexto: """'+(r.text||'').slice(0,4000)+'"""', null).then(function(ans){
              var gs=function(k){ var m=new RegExp(k+'\\s*=\\s*(.+)','i').exec(ans||''); return m?m[1].trim():''; };
              var s=gs('INICIO'), en=gs('FIM'), de=gs('DESTINOS');
              function iso(d){ var m=/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(d||''); if(!m) return ''; var y=m[3].length===2?('20'+m[3]):m[3]; return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2); }
              if(iso(s)) $('#fl-s').value=iso(s);
              if(iso(en)) $('#fl-e').value=iso(en);
              if(de) $('#fl-d').value=de;
              prog.textContent='Passagem lida — confira os campos e toque Salvar.';
            }).catch(function(){ var p=parseRes(r.text||''); prog.textContent='Passagem anexada. '+(p.conf?'Localizador '+p.conf+'. ':'')+'Preencha período/destinos e Salve.'; });
          } else {
            var p=parseRes(r.text||'');
            prog.textContent='Passagem anexada'+(p.conf?(' (localizador '+p.conf+')'):'')+'. Preencha o período e os destinos e toque Salvar.';
          }
        }).catch(function(){ prog.textContent='Não consegui ler o arquivo. Preencha à mão e Salve (o arquivo fica anexado em Reservas).'; });
      };
    }
    function openQuizRedo(){
      try{ localStorage.removeItem('pt2026:quiz:'+slotKey()); }catch(e){}
      quizScreen();
    }

    function askWhoModal(cb){
      if(localStorage.getItem(ME_KEY)){ cb(localStorage.getItem(ME_KEY)); return; }
      if(document.getElementById('x2-who')) return;
      var o=document.createElement('div'); o.id='x2-who'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.95)';
      o.innerHTML='<div style="background:var(--surface);max-width:360px;width:100%;border-radius:20px;padding:24px;text-align:center">'+
        '<h2 class="serif" style="font-size:20px">Qual é você?</h2>'+
        '<p class="text-soft text-small" style="margin:8px 0 16px">Vincula sua conta Google a um viajante. Só uma vez.</p>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
        PIDS.map(function(p){ return '<button class="x2-btn-primary" data-who="'+p+'" style="background:'+PCOLOR[p]+'">'+pname(p)+'</button>'; }).join('')+
        '</div></div>';
      document.body.appendChild(o);
      o.addEventListener('click', function(e){
        var b=e.target.closest('[data-who]');
        if(b){ o.remove(); cb(b.dataset.who); }
        else if(e.target===o){ /* mantém aberto */ }
      });
    }

    /* ---------- SYNC Firestore ---------- */
    var unsubShared=null, pushTimer=null, applyingRemote=false;
    function sharedRef(){ return rref('trips/'+TRIP+'/shared'); }
    function locBase(){ return 'trips/'+TRIP+'/loc'; }

    function localShared(){
      var x=state.x2||{};
      return {
        expenses: x.expenses||[],
        tickets:  x.tickets||[],
        flights:  x.flights||null,
        albumLink:x.albumLink||'',
        missions: state.missions||{},
        stays: x.stays||[],
        quiz: x.quiz||{},
        trip: x.trip||null,
        overrides: jget('pt2026:event_overrides',{}),
        updatedAt: Date.now()
      };
    }
    function mergeShared(remote){
      if(!remote) return false;
      var x=state.x2=state.x2||{}; var changed=false;
      // despesas: por id, ts maior vence
      var byId={}; (x.expenses||[]).forEach(function(e){ byId[e.id]=e; });
      (remote.expenses||[]).forEach(function(e){ if(!byId[e.id]||(e.ts||0)>=(byId[e.id].ts||0)) byId[e.id]=e; });
      var merged=Object.keys(byId).map(function(k){ return byId[k]; });
      if(JSON.stringify(merged)!==JSON.stringify(x.expenses||[])){ x.expenses=merged; changed=true; }
      // missões: união (true vence)
      var lm=state.missions||{}, rm=remote.missions||{};
      Object.keys(rm).forEach(function(stop){ lm[stop]=lm[stop]||{}; Object.keys(rm[stop]||{}).forEach(function(mid){ if(rm[stop][mid]&&!lm[stop][mid]){ lm[stop][mid]=true; changed=true; } }); });
      state.missions=lm;
      // tickets/flights/albumLink: o mais recente do doc
      if(remote.tickets && JSON.stringify(remote.tickets)!==JSON.stringify(x.tickets||[])){ x.tickets=remote.tickets; changed=true; }
      if(remote.flights && JSON.stringify(remote.flights)!==JSON.stringify(x.flights||null)){ x.flights=remote.flights; changed=true; }
      // reservas (stays): merge por id, ts maior vence
      var sById={}; (x.stays||[]).forEach(function(s){ sById[s.id]=s; });
      (remote.stays||[]).forEach(function(s){ if(!sById[s.id]||(s.ts||0)>=(sById[s.id].ts||0)) sById[s.id]=s; });
      var sM=Object.keys(sById).map(function(k){ return sById[k]; });
      if(JSON.stringify(sM)!==JSON.stringify(x.stays||[])){ x.stays=sM; changed=true; }
      if(remote.albumLink && remote.albumLink!==x.albumLink){ x.albumLink=remote.albumLink; changed=true; }
      // quiz dos perfis: merge por slot, ts maior vence
      if(remote.quiz){
        x.quiz=x.quiz||{};
        Object.keys(remote.quiz).forEach(function(sl){ var rq=remote.quiz[sl]; if(rq && (!x.quiz[sl] || (rq.ts||0)>=(x.quiz[sl].ts||0))){ x.quiz[sl]=rq; changed=true; } });
      }
      if(remote.trip && (!x.trip || (remote.trip.ts||0)>=(x.trip.ts||0)) && JSON.stringify(remote.trip)!==JSON.stringify(x.trip||null)){ x.trip=remote.trip; changed=true; }
      // overrides do roteiro (eventos preenchidos por cada um): doc mais recente vence
      if(remote.overrides){
        var ro=JSON.stringify(remote.overrides), lo=localStorage.getItem('pt2026:event_overrides')||'{}';
        if(ro!==lo){ try{ localStorage.setItem('pt2026:event_overrides', ro); }catch(e){} changed=true; x._roteiroDirty=true; }
      }
      return changed;
    }
    function pushShared(){
      if(!FB||!FB.auth.currentUser) return;
      if(pushTimer) clearTimeout(pushTimer);
      pushTimer=setTimeout(function(){
        try{ FB.d.set(sharedRef(), localShared()); }catch(e){}
      }, 1500);
    }
    function startSync(){
      loadFirebase().then(function(fb){
        if(unsubShared) return;
        unsubShared=true;
        fb.d.onValue(sharedRef(), function(snap){
          var val=snap.val();
          if(!val){ pushShared(); flushSync(); return; }
          applyingRemote=true;
          var ch=mergeShared(val);
          applyingRemote=false;
          flushSync();
          if(ch){
            saveState();
            var cur=document.querySelector('.view.active');
            var v=cur&&cur.dataset.view;
            // NÃO re-renderizar a tela de configuração "Nuvem" em cada tick de sync:
            // ela não depende de dados ao vivo e o re-mount mata o scroll/foco
            // (impedia rolar até o card "Convidar"). Demais telas seguem ao vivo.
            if(v==='mais' && (state.maisSub||'home')!=='nuvem'){ try{ G.renderMais(); }catch(e){} }
            if((state.x2&&state.x2._roteiroDirty) && v==='roteiro'){ try{ G.renderRoteiro&&G.renderRoteiro(); }catch(e){} }
            if(v==='hoje'){ try{ G.renderHoje&&G.renderHoje(); }catch(e){} }
            if(state.x2) state.x2._roteiroDirty=false;
          }
        }, function(){});
        startLocationListen();
      }).catch(function(){});
    }
    // patch saveState → empurra p/ nuvem (sem loop quando aplicando remoto)
    var origSave=G.saveState;
    G.saveState=function(){ origSave.apply(this,arguments); if(!applyingRemote && FB && FB.auth.currentUser) pushShared(); };
    saveState=G.saveState;
    // patch saveOverrides → edição de evento por um viajante sincroniza p/ os outros
    if(typeof G.saveOverrides==='function'){
      var origSO=G.saveOverrides;
      G.saveOverrides=function(){ origSO.apply(this,arguments); if(!applyingRemote && FB && FB.auth.currentUser) pushShared(); };
    }

    /* ---------- LOCALIZAÇÃO AO VIVO ---------- */
    var watchId=null, lastWrite=0, lastPos=null, locCache={};
    function tripActive(){
      if(!DAYS.length) return true;
      var t=new Date(); t.setHours(0,0,0,0);
      var s=new Date(DAYS[0].date+'T00:00:00'), e=new Date(DAYS[DAYS.length-1].date+'T23:59:59');
      return t>=new Date(s.getTime()-3*864e5) && t<=new Date(e.getTime()+864e5);
    }
    function startShareLocation(){
      if(!navigator.geolocation){ toast('GPS indisponível'); return; }
      localStorage.setItem(SHARE_KEY,'1');
      watchId=navigator.geolocation.watchPosition(function(pos){
        lastPos=pos;
        var now=Date.now();
        var far = !lastWrite || now-lastWrite>25000;
        if(!far) return;
        lastWrite=now;
        if(FB&&FB.auth.currentUser){
          var me=localStorage.getItem(ME_KEY)||activeId();
          try{
            FB.d.set(rref(locBase()+'/'+me), {
              lat:pos.coords.latitude, lng:pos.coords.longitude,
              acc:Math.round(pos.coords.accuracy||0), ts:now, name:pname(me)
            });
          }catch(e){}
        }
      }, function(err){ toast('GPS: '+(err.message||'negado')); }, { enableHighAccuracy:true, maximumAge:15000, timeout:20000 });
    }
    function stopShareLocation(){
      localStorage.removeItem(SHARE_KEY);
      if(watchId!=null){ navigator.geolocation.clearWatch(watchId); watchId=null; }
    }
    var unsubLoc=null;
    function startLocationListen(){
      if(!FB||unsubLoc) return;
      unsubLoc=true;
      FB.d.onValue(rref(locBase()), function(snap){
        locCache=snap.val()||{};
        var cur=document.querySelector('.view.active');
        if(cur&&cur.dataset.view==='mais'&&state.maisSub==='ondeestao') scrOndeEstao();
      }, function(){});
      if(localStorage.getItem(SHARE_KEY)==='1' && !watchId) startShareLocation();
    }
    function shareLocationNative(){
      if(!navigator.geolocation){ toast('GPS indisponível'); return; }
      toast('Localizando…');
      navigator.geolocation.getCurrentPosition(function(pos){
        var la=pos.coords.latitude.toFixed(5), ln=pos.coords.longitude.toFixed(5);
        var link='https://maps.google.com/?q='+la+','+ln;
        var msg=pname(activeId())+' está aqui agora: '+link;
        window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
      }, function(e){ toast('Não consegui o GPS ('+(e.message||'negado')+')'); }, {enableHighAccuracy:true,timeout:15000});
    }

    /* ============================================================
       PATCH renderMais — novas tiles + telas (sobre o patch do extras)
       ============================================================ */
    var prevMais=G.renderMais;
    var MY=['ondeestao','integra','nuvem','reservas'];
    // Gerente do app = quem ocupa o lugar de admin (slot 'caio'). Telas de
    // gestão (nuvem/login e personalização de fotos) só para ele.
    var ADMIN_ONLY=['nuvem','fotos','ambient'];
    function isAdmin(){ var me=localStorage.getItem(ME_KEY)||state.activeProfile; return me==='caio'; }
    function gateTiles(){
      if(isAdmin()) return;
      var grid=$('#mais-content .util-grid'); if(!grid) return;
      ADMIN_ONLY.forEach(function(s){
        var t=grid.querySelector('[data-sub="'+s+'"]'); if(t) t.style.display='none';
      });
    }
    G.renderMais=function(){
      var sub=state.maisSub||'home';
      if(ADMIN_ONLY.indexOf(sub)>-1 && !isAdmin()){ state.maisSub='home'; sub='home'; }
      if(MY.indexOf(sub)>-1){
        if(sub==='ondeestao') return scrOndeEstao();
        if(sub==='integra')   return scrIntegra();
        if(sub==='nuvem')     return scrNuvem();
        if(sub==='reservas')  return scrReservas();
      }
      // redireciona ícones consolidados p/ o hub certo
      if(sub==='cambio'){ state.maisSub='caixinha'; X._tab='cambio'; saveState(); return scrCaixinhaProxy(); }
      if(sub==='frases'){ state.maisSub='conversa'; saveState(); }
      if(['voos','hoteis','dormir','voos2','vitrine'].indexOf(sub)>-1){ state.maisSub='reservas'; saveState(); return scrReservas(); }
      if(sub==='conversa'){ /* extras cuida */ }
      prevMais.apply(this,arguments);
      if((state.maisSub||'home')==='home'){ injectTiles2(); gateTiles(); consolidateTiles(); }
      if((state.maisSub||'')==='conversa') setTimeout(injectTranslator,0);
    };
    function injectTranslator(){
      var host=$('#mais-content'); if(!host || host.querySelector('#tr-card')) return;
      var pad=host.querySelector('.pad'); if(!pad) return;
      var card=document.createElement('div'); card.className='tl-card'; card.id='tr-card'; card.style.marginTop='12px';
      if(!aiKey()){
        card.innerHTML='<div class="eyebrow">Tradutor inteligente</div><p class="text-soft text-small" style="margin-top:6px">Para traduzir por <strong>voz</strong> ou <strong>foto do cardápio</strong>, o gerente ativa o assistente (Gemini, grátis) em <strong>Mais → Nuvem & Login</strong>. As frases e o modo offline abaixo seguem funcionando.</p>';
        pad.insertBefore(card, pad.firstChild); return;
      }
      card.innerHTML='<div class="eyebrow">Tradutor · texto, voz ou foto do cardápio</div>'+
        '<textarea id="tr-in" class="x2-in" rows="2" style="margin-top:8px" placeholder="Escreva em português do Brasil — devolvo em PT-PT de Portugal"></textarea>'+
        '<div class="tl-actions" style="margin-top:8px">'+
          '<button class="tl-action primary" id="tr-go">'+ic('bubble')+'<span>Traduzir</span></button>'+
          '<button class="tl-action" id="tr-mic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg><span>Falar</span></button>'+
          '<label class="tl-action"><input type="file" accept="image/*" id="tr-cam" style="display:none">'+ic('view')+'<span>Foto do cardápio</span></label>'+
        '</div>'+
        '<div id="tr-out" class="text-soft text-small" style="margin-top:12px;line-height:1.55;white-space:pre-wrap"></div>'+
        '<button id="tr-say" class="btn ghost sm" style="margin-top:8px;display:none">Ouvir em voz alta</button>';
      pad.insertBefore(card, pad.firstChild);
      var out=$('#tr-out'), say=$('#tr-say'), lastTxt='';
      function speak(t){ try{ var u=new SpeechSynthesisUtterance(t); u.lang='pt-PT'; u.rate=.95; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }
      function show(t){ out.textContent=t; lastTxt=t; if(say){ say.style.display='inline-block'; say.onclick=function(){ speak(t); }; } }
      function trPrompt(extra){
        return 'Você é um tradutor de viagem. Traduza para PORTUGUÊS DE PORTUGAL (informal, do dia a dia). '+
          'Se vier ÁUDIO: entenda e devolva como se diz em PT-PT. '+
          'Se vier FOTO de cardápio/placa: leia o texto, traduza para PT-BR e explique em 1 linha cada prato/item pouco óbvio. '+
          (extra?('Texto: "'+extra+'". '):'')+'Seja direto, sem rodeios.';
      }
      function ask(media,kind){
        out.textContent='Traduzindo…'; if(say) say.style.display='none';
        askAI(trPrompt(kind==='text'?($('#tr-in').value||'').trim():''), media).then(show).catch(function(e){
          out.textContent=/quota|limit: 0|RESOURCE_EXHAUSTED/i.test(e.message||'')?'Assistente sem cota agora. Use as frases abaixo.':'Não consegui traduzir agora ('+(e.message||'erro')+'). Tente o modo de frases abaixo.';
        });
      }
      $('#tr-go') && ($('#tr-go').onclick=function(){ if(!($('#tr-in').value||'').trim()){ toast('Escreva algo'); return; } ask(null,'text'); });
      $('#tr-cam') && ($('#tr-cam').onchange=function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return; out.textContent='Lendo o cardápio…'; fileToDataUrl(f).then(function(d){ ask(d,'image'); }); });
      var SR=window.SpeechRecognition||window.webkitSpeechRecognition, rec=null, mr=null, ch=[], micEl=$('#tr-mic'), micS=micEl&&micEl.querySelector('span'), on=false;
      function setM(t){ if(micS) micS.textContent=t; }
      if(micEl) micEl.onclick=function(){
        if(SR){
          if(on&&rec){ rec.stop(); return; }
          try{ rec=new SR(); rec.lang='pt-BR'; on=true; setM('Ouvindo…'); out.textContent='Fale…';
            rec.onresult=function(ev){ $('#tr-in').value=ev.results[0][0].transcript||''; on=false; setM('Falar'); ask(null,'text'); };
            rec.onerror=function(){ on=false; setM('Falar'); out.textContent='Não captei. Tente de novo.'; };
            rec.onend=function(){ on=false; setM('Falar'); }; rec.start();
          }catch(e){ out.textContent='Microfone indisponível — digite.'; }
          return;
        }
        if(!navigator.mediaDevices||!window.MediaRecorder){ $('#tr-in').focus(); out.textContent='Use o microfone 🎤 do teclado do iPhone para ditar.'; return; }
        if(on&&mr){ mr.stop(); return; }
        navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
          ch=[]; var mt=''; ['audio/mp4','audio/aac','audio/webm','audio/ogg'].some(function(x){ if(window.MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x)){ mt=x; return true; } return false; });
          mr=mt?new MediaRecorder(st,{mimeType:mt}):new MediaRecorder(st);
          mr.ondataavailable=function(ev){ if(ev.data&&ev.data.size) ch.push(ev.data); };
          mr.onstop=function(){ st.getTracks().forEach(function(t){ t.stop(); }); on=false; setM('Falar'); var b=new Blob(ch,{type:(mr.mimeType||'audio/mp4')}); var fr=new FileReader(); fr.onload=function(){ ask(fr.result,'audio'); }; fr.readAsDataURL(b); };
          on=true; setM('Gravando… toque p/ parar'); out.textContent='Gravando…'; mr.start();
        }).catch(function(){ $('#tr-in').focus(); out.textContent='Sem microfone. Use o 🎤 do teclado do iPhone.'; });
      };
    }
    var X=(state.x2=state.x2||{});
    function scrCaixinhaProxy(){ // garante o extras renderizar a Caixinha c/ aba câmbio
      state.maisSub='caixinha'; prevMais.call(G);
    }
    function consolidateTiles(){
      var grid=$('#mais-content .util-grid'); if(!grid) return;
      // some os ícones redundantes (conteúdo migrou p/ hubs)
      ['cambio','frases','voos','hoteis','dormir','voos2','vitrine','google'].forEach(function(s){
        var t=grid.querySelector('[data-sub="'+s+'"]'); if(t) t.style.display='none';
      });
      function relabel(s,h,p){
        var t=grid.querySelector('[data-sub="'+s+'"]'); if(!t) return;
        var H=t.querySelector('h4'), P=t.querySelector('p'); if(H) H.textContent=h; if(P) P.textContent=p;
      }
      relabel('caixinha','Caixinha','Despesas, saldos e câmbio EUR↔BRL.');
      relabel('conversa','Falar PT-PT','Como dizer, frases e áudio.');
      relabel('reservas','Reservas','Transporte, hospedagem, lazer — tudo aqui.');
    }
    function injectTiles2(){
      var grid=$('#mais-content .util-grid');
      if(!grid||grid.querySelector('[data-sub="nuvem"]')) return;
      var tiles=[
        ['nuvem','globe','Nuvem & Login','Entrar com Google e sincronizar os 4.'],
        ['ondeestao','pin','Onde estão','Mapa ao vivo dos quatro na viagem.'],
        ['reservas','hotel','Reservas','Hospedagem e voos — preencha e compartilhe.'],
        ['integra','arrowR','Integrações','Booking, Splitwise, Calendar, Wallet, Maps.']
      ];
      grid.insertAdjacentHTML('beforeend', tiles.map(function(t){
        return '<button class="util-tile x2-tile" data-sub="'+t[0]+'"><div class="ut-icon">'+ic(t[1])+'</div><h4>'+t[2]+'</h4><p>'+t[3]+'</p></button>';
      }).join(''));
    }

    /* ---------- TELA: NUVEM & LOGIN ---------- */
    function scrNuvem(){
      var cfg=fbCfg();
      var u=(FB&&FB.auth&&FB.auth.currentUser)||null;
      var me=localStorage.getItem(ME_KEY);
      var html=back()+
        '<div class="pad mt-16"><div class="eyebrow">Login e sincronização</div><h2 class="serif" style="margin-top:4px">Nuvem & Login</h2></div>'+
        '<div class="pad">';

      if(!cfg){
        html+='<div class="tl-card"><div class="eyebrow">Modo nativo (ativo agora)</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Sem configuração, o app funciona 100% offline: login por escolha de perfil, sincronização por código colável (Caixinha → Saldos) e localização pelo WhatsApp (aba "Onde estão").</p></div>'+
          '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Ativar login Google + tempo real</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Cole abaixo a configuração do seu projeto Firebase (gratuito). Passo a passo no botão.</p>'+
          '<textarea id="fb-in" class="x2-in" rows="6" placeholder=\'{ "apiKey": "...", "authDomain": "...", "databaseURL": "https://pt-2026-default-rtdb...firebasedatabase.app", "projectId": "...", "appId": "..." }\'></textarea>'+
          '<div class="tl-actions"><button class="tl-action primary" id="fb-save">'+ic('check')+'<span>Salvar e ativar</span></button>'+
          '<button class="tl-action" id="fb-help">'+ic('doc')+'<span>Como obter (5 passos)</span></button></div></div>';
      } else {
        html+='<div class="tl-card"><div class="eyebrow">Firebase configurado</div>'+
          '<div class="text-muted text-small" style="margin-top:6px;font-family:\'JetBrains Mono\',monospace">projeto: '+esc(cfg.projectId)+'</div>'+
          (u? '<div style="display:flex;align-items:center;gap:12px;margin-top:12px">'+
                (u.photoURL?'<img src="'+esc(u.photoURL)+'" referrerpolicy="no-referrer" style="width:48px;height:48px;border-radius:50%;object-fit:cover">':'')+
                '<div><div style="font-family:\'Fraunces\',serif">'+esc(u.displayName||'')+'</div>'+
                '<div class="text-muted text-small">'+esc(u.email||'')+(me?' · '+pname(me):'')+'</div></div></div>'+
                '<div class="tl-actions"><button class="tl-action" id="fb-out">'+ic('warn')+'<span>Sair</span></button></div>'
              : '<button class="x2-btn-primary" id="fb-login" style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:10px">'+
                '<svg viewBox="0 0 18 18" width="18" height="18"><path fill="#fff" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.7z"/><path fill="#fff" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.8.9-3.1.9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z"/></svg>'+
                '<span>Entrar com Google</span></button>')+
          '</div>'+
          '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Trocar configuração</div>'+
          '<textarea id="fb-in" class="x2-in" rows="4" placeholder="colar nova config"></textarea>'+
          '<div class="tl-actions"><button class="tl-action" id="fb-save">'+ic('check')+'<span>Atualizar</span></button>'+
          '<button class="tl-action" id="fb-clear">'+ic('warn')+'<span>Remover (voltar ao nativo)</span></button></div></div>'+
          (isAdmin()? '<div class="tl-card" style="margin-top:14px;border:1px solid var(--terra-50)"><div class="eyebrow" style="color:var(--terra)">Recomeçar do zero</div><p class="text-soft text-small" style="margin-top:6px">Apaga TODOS os dados desta viagem no Firebase (despesas, reservas, voos, perfis/quiz, missões, membros) e recomeça limpo. Irreversível — use antes de alimentar a viagem real.</p><div class="tl-actions"><button class="tl-action" id="cl-reset-trip">'+ic('warn')+'<span>Zerar viagem</span></button></div></div>' : '');
      }
      if(cfg){
        html+='<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Convidar os outros viajantes</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Mande este link para os outros 3. Ao abrir, o app já fica configurado — eles só tocam em <strong>Entrar com Google</strong> e entram na mesma viagem (despesas, mapa, reservas, tudo junto).</p>'+
          '<input id="inv-link" class="x2-in" readonly style="margin-top:8px;font-size:12px" value="">'+
          '<div class="tl-actions">'+
            '<button class="tl-action primary" id="inv-wa">'+ic('whats')+'<span>WhatsApp</span></button>'+
            '<button class="tl-action" id="inv-mail">'+ic('doc')+'<span>E-mail</span></button>'+
            '<button class="tl-action" id="inv-share">'+ic('arrowR')+'<span>Compartilhar</span></button>'+
            '<button class="tl-action" id="inv-copy">'+ic('check')+'<span>Copiar link</span></button>'+
          '</div>'+
          '<p class="text-muted text-small" style="margin-top:6px">Use o seu Gmail para você; cada um entra com a própria conta Google. O lugar de cada um é definido por ordem de entrada.</p></div>';
      }
      html+='<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Assistente "Saiba mais" (IA) · opcional</div>'+
        '<p class="text-soft text-small" style="margin-top:6px">Cole uma chave <strong>Google Gemini</strong> (grátis, sem cartão) e o botão "Saiba mais" do roteiro passa a responder perguntas e analisar fotos dentro do app. Sem chave, ele só abre buscas externas.</p>'+
        '<input id="ai-in" class="x2-in" style="margin-top:8px" placeholder="'+(aiKey()?'•••• configurada — cole outra p/ trocar':'AIza... (cole a chave)')+'">'+
        '<div class="tl-actions">'+
          '<button class="tl-action primary" id="ai-save">'+ic('check')+'<span>Salvar chave</span></button>'+
          (aiKey()?'<button class="tl-action" id="ai-clear">'+ic('warn')+'<span>Remover</span></button>':'')+
          '<a class="tl-action" target="_blank" href="https://aistudio.google.com/apikey">'+ic('web')+'<span>Obter chave grátis</span></a>'+
        '</div></div>';
      html+='</div><div class="spacer-lg"></div>';
      mount(html);
      (function(){
        var li=$('#inv-link'); if(!li) return;
        var link=buildInvite(); li.value=link;
        var msg='Você foi convidado para o PT-2026 — nosso app da viagem a Portugal 🇵🇹.\n\nNo iPhone, abra no Safari, toque em Compartilhar → "Adicionar à Tela de Início", e entre com sua conta Google:\n'+link;
        li.onclick=function(){ li.select(); };
        var c=$('#inv-copy'); if(c) c.onclick=function(){ copy(link); };
        var w=$('#inv-wa'); if(w) w.onclick=function(){ window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); };
        var m=$('#inv-mail'); if(m) m.onclick=function(){ window.location.href='mailto:?subject='+encodeURIComponent('Convite · PT-2026 (app da viagem a Portugal)')+'&body='+encodeURIComponent(msg); };
        var s=$('#inv-share'); if(s) s.onclick=function(){ if(navigator.share) navigator.share({title:'PT-2026 · convite',text:msg,url:link}).catch(function(){ copy(link); }); else copy(link); };
      })();
      var as=$('#ai-save'); if(as) as.onclick=function(){ var v=($('#ai-in').value||'').trim(); if(v.length<20){ toast('Cole a chave Gemini completa'); return; } try{ localStorage.setItem(AI_KEY,v); }catch(e){} toast('Assistente ativado'); scrNuvem(); };
      var ac=$('#ai-clear'); if(ac) ac.onclick=function(){ try{ localStorage.removeItem(AI_KEY); }catch(e){} toast('Assistente removido'); scrNuvem(); };

      var sv=$('#fb-save'); if(sv) sv.onclick=function(){
        var raw=($('#fb-in').value||'').trim();
        var o=parseCfg(raw);
        if(!o||!o.apiKey||!o.projectId){ alert('Config inválida. Cole o objeto firebaseConfig inteiro.'); return; }
        setFbCfg(o); FB=null; fbReady=false;
        toast('Firebase salvo');
        loadFirebase().then(function(){ checkRedirect(); scrNuvem(); }).catch(function(e){ alert('Falha ao carregar Firebase: '+(e.message||e)); });
      };
      var hp=$('#fb-help'); if(hp) hp.onclick=function(){ fbHelpModal(); };
      var lg=$('#fb-login'); if(lg) lg.onclick=function(){ lg.textContent='Abrindo Google…'; googleSignIn().then(function(){ }).catch(function(e){ alert('Erro no login: '+(e&&e.message||e)); scrNuvem(); }); };
      var ot=$('#fb-out'); if(ot) ot.onclick=function(){ if(FB) FB.a.signOut(FB.auth).then(function(){ stopShareLocation(); toast('Saiu'); scrNuvem(); }); };
      var cl=$('#fb-clear'); if(cl) cl.onclick=function(){ if(confirm('Remover Firebase e voltar ao modo nativo?')){ localStorage.removeItem(FB_KEY); localStorage.removeItem(ME_KEY); FB=null; toast('Voltou ao nativo'); scrNuvem(); } };
      var rz=$('#cl-reset-trip'); if(rz) rz.onclick=function(){
        if(!isAdmin()) return;
        if(!(FB && FB.auth && FB.auth.currentUser)){ alert('Entre com Google primeiro — a limpeza precisa de login.'); return; }
        if(!confirm('ZERAR a viagem? Isto apaga TODAS as informações compartilhadas no Firebase (despesas, reservas, voos, perfis/quiz, missões, membros). NÃO dá para desfazer.')) return;
        if(prompt('Para confirmar, digite ZERAR (em maiúsculas):')!=='ZERAR'){ toast('Cancelado'); return; }
        loadFirebase().then(function(fb){
          fb.d.set(rref('trips/'+TRIP), null).then(function(){
            try{ Object.keys(localStorage).forEach(function(k){ if(/^pt2026:(quiz:|trip:|event_overrides|fb:gcal|fb:consent)/.test(k)) localStorage.removeItem(k); }); }catch(e){}
            try{ if(state.x2){ state.x2.expenses=[]; state.x2.stays=[]; state.x2.tickets=[]; state.x2.flights=null; state.x2.quiz={}; state.x2.trip=null; state.x2.albumLink=''; } state.missions={}; saveState(); }catch(e){}
            toast('Viagem zerada — recomeçando do zero');
            setTimeout(function(){ try{ if(typeof forceUpdate==='function'){ forceUpdate(); return; } }catch(e){} location.reload(); }, 900);
          }).catch(function(e){ alert('Falha ao zerar: '+(e&&e.message||e)); });
        }).catch(function(e){ alert('Firebase indisponível: '+(e&&e.message||e)); });
      };
    }
    function parseCfg(raw){
      if(!raw) return null;
      try{ return JSON.parse(raw); }catch(e){}
      // tolera o trecho "const firebaseConfig = {...};" copiado do console
      var m=raw.match(/\{[\s\S]*\}/);
      if(m){ try{ return (new Function('return ('+m[0].replace(/(\w+)\s*:/g,'"$1":').replace(/'/g,'"')+')'))(); }catch(e){}
             try{ return (new Function('return ('+m[0]+')'))(); }catch(e){} }
      return null;
    }
    function fbHelpModal(){
      var steps=[
        '1. console.firebase.google.com → criar projeto (nome: pt-2026). Pode pular Analytics/Gemini.',
        '2. Botão "＋ Adicionar app" → ícone Web (</>). Apelido pt-2026. Registrar. Copie o firebaseConfig.',
        '3. Authentication → Vamos começar → Google → Ativar → Salvar. Em Configurações → Domínios autorizados, adicione lucky-yeot-7b5f9c.netlify.app',
        '4. Realtime Database (NÃO o Firestore) → Criar banco de dados → região Bélgica/Europa → modo bloqueado/produção. Copie a URL que termina em .firebasedatabase.app',
        '5. Aba "Regras" do Realtime Database → cole a regra abaixo → Publicar. Depois cole aqui a config JÁ COM a linha "databaseURL".'
      ];
      var o=document.createElement('div'); o.className='x2-lb'; o.style.background='rgba(20,16,10,.96)';
      o.innerHTML='<div style="background:var(--surface);max-width:420px;width:100%;border-radius:20px;padding:24px;max-height:80vh;overflow:auto">'+
        '<h2 class="serif" style="font-size:20px">Firebase em 5 passos</h2>'+
        '<p class="text-soft text-small" style="margin:8px 0 14px">Gratuito, ~15 min, uma vez só. Depois os 4 usam só "Entrar com Google".</p>'+
        steps.map(function(s){ return '<p style="font-size:13px;line-height:1.55;margin-bottom:10px">'+esc(s)+'</p>'; }).join('')+
        '<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px;font-family:\'JetBrains Mono\',monospace;font-size:11px;white-space:pre-wrap;margin:8px 0">{\n  "rules": {\n    "trips": {\n      ".read": "auth != null",\n      ".write": "auth != null"\n    }\n  }\n}</div>'+
        '<button class="x2-btn-primary" id="fbh-x" style="margin-top:8px">Entendi</button></div>';
      document.body.appendChild(o);
      o.addEventListener('click',function(e){ if(e.target===o||e.target.id==='fbh-x') o.remove(); });
    }

    /* ---------- TELA: ONDE ESTÃO ---------- */
    function scrOndeEstao(){
      var sharing=localStorage.getItem(SHARE_KEY)==='1';
      var hasFb=!!FB&&!!FB.auth&&!!FB.auth.currentUser;
      var people=PIDS.map(function(p){
        var d=locCache[p];
        return { id:p, d:d };
      });
      var anyLoc=people.some(function(x){return x.d;});
      var listH=people.map(function(x){
        if(!x.d) return '<div class="x2-balrow"><span class="x2-chip" style="--pc:'+PCOLOR[x.id]+'">'+pname(x.id)+'</span><span class="text-muted text-small">sem posição ainda</span></div>';
        var ago=Math.round((Date.now()-(x.d.ts||0))/60000);
        var maps='https://maps.google.com/?q='+x.d.lat+','+x.d.lng;
        return '<div class="x2-balrow"><span class="x2-chip" style="--pc:'+PCOLOR[x.id]+'">'+pname(x.id)+'</span>'+
          '<span style="text-align:right"><a class="tl-action" style="display:inline-flex" target="_blank" href="'+maps+'">'+ic('map')+'<span>ver no mapa</span></a>'+
          '<div class="text-muted text-small">há '+(ago<1?'instantes':ago+' min')+' · ±'+(x.d.acc||0)+'m</div></span></div>';
      }).join('');
      var allMaps='';
      var pts=people.filter(function(x){return x.d;}).map(function(x){ return x.d.lat+','+x.d.lng; });
      if(pts.length) allMaps='https://www.google.com/maps/dir/'+pts.join('/');

      var fbBlock = !fbCfg()
        ? '<div class="tl-card"><div class="eyebrow">Modo nativo</div><p class="text-soft text-small" style="margin-top:6px">Para o mapa ao vivo dentro do PT-2026 (estilo "Buscar"), ative o Firebase em <strong>Mais → Nuvem & Login</strong>. Sem isso, use os botões nativos abaixo — funcionam hoje, sem nada.</p></div>'
        : (!hasFb
          ? '<div class="tl-card"><p class="text-soft text-small">Entre com Google em <strong>Mais → Nuvem & Login</strong> para ver e compartilhar a localização ao vivo dos quatro.</p></div>'
          : '<div class="tl-card"><div class="eyebrow">Localização ao vivo dos quatro</div>'+
            (anyLoc?'<div style="margin-top:10px">'+listH+'</div>':'<p class="text-soft text-small" style="margin-top:6px">Ninguém compartilhando ainda. Ative o seu abaixo.</p>')+
            (allMaps?'<div class="tl-actions"><a class="tl-action primary" target="_blank" href="'+allMaps+'">'+ic('map')+'<span>Ver todos no mapa</span></a></div>':'')+
            '<div class="tl-actions"><button class="tl-action '+(sharing?'':'primary')+'" id="loc-toggle">'+ic('pin')+'<span>'+(sharing?'Parar de compartilhar':'Compartilhar minha localização ao vivo')+'</span></button></div>'+
            '<p class="text-muted text-small" style="margin-top:6px">Só os quatro veem. Atualiza a cada ~25s enquanto o app está aberto. '+(tripActive()?'':'(Fora do período da viagem.)')+'</p></div>');

      mount(back()+
        '<div class="pad mt-16"><div class="eyebrow">Tipo "Buscar", entre os quatro</div><h2 class="serif" style="margin-top:4px">Onde estão</h2></div>'+
        '<div class="pad">'+fbBlock+
        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Nativo do iPhone (sem config)</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Manda sua posição agora no grupo, ou use a Localização ao Vivo do próprio WhatsApp / app Buscar da Apple.</p>'+
          '<div class="tl-actions">'+
            '<button class="tl-action primary" id="loc-wa">'+ic('whats')+'<span>Mandar minha posição no grupo</span></button>'+
            '<a class="tl-action" target="_blank" href="https://wa.me/">'+ic('whats')+'<span>Abrir WhatsApp</span></a>'+
          '</div>'+
          '<p class="text-muted text-small" style="margin-top:6px">No WhatsApp: anexo (＋) → Localização → <strong>Localização em tempo real</strong>. No iPhone: app Buscar → Pessoas → Compartilhar Localização com os outros 3.</p>'+
        '</div>'+
        '</div><div class="spacer-lg"></div>');

      var tg=$('#loc-toggle'); if(tg) tg.onclick=function(){ if(localStorage.getItem(SHARE_KEY)==='1'){ stopShareLocation(); toast('Parou'); } else { startShareLocation(); toast('Compartilhando ao vivo'); } scrOndeEstao(); };
      var wa=$('#loc-wa'); if(wa) wa.onclick=shareLocationNative;
    }

    /* ---------- TELA: INTEGRAÇÕES ---------- */
    /* ---------- TELA: RESERVAS (hospedagem/voos) editáveis e sincronizadas ---------- */
    var STAYFILE_KEY='pt2026:x2:stayfile';
    function stays(){ state.x2=state.x2||{}; state.x2.stays=state.x2.stays||[]; return state.x2.stays; }
    function stayFiles(){ return jget(STAYFILE_KEY,{}); }
    function parseRes(txt){
      var t=txt||'', out={};
      var conf=(t.match(/\b\d{3,4}[.\s]\d{3}[.\s]\d{3}\b/)||[])[0] || (t.match(/(?:reserva|booking|localizador|c[oó]digo|confirmation|PNR)[^A-Z0-9]{0,12}([A-Z0-9]{5,12})/i)||[])[1] || '';
      var pin=(t.match(/PIN[^\d]{0,8}(\d{4})/i)||[])[1]||'';
      var url=(t.match(/https?:\/\/[^\s"']+/i)||[])[0]||'';
      var MES='jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
      var dre=new RegExp('\\b\\d{1,2}\\s*(?:de\\s*)?(?:'+MES+')\\.?\\s*(?:de\\s*)?\\d{2,4}\\b|\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}\\b','gi');
      var ds=(t.replace(/\b\d{3,4}[.\s]\d{3}[.\s]\d{3}\b/g,' ').match(dre)||[]);
      out.conf=conf+(pin?(' · PIN '+pin):''); out.url=url; out.inDate=ds[0]||''; out.outDate=ds[1]||'';
      return out;
    }
    var RCAT=[['transporte','Transporte'],['hospedagem','Hospedagem'],['lazer','Lazer'],['outros','Outros']];
    var RCC={ transporte:'#3E6E78', hospedagem:'#5E7355', lazer:'#D4A85F', outros:'#8C8276' };
    function catOf(s){ return s.cat || (s.type==='voo'?'transporte':s.type==='hotel'?'hospedagem':'outros'); }
    function refCards(cat){
      var H=G.HOTELS||[];
      if(cat==='hospedagem'){
        return H.map(function(h){
          return '<div class="tl-card" style="margin-top:10px;border-left:3px solid #5E7355"><div class="eyebrow">Reserva confirmada · '+esc(h.city)+'</div>'+
            '<strong style="font-family:\'Fraunces\',serif;font-size:17px">'+esc(h.name)+'</strong>'+
            '<div class="text-soft text-small" style="margin-top:4px">'+esc(h.address||'')+'</div>'+
            '<div class="x2-kv"><div><span>Check-in</span><strong>'+esc((h.in||'')+' '+(h.checkIn||''))+'</strong></div>'+
              '<div><span>Check-out</span><strong>'+esc((h.out||'')+' '+(h.checkOut||''))+'</strong></div>'+
              '<div><span>Reserva</span><strong>'+esc(h.conf||'—')+'</strong></div><div><span>PIN</span><strong>'+esc(h.pin||'—')+'</strong></div></div>'+
            '<div class="tl-actions"><a class="tl-action primary" target="_blank" href="'+mapsUrl(h.mapsQuery||h.address)+'">'+ic('map')+'<span>Como chegar</span></a>'+
              (h.phone?'<a class="tl-action" href="'+telUrl(h.phone)+'">'+ic('phone')+'<span>Ligar</span></a><a class="tl-action" target="_blank" href="https://wa.me/'+String(h.phone).replace(/[^\d]/g,'')+'">'+ic('whats')+'<span>WhatsApp</span></a>':'')+'</div></div>';
        }).join('');
      }
      if(cat==='transporte'){
        var F=[['TAP TP 12','Fortaleza (FOR) → Lisboa (LIS)','21/05 22:55 → 22/05 10:30','XMQFRJ'],
               ['TAP TP 1948','Lisboa (LIS) → Porto (OPO)','22/05 12:40 → 22/05 13:40','XMQFRJ'],
               ['TAP TP 35','Lisboa (LIS) → Fortaleza (FOR)','29/05 17:40 → 29/05 22:05','XMQFRJ']];
        return F.map(function(f){
          return '<div class="tl-card" style="margin-top:10px;border-left:3px solid #3E6E78"><div class="eyebrow">Voo confirmado</div>'+
            '<strong style="font-family:\'Fraunces\',serif;font-size:16px">'+f[0]+'</strong>'+
            '<div class="text-soft text-small" style="margin-top:4px">'+f[1]+'</div><div class="text-muted text-small">'+f[2]+'</div>'+
            '<div class="x2-kv"><div><span>Localizador</span><strong>'+f[3]+'</strong></div></div>'+
            '<div class="tl-actions"><a class="tl-action" target="_blank" href="https://www.flightaware.com/live/flight/'+f[0].replace(/\s/g,'')+'">'+ic('clock')+'<span>Status</span></a></div></div>';
        }).join('') + '<div class="tl-card" style="margin-top:10px;border-left:3px solid #3E6E78"><div class="eyebrow">Carro</div><strong style="font-family:\'Fraunces\',serif">Sixt — aluguer</strong><div class="text-soft text-small" style="margin-top:4px">Retirada e devolução conferir no voucher. Atenção ao horário apertado de devolução no último dia.</div></div>';
      }
      if(cat==='lazer'){
        var T=(state.x2&&state.x2.tickets)||[];
        return T.length ? T.map(function(t){
          return '<div class="tl-card" style="margin-top:10px;border-left:3px solid #D4A85F"><div class="eyebrow">Ingresso</div><strong style="font-family:\'Fraunces\',serif;font-size:16px">'+esc(t.name||'')+'</strong>'+
            '<div class="text-soft text-small" style="margin-top:4px">'+esc((t.dt||'')+(t.place?' · '+t.place:'')+(t.price?' · '+t.price:''))+'</div>'+(t.note?'<div class="text-muted text-small">'+esc(t.note)+'</div>':'')+'</div>';
        }).join('') : '';
      }
      return '';
    }
    function scrReservas(){
      var L=stays(), F=stayFiles();
      var cur=(state.x2&&state.x2._rcat)||'hospedagem';
      var tabs='<div class="pad"><div class="x2-segment">'+RCAT.map(function(c){ return '<button class="x2-seg'+(cur===c[0]?' on':'')+'" data-rcat="'+c[0]+'">'+c[1]+'</button>'; }).join('')+'</div></div>';
      var ref=refCards(cur);
      var mine=L.filter(function(s){ return catOf(s)===cur; });
      var items = mine.length ? mine.slice().sort(function(a,b){return (a.inDate||'').localeCompare(b.inDate||'');}).map(function(s){
        var f=F[s.id], cc=RCC[catOf(s)]||'#999';
        return '<div class="tl-card" style="margin-top:12px">'+
          '<div style="display:flex;justify-content:space-between;gap:10px"><div><span class="x2-chip" style="--pc:'+cc+'">preenchido</span> <strong style="font-family:\'Fraunces\',serif;font-size:17px">'+esc(s.name||'(sem nome)')+'</strong>'+(s.city?'<div class="text-muted text-small">'+esc(s.city)+'</div>':'')+'</div>'+
          '<button class="x2-del" data-rdel="'+s.id+'">remover</button></div>'+
          '<div class="x2-kv">'+
            '<div><span>Entrada/Partida</span><strong>'+esc(s.inDate||'—')+(s.inTime?' '+esc(s.inTime):'')+'</strong></div>'+
            '<div><span>Saída/Chegada</span><strong>'+esc(s.outDate||'—')+(s.outTime?' '+esc(s.outTime):'')+'</strong></div>'+
            '<div><span>Código</span><strong>'+esc(s.conf||'—')+'</strong></div>'+
            (s.url?'<div><span>Local</span><strong><a href="'+esc(s.url)+'" target="_blank">abrir ↗</a></strong></div>':'')+
          '</div>'+
          (s.note?'<div class="text-muted text-small" style="margin-top:6px">'+esc(s.note)+'</div>':'')+
          '<div class="text-muted text-small" style="margin-top:6px">por '+esc(pname(s.by||'')||s.by||'?')+'</div>'+
          (f?('<div class="x2-attwrap" style="margin-top:8px"><div class="x2-att">'+(/^data:image\//.test(f.d)?'<img src="'+f.d+'" data-rview="'+s.id+'">':'<a class="x2-att-pdf" href="'+f.d+'" download="'+esc(f.name)+'">'+ic('doc')+'<span>'+esc(f.name)+'</span></a>')+'</div></div>'):'')+
          '<div class="tl-actions"><button class="tl-action" data-redit="'+s.id+'">'+ic('doc')+'<span>Editar</span></button>'+
            '<label class="tl-action"><input type="file" accept="image/*,application/pdf" data-rfile="'+s.id+'" style="display:none">'+ic('view')+'<span>Anexar PDF/imagem</span></label></div>'+
        '</div>';
      }).join('') : '';

      mount(back()+
        '<div class="pad mt-16"><div class="eyebrow">Tudo da viagem num lugar · sincroniza entre os quatro</div><h2 class="serif" style="margin-top:4px">Reservas</h2></div>'+
        tabs+
        '<div class="pad">'+
          (ref||'')+
          (items||(ref?'':'<div class="tl-card" style="margin-top:10px"><p class="text-soft text-small">Nada em '+cur+' ainda. Adicione abaixo.</p></div>'))+
          '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Adicionar em '+cur+'</div>'+
            '<label class="x2-att-add" style="width:100%;height:auto;padding:16px;border-radius:14px;flex-direction:column;gap:6px;text-align:center;margin-top:8px">'+
              '<input type="file" accept="image/*,application/pdf" id="r-doc" style="display:none">'+
              ic('doc')+'<strong style="font-size:14px">Subir PDF ou imagem da reserva</strong>'+
              '<span style="font-weight:400;color:var(--ink-muted);font-size:11.5px">o app lê o documento e preenche sozinho — depois é só Salvar</span>'+
            '</label>'+
            '<div id="r-docprog" class="text-muted text-small" style="margin-top:8px;display:none"></div>'+
            '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--ink-muted)">ou colar o texto manualmente</summary>'+
            '<textarea id="r-paste" class="x2-in" rows="3" style="margin-top:8px" placeholder="Cole o e-mail/texto da confirmação"></textarea>'+
            '<div class="tl-actions"><button class="tl-action" id="r-extract">'+ic('check')+'<span>Extrair do texto</span></button></div></details>'+
            '<label class="x2-l" style="margin-top:8px">Nome</label><input id="r-name" class="x2-in" placeholder="Ex.: Casa Rosa / Voo TP12 / Tour Douro">'+
            '<label class="x2-l" style="margin-top:8px">Cidade / trecho</label><input id="r-city" class="x2-in" placeholder="Ex.: Porto / LIS→OPO">'+
            '<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="x2-l">Entrada/Partida — data</label><input id="r-ind" class="x2-in" placeholder="22/05/2026"></div><div style="width:90px"><label class="x2-l">hora</label><input id="r-int" class="x2-in" placeholder="16:00"></div></div>'+
            '<div style="display:flex;gap:8px;margin-top:8px"><div style="flex:1"><label class="x2-l">Saída/Chegada — data</label><input id="r-outd" class="x2-in" placeholder="25/05/2026"></div><div style="width:90px"><label class="x2-l">hora</label><input id="r-outt" class="x2-in" placeholder="11:00"></div></div>'+
            '<label class="x2-l" style="margin-top:8px">URL do local / reserva</label><input id="r-url" class="x2-in" placeholder="https://...">'+
            '<label class="x2-l" style="margin-top:8px">Código da reserva</label><input id="r-conf" class="x2-in" placeholder="5234.571.091 / XMQFRJ">'+
            '<label class="x2-l" style="margin-top:8px">Observação</label><input id="r-note" class="x2-in" placeholder="Cofre, portão, bagagem...">'+
            '<button id="r-save" class="x2-btn-primary" style="margin-top:14px">Salvar em '+cur+'</button></div>'+
        '</div><div class="spacer-lg"></div>');

      $$('[data-rcat]').forEach(function(b){ b.onclick=function(){ state.x2._rcat=b.dataset.rcat; saveState(); scrReservas(); }; });
      var rtype=cur, pendingDoc=null;
      function fill(p){
        if(p.conf) $('#r-conf').value=p.conf;
        if(p.url) $('#r-url').value=p.url;
        if(p.inDate) $('#r-ind').value=p.inDate;
        if(p.outDate) $('#r-outd').value=p.outDate;
      }
      var rdoc=$('#r-doc'), rprog=$('#r-docprog');
      if(rdoc) rdoc.onchange=function(e){
        var f=e.target.files&&e.target.files[0]; if(!f) return;
        rprog.style.display='block'; rprog.textContent='Abrindo o documento…';
        extractDoc(f, function(msg){ rprog.textContent=msg; }).then(function(r){
          pendingDoc={ name:f.name, d:r.dataUrl };
          var p=parseRes(r.text||''); fill(p);
          if(!$('#r-name').value) $('#r-name').value=guessName(r.text, f.name);
          var got=[p.conf&&'código', (p.inDate||p.outDate)&&'datas', p.url&&'link'].filter(Boolean);
          rprog.textContent = got.length ? ('Pronto — preenchi: '+got.join(', ')+'. Confira e Salve.') : 'Documento anexado. Não achei os campos automaticamente — preencha e Salve (o arquivo já vai junto).';
          toast('Documento lido');
        }).catch(function(){
          // falha (PDF escaneado/sem texto, sem rede p/ OCR): anexa mesmo assim
          fileToDataUrl(f).then(function(d){ pendingDoc={name:f.name,d:d}; });
          rprog.textContent='Não consegui ler automaticamente — o arquivo será anexado; preencha os campos e Salve.';
        });
      };
      var rx=$('#r-extract'); if(rx) rx.onclick=function(){
        fill(parseRes($('#r-paste').value||''));
        if(!$('#r-name').value) $('#r-name').value=guessName($('#r-paste').value,'');
        toast('Campos preenchidos do texto');
      };
      var rs=$('#r-save'); if(rs) rs.onclick=function(){
        var nm=($('#r-name').value||'').trim(); if(!nm){ toast('Dê um nome'); return; }
        var id='s'+Date.now()+Math.random().toString(36).slice(2,5);
        stays().push({ id:id, cat:rtype, type:(rtype==='transporte'?'voo':rtype==='hospedagem'?'hotel':rtype), name:nm,
          city:$('#r-city').value||'', inDate:$('#r-ind').value||'', inTime:$('#r-int').value||'',
          outDate:$('#r-outd').value||'', outTime:$('#r-outt').value||'', url:($('#r-url').value||'').trim(),
          conf:$('#r-conf').value||'', note:$('#r-note').value||'', by:localStorage.getItem(ME_KEY)||activeId(), ts:Date.now() });
        if(pendingDoc){ var m=stayFiles(); m[id]=pendingDoc; jset(STAYFILE_KEY,m); }
        saveState(); toast('Reserva salva e compartilhada'); scrReservas();
      };
      $$('[data-rdel]').forEach(function(b){ b.onclick=function(){ if(confirm('Remover esta reserva?')){ state.x2.stays=stays().filter(function(s){return s.id!==b.dataset.rdel;}); saveState(); scrReservas(); } }; });
      $$('[data-redit]').forEach(function(b){ b.onclick=function(){
        var s=stays().filter(function(x){return x.id===b.dataset.redit;})[0]; if(!s) return;
        $('#r-name').value=s.name||''; $('#r-city').value=s.city||''; $('#r-ind').value=s.inDate||''; $('#r-int').value=s.inTime||'';
        $('#r-outd').value=s.outDate||''; $('#r-outt').value=s.outTime||''; $('#r-url').value=s.url||''; $('#r-conf').value=s.conf||''; $('#r-note').value=s.note||'';
        state.x2.stays=stays().filter(function(x){return x.id!==s.id;}); saveState();
        try{ window.scrollTo(0,0); }catch(e){} toast('Editando — salve para atualizar');
      }; });
      $$('[data-rfile]').forEach(function(inp){ inp.onchange=function(e){
        var f=e.target.files&&e.target.files[0]; if(!f) return;
        fileToDataUrl(f).then(function(d){ var m=stayFiles(); m[inp.dataset.rfile]={name:f.name,d:d}; if(jset(STAYFILE_KEY,m)){ toast('Anexado'); scrReservas(); } });
      }; });
      $$('[data-rview]').forEach(function(im){ im.onclick=function(){ lightbox(im.src); }; });
    }

    function scrIntegra(){
      var HOTELS=G.HOTELS||[];
      var bookingCards=HOTELS.map(function(h){
        return '<div class="x2-balrow"><div><strong>'+esc(h.name)+'</strong><div class="text-muted text-small">'+esc(h.city)+' · reserva '+esc(h.conf||'—')+'</div></div>'+
          '<a class="tl-action" style="display:inline-flex" target="_blank" href="https://secure.booking.com/myreservations.html">'+ic('arrowR')+'<span>abrir</span></a></div>';
      }).join('');
      mount(back()+
        '<div class="pad mt-16"><div class="eyebrow">Pontes nativas</div><h2 class="serif" style="margin-top:4px">Integrações</h2></div>'+
        '<div class="pad">'+

        '<div class="tl-card"><div class="eyebrow">'+ic('hotel')+' Booking.com</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">O Booking não tem API pública para puxar reservas automaticamente. O caminho real: abrir "Minhas reservas" e, se quiser, colar o e-mail de confirmação — o app extrai código, datas e PIN e guarda como nota do hotel.</p>'+
          '<div style="margin-top:10px">'+bookingCards+'</div>'+
          '<textarea id="bk-in" class="x2-in" rows="4" style="margin-top:10px" placeholder="Cole aqui o texto do e-mail de confirmação do Booking..."></textarea>'+
          '<div class="tl-actions"><button class="tl-action primary" id="bk-parse">'+ic('check')+'<span>Extrair dados</span></button>'+
          '<a class="tl-action" target="_blank" href="https://secure.booking.com/myreservations.html">'+ic('web')+'<span>Minhas reservas</span></a></div>'+
          '<div id="bk-out" class="text-soft text-small" style="margin-top:8px"></div></div>'+

        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">'+ic('euro')+' Splitwise</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">A Caixinha já substitui o Splitwise. Se o grupo insistir nele, exporte os lançamentos formatados e cole lá.</p>'+
          '<div class="tl-actions"><button class="tl-action primary" id="sw-exp">'+ic('doc')+'<span>Exportar lançamentos</span></button>'+
          '<a class="tl-action" target="_blank" href="https://secure.splitwise.com">'+ic('web')+'<span>Abrir Splitwise</span></a></div></div>'+

        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">'+ic('clock')+' Google Calendar</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Manda os 47 eventos do roteiro para o seu calendário, <strong>já com lembrete que toca antes</strong> (30 min antes; 3 h antes em voos, check-in e reservas) — funciona com o app fechado, offline e sem login, em qualquer iPhone.</p>'+
          '<div class="tl-actions"><button class="tl-action primary" id="cal-ics">'+ic('doc')+'<span>Baixar .ics (roteiro)</span></button>'+
          '<button class="tl-action" data-sub="google">'+ic('arrowR')+'<span>Opções Google</span></button></div></div>'+

        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">'+ic('map')+' Google Maps offline</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">App web não baixa mapa offline (só o app do Google Maps faz). Faça uma vez antes de viajar: abra o Google Maps → seu perfil → "Mapas off-line" → selecione Norte de Portugal + Lisboa + Douro.</p>'+
          '<div class="tl-actions"><a class="tl-action primary" target="_blank" href="https://www.google.com/maps/@41.0,-8.4,8z">'+ic('map')+'<span>Abrir região no Maps</span></a></div></div>'+

        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">'+ic('plane')+' Apple Wallet</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">A Wallet só aceita passe .pkpass assinado pela companhia/Apple Developer. O cartão de embarque em tela cheia (Decolagens) é o substituto prático. Se a TAP enviar um link .pkpass, cole abaixo que vira botão da Wallet.</p>'+
          '<input id="wl-in" class="x2-in" style="margin-top:8px" placeholder="https://...boardingpass.pkpass">'+
          '<div class="tl-actions"><button class="tl-action primary" id="wl-save">'+ic('check')+'<span>Salvar passe</span></button>'+
          (state.x2&&state.x2.pkpass?'<a class="tl-action" href="'+esc(state.x2.pkpass)+'">'+ic('bookmark')+'<span>Adicionar à Wallet</span></a>':'')+'</div></div>'+

        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">'+ic('sun')+' Clima do iPhone</div>'+
          '<p class="text-soft text-small" style="margin-top:6px">Nenhum app lê os dados do app Clima da Apple (ela não expõe). A previsão no app usa fonte equivalente. Botão abaixo abre o app Clima nativo.</p>'+
          '<div class="tl-actions"><a class="tl-action primary" href="weather://">'+ic('sun')+'<span>Abrir Clima do iPhone</span></a></div></div>'+

        '</div><div class="spacer-lg"></div>');

      var bp=$('#bk-parse'); if(bp) bp.onclick=function(){
        var t=$('#bk-in').value||'';
        var conf=(t.match(/\b\d{3,4}[.\s]\d{3}[.\s]\d{3}\b/)||[])[0]||'';
        var pin=(t.match(/PIN[^\d]{0,8}(\d{4})/i)||[])[1]||'';
        var tClean=t.replace(/\b\d{3,4}[.\s]\d{3}[.\s]\d{3}\b/g,' ');
        var MES='jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
        var dre=new RegExp('\\b\\d{1,2}\\s*(?:de\\s*)?(?:'+MES+')\\.?\\s*(?:de\\s*)?\\d{2,4}\\b|\\b\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}\\b','gi');
        var dates=(tClean.match(dre)||[]).slice(0,2);
        var out=conf||pin||dates.length? ('Encontrado → '+(conf?'Reserva '+conf+'  ':'')+(pin?'PIN '+pin+'  ':'')+(dates.length?'Datas '+dates.join(' / '):'')) : 'Não encontrei código/PIN no texto colado.';
        $('#bk-out').textContent=out;
        if(conf||pin){ state.x2=state.x2||{}; state.x2.bookingNote=out; saveState(); }
      };
      var se=$('#sw-exp'); if(se) se.onclick=function(){
        var x=(state.x2&&state.x2.expenses)||[];
        if(!x.length){ toast('Sem lançamentos'); return; }
        var txt='Despesas Portugal 2026 (para Splitwise):\n'+x.map(function(e){ return '• '+(e.desc||e.category)+' — €'+Number(e.amount).toFixed(2)+' (pagou '+pname(e.payer)+')'; }).join('\n');
        copy(txt);
      };
      var ci=$('#cal-ics'); if(ci) ci.onclick=function(){ try{ G.downloadICS&&G.downloadICS(); }catch(e){ toast('Use Mais → Calendar'); } };
      var ws=$('#wl-save'); if(ws) ws.onclick=function(){ var v=($('#wl-in').value||'').trim(); if(!/^https?:\/\//.test(v)){ toast('Cole um link .pkpass'); return; } state.x2=state.x2||{}; state.x2.pkpass=v; saveState(); toast('Passe salvo'); scrIntegra(); };
    }

    /* ---------- Clima: botão "abrir app Clima do iPhone" ---------- */
    /* ---------- Hoje: card "Passagens & período" bem na cara ---------- */
    function injectHojeTrip(){
      var host=$('#hoje-content'); if(!host || host.querySelector('#cl-hojetrip')) return;
      var tp=(state.x2&&state.x2.trip)||null;
      var set=!!(tp&&(tp.start||tp.dests));
      var wrap=document.createElement('div'); wrap.className='pad'; wrap.id='cl-hojetrip'; wrap.style.marginTop='14px';
      if(set){
        wrap.innerHTML='<div class="tl-card" style="border-left:3px solid var(--olive)">'+
          '<div class="eyebrow">✈️ Sua viagem</div>'+
          '<div style="font-family:\'Fraunces\',serif;font-size:16px;margin-top:4px">'+esc((tp.start||'?')+(tp.end?(' → '+tp.end):''))+'</div>'+
          (tp.dests?'<div class="text-soft text-small" style="margin-top:2px">'+esc(tp.dests)+'</div>':'')+
          '<div class="tl-actions"><button class="tl-action" id="cl-trip-edit">'+ic('plane')+'<span>Atualizar passagens / período</span></button></div></div>';
      } else {
        wrap.innerHTML='<div class="tl-card" style="border:1px solid var(--gold);background:var(--surface-2)">'+
          '<div class="eyebrow" style="color:var(--terra)">Comece por aqui</div>'+
          '<div style="font-family:\'Fraunces\',serif;font-size:17px;margin-top:4px">Cadastre suas passagens e o período</div>'+
          '<p class="text-soft text-small" style="margin-top:4px">Suba o PDF/print da passagem — o app lê sozinho — ou preencha à mão. Vale para o grupo.</p>'+
          '<button id="cl-trip-go" class="x2-btn-primary" style="margin-top:12px">✈️ Cadastrar agora</button></div>';
      }
      var first=host.firstChild; host.insertBefore(wrap, first);
      var g=$('#cl-trip-go'); if(g) g.onclick=function(){ flightSetup(); };
      var e=$('#cl-trip-edit'); if(e) e.onclick=function(){ flightSetup(); };
    }
    var prevHojeT=G.renderHoje;
    if(typeof prevHojeT==='function'){
      G.renderHoje=function(){ prevHojeT.apply(this,arguments); setTimeout(injectHojeTrip,0); };
    }

    /* ---------- Welcome: Google em primeiro plano ---------- */
    function enhanceWelcome(){
      var w=$('#welcome'); if(!w||w.hidden) return;
      if($('#cl-welcome-g')) return;
      var head=w.querySelector('.welcome-head');
      if(!head) return;
      // Sem Firebase configurado (link puro): NÃO sequestrar a tela.
      // Mantém o modo nativo documentado — escolher perfil e entrar offline,
      // sem dead-end de "configure o Firebase" e sem abrir Nuvem & Login.
      if(!fbCfg()) return;
      // Com Firebase (via link de convite): só o botão Google — esconde grade de perfis, "visita" e o botão Google legado.
      var g=$('#welcome-grid'); if(g) g.style.display='none';
      var gb=$('#btn-google-welcome'); if(gb){ var gw=gb.parentNode; (gw||gb).style.display='none'; }
      var foot=w.querySelector('.welcome-foot'); if(foot) foot.style.display='none';
      var ttl=w.querySelector('.welcome-title'); if(ttl) ttl.textContent='Bem-vindo';
      var sub=w.querySelector('.welcome-sub'); if(sub) sub.textContent='Entre com sua conta Google. O app reconhece quem é você.';
      var box=document.createElement('div');
      box.style.cssText='max-width:520px;margin:22px auto 4px;text-align:center';
      box.innerHTML='<button id="cl-welcome-g" class="x2-btn-primary" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;max-width:320px">'+
        '<svg viewBox="0 0 18 18" width="18" height="18"><path fill="#fff" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.7z"/><path fill="#fff" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.8.9-3.1.9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z"/></svg>'+
        '<span>Entrar com Google</span></button>'+
        '<div id="cl-welcome-hint" style="font-size:11.5px;color:var(--ink-muted);margin-top:8px"></div>';
      head.parentNode.insertBefore(box, head.nextSibling);
      $('#cl-welcome-g').onclick=function(){
        if(!fbCfg()){
          // App ainda não configurado neste dispositivo (ex.: preview local).
          // Só o gerente configura; demais usuários nunca veem isto em produção.
          if(confirm('Este dispositivo ainda não tem o Firebase configurado. Abrir as instruções de configuração (gerente)?')){
            try{ G.setActiveProfile&&G.setActiveProfile('caio'); }catch(e){}
            state.maisSub='nuvem'; saveState(); try{ G.goTo('mais'); }catch(e){}
          }
          return;
        }
        var _gb=this; _gb.textContent='Abrindo Google…';
        googleSignIn().catch(function(e){ try{ _gb.textContent='Entrar com Google'; }catch(_){} alert('Não consegui abrir o login Google: '+(e&&e.message||e)+'\nTente de novo — e libere popups para este site.'); });
      };
    }
    var origRW=G.renderWelcome;
    if(typeof origRW==='function'){ G.renderWelcome=function(){ origRW.apply(this,arguments); setTimeout(enhanceWelcome,0); }; }
    setTimeout(enhanceWelcome, 300);

    /* ============================================================
       "SAIBA MAIS" — em todo card do roteiro
       Sempre: busca Google/Wikipédia/Lens. Com chave Gemini
       (grátis, configurada pelo gerente): pergunta + foto → resposta.
       ============================================================ */
    var AI_KEY='pt2026:ai:key';
    function aiKey(){ try{ return localStorage.getItem(AI_KEY)||''; }catch(e){ return ''; } }
    function curCity(){
      try{ var d=(G.DAYS||[]).filter(function(x){ return x.n===(state.viewDay|| (G.currentDayNum&&G.currentDayNum())||1); })[0]; return d?d.city:''; }catch(e){ return ''; }
    }
    var AI_MODELS=['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-1.5-flash','gemini-1.5-flash-8b','gemini-2.5-flash'];
    function askAI(prompt, imgDataUrl){
      var k=aiKey(); if(!k) return Promise.reject(new Error('sem-chave'));
      var parts=[{ text: prompt }];
      if(imgDataUrl){
        var m=/^data:(.*?);base64,(.*)$/.exec(imgDataUrl);
        if(m) parts.push({ inline_data:{ mime_type:m[1], data:m[2] } });
      }
      var body=JSON.stringify({ contents:[{ parts:parts }] });
      var lastErr='erro IA';
      function tryModel(i){
        if(i>=AI_MODELS.length) return Promise.reject(new Error(lastErr));
        return fetch('https://generativelanguage.googleapis.com/v1beta/models/'+AI_MODELS[i]+':generateContent?key='+encodeURIComponent(k),{
          method:'POST', headers:{'Content-Type':'application/json'}, body: body
        }).then(function(r){ return r.json(); }).then(function(j){
          if(j.error){
            lastErr=j.error.message||'erro IA';
            // cota/modelo indisponível → tenta o próximo modelo
            if(/quota|not found|unsupported|permission|RESOURCE_EXHAUSTED|404|429/i.test(lastErr+' '+(j.error.status||'')+' '+(j.error.code||''))) return tryModel(i+1);
            throw new Error(lastErr);
          }
          var c=j.candidates&&j.candidates[0]; var t=c&&c.content&&c.content.parts&&c.content.parts.map(function(p){return p.text||'';}).join(' ');
          return (t||'').trim() || 'Sem resposta.';
        }).catch(function(e){ if(i+1<AI_MODELS.length){ lastErr=e.message||lastErr; return tryModel(i+1); } throw e; });
      }
      return tryModel(0);
    }
    function profileTaste(){
      try{
        // 1º: quiz respondido no login (mais atual e específico)
        var qz=null; try{ qz=JSON.parse(localStorage.getItem('pt2026:quiz:'+slotKey())); }catch(e){}
        if(!qz){ var slot=localStorage.getItem(ME_KEY); if(slot && state.x2 && state.x2.quiz && state.x2.quiz[slot]) qz={profile:state.x2.quiz[slot].profile}; }
        if(qz && qz.profile){ var nm=pname(localStorage.getItem(ME_KEY)||'')||''; return (nm?nm+' — ':'')+qz.profile; }
        // fallback: perfil estático do quiz antigo
        var id=activeId(); var p=(G.PROFILES||[]).filter(function(x){return x.id===id;})[0];
        if(!p) return '';
        return (p.name||'')+': '+((p.traits&&p.traits.join(', '))||p.summary||'').slice(0,220);
      }catch(e){ return ''; }
    }
    function saibaPanel(title, ctx, kind, extra){
      if(document.getElementById('cl-saiba')) return;
      var isMeal = kind==='meal';
      var q=encodeURIComponent(title+' '+(ctx||'')+(isMeal?' restaurante':'')+' Portugal');
      var hasAI=!!aiKey();
      var o=document.createElement('div'); o.id='cl-saiba'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.96)';
      o.innerHTML='<div style="background:var(--surface);max-width:440px;width:100%;border-radius:20px;padding:22px;max-height:86vh;overflow:auto">'+
        '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><h2 class="serif" style="font-size:19px">'+esc(title)+'</h2><button id="sb-x" class="x2-del" style="font-size:13px">fechar</button></div>'+
        (hasAI
          ? '<div class="tl-actions" style="margin-bottom:12px">'+
              '<a class="tl-action" target="_blank" href="https://www.google.com/search?q='+q+'">'+ic('web')+'<span>Google</span></a>'+
            '</div>'+
            '<div class="eyebrow">'+(isMeal?'É bom? O que pedir? Diga sua vontade ou mande foto':'Pergunte, fale ou mande uma foto')+'</div>'+
            '<textarea id="sb-q" class="x2-in" rows="2" style="margin-top:8px" placeholder="'+(isMeal?'Ex.: esse lugar é bom? estou com vontade de polvo. o que pedir aqui?':'Ex.: qual a história desta igreja? o que significa este azulejo?')+'"></textarea>'+
            '<div class="tl-actions" style="margin-top:8px">'+
              '<button class="tl-action primary" id="sb-ask">'+ic('bubble')+'<span>Perguntar</span></button>'+
              '<button class="tl-action" id="sb-mic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg><span>Falar</span></button>'+
              '<label class="tl-action"><input type="file" accept="image/*" id="sb-img" style="display:none">'+ic('view')+'<span>Foto do local</span></label>'+
            '</div>'+
            '<div id="sb-out" class="text-soft text-small" style="margin-top:12px;line-height:1.55;white-space:pre-wrap"></div>'
          : '<div class="tl-actions">'+
              '<a class="tl-action primary" target="_blank" href="https://www.google.com/search?q='+q+'">'+ic('web')+'<span>Google</span></a>'+
            '</div>'+
            '<div class="text-muted text-small" style="margin-top:12px">Para perguntar, falar ou pesquisar por foto <strong>dentro do app</strong>, o gerente ativa o assistente (chave Google Gemini, grátis) em <strong>Mais → Nuvem & Login</strong>.</div>'
        )+
      '</div>';
      document.body.appendChild(o);
      o.addEventListener('click', function(e){ if(e.target===o||e.target.id==='sb-x') o.remove(); });
      if(hasAI){
        var out=$('#sb-out'), pend=null, pendKind=null;
        function run(){
          out.textContent='Consultando…';
          var qv=($('#sb-q').value||'').trim();
          var prompt;
          if(isMeal){
            prompt='Você é um amigo gastronômico em Portugal, honesto e prático. Refeição/contexto: "'+title+(extra?(' — opções sugeridas: '+extra):'')+(ctx?(' ('+ctx+')'):'')+'". Perfil de quem pergunta — '+(profileTaste()||'gosto local autêntico')+'. '+
              (pendKind==='audio'?'A pergunta/vontade do viajante está no áudio — entenda e responda. ':(qv?('O viajante diz: "'+qv+'". '):'Recomende entre as opções e o que pedir, ligando ao perfil. '))+
              (pendKind==='image'?'Há uma foto de um estabelecimento ou prato — diga francamente se parece valer a pena, o que pedir e o que evitar. ':'')+
              'Seja direto: vale ou não, o que pedir, faixa de preço se souber. PT-BR, até 140 palavras, sem enrolação.';
          } else {
            prompt='Você é um guia culto e direto. Local/contexto: "'+title+(ctx?(' — '+ctx):'')+'", em Portugal. '+
              (pendKind==='audio'?'A pergunta do viajante está no áudio anexado — entenda e responda. ':(qv?('Pergunta do viajante: "'+qv+'". '):'Explique o que é e seu significado histórico/cultural. '))+
              (pendKind==='image'?'Há uma foto tirada no local — descreva o que aparece e explique sua relevância histórica/artística. ':'')+
              'Responda em PT-BR, no máximo 140 palavras, tom de quem está ao lado explicando.';
          }
          askAI(prompt, pend).then(function(t){ out.textContent=t; pend=null; pendKind=null; }).catch(function(e){
            var msg=e.message||'erro';
            if(e.message==='sem-chave') out.textContent='Assistente não configurado.';
            else if(/quota|limit: 0|RESOURCE_EXHAUSTED|free_tier/i.test(msg)) out.textContent='A chave Gemini está sem cota grátis. O gerente precisa gerar uma nova chave em aistudio.google.com/apikey escolhendo "Create API key in NEW project" e aguardar ~2 min.';
            else out.textContent='Não consegui responder agora ('+msg+'). Tente digitar a pergunta, ou os botões de busca.';
            pend=null; pendKind=null;
          });
        }
        $('#sb-ask') && ($('#sb-ask').onclick=function(){ pend=null; pendKind=null; run(); });
        $('#sb-img') && ($('#sb-img').onchange=function(e){
          var f=e.target.files&&e.target.files[0]; if(!f) return;
          out.textContent='Lendo a foto…';
          fileToDataUrl(f).then(function(d){ pend=d; pendKind='image'; run(); });
        });
        // ---- Falar (áudio) ----
        var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
        var rec=null, mr=null, chunks=[], recording=false;
        var micBtn=$('#sb-mic'), micSpan=micBtn&&micBtn.querySelector('span');
        function setMic(t){ if(micSpan) micSpan.textContent=t; }
        if(micBtn) micBtn.onclick=function(){
          if(SR){
            try{
              if(recording && rec){ rec.stop(); return; }
              rec=new SR(); rec.lang='pt-BR'; rec.interimResults=false; rec.maxAlternatives=1;
              recording=true; setMic('Ouvindo…'); out.textContent='Fale a pergunta…';
              rec.onresult=function(ev){ var tx=ev.results[0][0].transcript||''; $('#sb-q').value=tx; recording=false; setMic('Falar'); pend=null; pendKind=null; run(); };
              rec.onerror=function(){ recording=false; setMic('Falar'); out.textContent='Não captei o áudio. Tente de novo ou digite.'; };
              rec.onend=function(){ recording=false; setMic('Falar'); };
              rec.start();
            }catch(e){ out.textContent='Microfone indisponível neste navegador — digite a pergunta.'; }
            return;
          }
          // iOS/Safari sem SpeechRecognition → grava e manda o áudio pra IA
          if(!navigator.mediaDevices || !window.MediaRecorder){ $('#sb-q').focus(); out.textContent='Seu navegador não grava áudio. Toque no campo e use o microfone 🎤 do teclado do iPhone para ditar.'; return; }
          if(recording && mr){ mr.stop(); return; }
          navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
            chunks=[]; var mt=''; ['audio/mp4','audio/aac','audio/webm','audio/ogg'].some(function(x){ if(window.MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x)){ mt=x; return true; } return false; });
            mr=mt?new MediaRecorder(stream,{mimeType:mt}):new MediaRecorder(stream);
            mr.ondataavailable=function(ev){ if(ev.data&&ev.data.size) chunks.push(ev.data); };
            mr.onstop=function(){
              stream.getTracks().forEach(function(t){ t.stop(); });
              recording=false; setMic('Falar');
              var blob=new Blob(chunks,{type:(mr.mimeType||'audio/mp4')});
              var fr=new FileReader(); fr.onload=function(){ pend=fr.result; pendKind='audio'; run(); }; fr.readAsDataURL(blob);
            };
            recording=true; setMic('Gravando… toque p/ parar'); out.textContent='Gravando a pergunta… toque em "Gravando" para enviar.';
            mr.start();
          }).catch(function(){ $('#sb-q').focus(); out.textContent='Sem acesso ao microfone. Toque no campo e use o 🎤 do teclado do iPhone para ditar.'; });
        };
      }
    }
    var IS_APPLE=/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    function decodeDest(href){
      try{
        var m=/[?&](q|daddr|destination|query)=([^&]+)/.exec(href);
        if(m) return decodeURIComponent(m[2].replace(/\+/g,' '));
      }catch(e){}
      return '';
    }
    function detectMode(txt){
      var t=(txt||'').toLowerCase();
      if(/uber|t[áa]xi|taxi/.test(t)) return 'uber';
      if(/comboio|metr[oô]|autocarro|el[ée]trico|el[ée]ctrico|funicular|transporte p[úu]blico|tram|bonde|camioneta/.test(t)) return 'transit';
      if(/a p[ée]|caminhad|caminhar|min a p[ée]|p[ée] do hotel|a pe\b/.test(t)) return 'walking';
      return 'driving';
    }
    function detectMeal(txt){
      return /jantar|almo[çc]|almo[çc]ar|caf[ée] da manh|pequeno-almo|brunch|restaurant|tasca|cervejaria|petisco|comer|refei[çc]|gastron|francesinha|marisqueira|bistr[oô]|taberna|prov(ar|a de)/i.test(txt||'');
    }
    function routeURL(dest, mode){
      var d=encodeURIComponent(dest);
      var gmode = mode==='walking'?'walking':mode==='transit'?'transit':'driving';
      if(IS_APPLE){
        var fl = mode==='walking'?'w':mode==='transit'?'r':'d';
        return 'maps://?daddr='+d+'&dirflg='+fl;
      }
      return 'https://www.google.com/maps/dir/?api=1&destination='+d+'&travelmode='+gmode;
    }
    function uberURL(dest){ return 'https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff%5Bformatted_address%5D='+encodeURIComponent(dest); }
    var MODE_LBL={ walking:'Como chegar · a pé', transit:'Como chegar · transporte', driving:'Como chegar · de carro', uber:'Como chegar · de carro' };

    function walkStoryPanel(dest, city){
      if(document.getElementById('cl-walk')) return;
      var o=document.createElement('div'); o.id='cl-walk'; o.className='x2-lb'; o.style.background='rgba(20,16,10,.96)';
      o.innerHTML='<div style="background:var(--surface);max-width:440px;width:100%;border-radius:20px;padding:22px;max-height:86vh;overflow:auto">'+
        '<div style="display:flex;justify-content:space-between;gap:10px"><h2 class="serif" style="font-size:18px">No caminho até '+esc(dest)+'</h2><button id="cw-x" class="x2-del" style="font-size:13px">fechar</button></div>'+
        '<div id="cw-out" class="text-soft text-small" style="margin-top:12px;line-height:1.6;white-space:pre-wrap">Procurando o que há de interessante no trajeto…</div></div>';
      document.body.appendChild(o);
      o.addEventListener('click', function(e){ if(e.target===o||e.target.id==='cw-x') o.remove(); });
      askAI('Você é um guia local. O viajante vai a pé até "'+dest+'" em '+(city||'Portugal')+', Portugal. Liste de 4 a 6 coisas interessantes que ele provavelmente cruza ou avista no caminho (fachadas de azulejo, igrejas, praças, cafés históricos, miradouros, detalhes urbanos), cada uma com 1 frase de curiosidade que treine o olhar. Comece direto pela lista, PT-BR, tom de quem caminha ao lado. Sem introdução.','').then(function(t){ var e=$('#cw-out'); if(e) e.textContent=t; }).catch(function(){ var e=$('#cw-out'); if(e) e.textContent='Não consegui buscar agora. Mas caminhe de olhos abertos: azulejos nas fachadas, igrejas barrocas, miradouros sobre o casario — e use "Foto do local" para descobrir o que vir.'; });
    }

    function injectSaiba(){
      var host=$('#roteiro-content'); if(!host) return;
      $$('.tl-item', host).forEach(function(it){
        var card=it.querySelector('.tl-card'); if(!card || card.querySelector('[data-saiba]')) return;
        var tEl=card.querySelector('.tl-title'); if(!tEl) return;
        var title=(tEl.textContent||'').trim(); if(!title) return;
        var ctxTxt=(card.textContent||'');
        var mode=detectMode(ctxTxt);
        var isMeal=detectMeal((tEl.textContent||'')+' '+((card.querySelector('.tl-sub')||{}).textContent||''));
        var subTxt=((card.querySelector('.tl-sub')||{}).textContent||'').trim();

        // 1) "Abrir no Maps" → rota A→B no app de mapas, com o modo certo
        var mapsA=null;
        $$('a[href]', card).forEach(function(a){
          var h=a.getAttribute('href')||'';
          if(!mapsA && /^maps:|google\.com\/maps|\/maps\//.test(h) && !/pano|map_action/.test(h)) mapsA=a;
        });
        if(mapsA){
          var dest=decodeDest(mapsA.getAttribute('href'))||title;
          mapsA.setAttribute('href', routeURL(dest, mode));
          var ms=mapsA.querySelector('span'); if(ms) ms.textContent=MODE_LBL[mode]||'Como chegar';
          if(mode==='uber'){
            var ub=document.createElement('a');
            ub.className='tl-action'; ub.target='_blank'; ub.rel='noopener';
            ub.href=uberURL(dest); ub.innerHTML=ic('car')+'<span>Uber</span>';
            mapsA.parentNode.insertBefore(ub, mapsA.nextSibling);
          }
        }

        // 2) Caminhada: nota "olhos treinados" + storytelling do trajeto
        if(mode==='walking' && !card.querySelector('.cl-walknote')){
          var note=document.createElement('div');
          note.className='cl-walknote';
          note.style.cssText='margin:10px 0;padding:10px 12px;border-left:3px solid var(--gold);background:var(--surface-2);border-radius:8px;font-size:12.5px;color:var(--ink-soft);line-height:1.5';
          note.innerHTML='👀 <strong>No caminho, olhos atentos:</strong> azulejos, igrejas e cantos com história aparecem antes do destino.'+(aiKey()?' <button class="cl-walkbtn" style="background:none;border:0;color:var(--olive);font-weight:700;text-decoration:underline;cursor:pointer;padding:0;font:inherit">O que ver no caminho ›</button>':' Use "Saiba mais" e "Foto do local" para descobrir.');
          var actsEl=card.querySelector('.tl-actions');
          if(actsEl) card.insertBefore(note, actsEl); else card.appendChild(note);
          var wb=note.querySelector('.cl-walkbtn');
          if(wb) wb.onclick=function(ev){ ev.stopPropagation(); walkStoryPanel(title, curCity()); };
        }

        // 2b) Refeição: nota "é bom? o que pedir?" e atalho do assistente gastronômico
        if(isMeal && !card.querySelector('.cl-mealnote')){
          var mn=document.createElement('div');
          mn.className='cl-mealnote';
          mn.style.cssText='margin:10px 0;padding:10px 12px;border-left:3px solid var(--terra);background:var(--surface-2);border-radius:8px;font-size:12.5px;color:var(--ink-soft);line-height:1.5';
          mn.innerHTML='🍽 <strong>Esse lugar é bom? O que pedir?</strong> Toque em <em>Comer aqui?</em> para perguntar, <strong>falar o que está com vontade</strong> de comer, ou bater <strong>foto do estabelecimento</strong> — a resposta considera seu perfil do quiz.';
          var aEl=card.querySelector('.tl-actions');
          if(aEl) card.insertBefore(mn, aEl); else card.appendChild(mn);
        }

        // 3) Saiba mais (ou "Comer aqui?" em refeições)
        var acts=card.querySelector('.tl-actions');
        var btn=document.createElement('button');
        btn.className='tl-action'+(isMeal?' primary':''); btn.setAttribute('data-saiba', title);
        btn.innerHTML=(isMeal?ic('fork'):ic('bubble'))+'<span>'+(isMeal?'Comer aqui?':'Saiba mais')+'</span>';
        btn.onclick=(function(im,sx){ return function(ev){ ev.stopPropagation(); saibaPanel(title, curCity(), im?'meal':null, im?sx:null); }; })(isMeal, subTxt);
        if(acts){ acts.appendChild(btn); }
        else { var w=document.createElement('div'); w.className='tl-actions'; w.appendChild(btn); card.appendChild(w); }
      });
    }
    var origRR=G.renderRoteiro;
    if(typeof origRR==='function'){
      G.renderRoteiro=function(){ origRR.apply(this,arguments); setTimeout(injectSaiba,0); };
    }

    /* ---------- Perfil: refazer avaliação + perfis do grupo ---------- */
    function injectPerfil(){
      var host=$('#perfil-content'); if(!host || host.querySelector('#cl-perfilx')) return;
      var box=document.createElement('div'); box.id='cl-perfilx'; box.className='pad'; box.style.marginTop='8px';
      var qz=state.x2&&state.x2.quiz?state.x2.quiz:{};
      var meSlot=localStorage.getItem(ME_KEY)||'';
      var cards=Object.keys(qz).map(function(sl){
        var d=qz[sl]; if(!d) return '';
        return '<div class="tl-card" style="margin-top:10px;border-left:3px solid '+(({caio:'#D4A85F',amanda:'#C25E3D',bruna:'#5E7355',lucas:'#3E6E78'})[sl]||'#999')+'">'+
          '<div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-family:\'Fraunces\',serif">'+esc(d.name||sl)+(sl===meSlot?' · você':'')+'</strong></div>'+
          '<div class="text-soft text-small" style="margin-top:6px;line-height:1.65;white-space:pre-wrap">'+esc(d.grad||d.profile||'')+'</div></div>';
      }).join('');
      var tp=(state.x2&&state.x2.trip)||null;
      var tripLine=tp&&(tp.start||tp.dests)?('<div class="tl-card" style="margin-top:10px"><div class="eyebrow">Viagem</div><div class="text-soft text-small" style="margin-top:4px">'+esc((tp.start||'?')+(tp.end?(' → '+tp.end):''))+(tp.dests?(' · '+tp.dests):'')+'</div></div>'):'';
      box.innerHTML='<div class="section" style="margin-top:18px"><div class="section-head"><h2 class="serif" style="font-size:16px">Perfis dos viajantes</h2></div>'+tripLine+
        '<p class="text-soft text-small" style="margin:6px 0 10px">Cada um é de um jeito — e em graus diferentes. Conhecer o ritmo do outro evita atrito na viagem.</p>'+
        (cards||'<div class="tl-card"><p class="text-soft text-small">Quando cada viajante responder a avaliação, o perfil aparece aqui para todos.</p></div>')+
        '<button id="cl-redo" class="x2-btn-primary" style="margin-top:14px">Refazer minha avaliação de perfil</button>'+
        '<p class="text-muted text-small" style="margin-top:8px">Você pode refazer quando quiser — humor e energia mudam no meio da viagem.</p></div>';
      host.appendChild(box);
      var rb=$('#cl-redo'); if(rb) rb.onclick=function(){ openQuizRedo(); };
    }
    var origRP=G.renderPerfil;
    if(typeof origRP==='function'){
      G.renderPerfil=function(){ origRP.apply(this,arguments); setTimeout(injectPerfil,0); };
    }

    /* ---------- acessibilidade (alvos de toque + tamanho mínimo de texto) ---------- */
    try{
      var a11y=document.createElement('style'); a11y.id='cl-a11y';
      a11y.textContent=
        '.nav-tab{min-height:52px;font-size:11.5px;display:flex;flex-direction:column;align-items:center;justify-content:center}'+
        '.icon-btn{min-width:44px;min-height:44px}'+
        '.tl-action{min-height:44px}'+
        '.brand-text span{font-size:11px}'+
        '.text-small,.text-muted{font-size:12.5px}'+
        '.eyebrow{font-size:11.5px}'+
        'button,a,[role="button"],.tl-action,.x2-btn-primary,.nav-tab{cursor:pointer}'+
        ':focus-visible{outline:2px solid var(--olive);outline-offset:2px}';
      document.head.appendChild(a11y);
    }catch(e){}
    /* ---------- arranque ---------- */
    acceptInvite(); // link de convite traz a config; salva e segue para o login
    if(fbCfg()){ checkRedirect(); }
    try{
      var cur=document.querySelector('.view.active');
      if(cur&&cur.dataset.view==='mais') G.renderMais();
    }catch(e){}
    console.log('[PT-2026] cloud.js v3.1 — '+(fbCfg()?'Firebase configurado':'modo nativo')+' · integrações ativas');
  }
})();
