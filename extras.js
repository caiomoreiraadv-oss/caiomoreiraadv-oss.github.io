/* ============================================================
   PT-2026 · extras.js · Fases 2–6
   Caixinha · Passaporte/Selos · Hospedagem/Voos/Ingressos ·
   Clima inteligente · Álbum · Modo Conversa · Carta de Viagem
   ------------------------------------------------------------
   Arquivo auxiliar (autorizado na seção 8 do prompt-mestre).
   Não reescreve o monólito: estende renderMais/renderHoje e
   reaproveita state, saveState, PROFILES, DAYS, HOTELS, MISSIONS,
   ICONS, mapsUrl, wazeUrl, compressImage, goTo, $, $$.
   Estado local-first (offline obrigatório) + sincronização
   manual por código colável no grupo (sem backend, sem chave).
   ============================================================ */
(function(){
  'use strict';
  if(window.__PT2026_EXTRAS__) return;
  window.__PT2026_EXTRAS__ = true;

  /* ---------- guarda de dependências ---------- */
  var G = window;
  function ready(){ return typeof G.state === 'object' && typeof G.saveState === 'function' && typeof G.renderMais === 'function'; }
  if(!ready()){
    var tries = 0;
    var t = setInterval(function(){ tries++; if(ready()){ clearInterval(t); boot(); } else if(tries > 60){ clearInterval(t); } }, 100);
  } else { boot(); }

  function boot(){
    var state = G.state;
    var saveState = G.saveState;
    var PROFILES = G.PROFILES || [];
    var DAYS = G.DAYS || [];
    var HOTELS = G.HOTELS || [];
    var MISSIONS = G.MISSIONS || {};
    var ICONS = G.ICONS || {};
    var $ = G.$ || function(s,c){ return (c||document).querySelector(s); };
    var $$ = G.$$ || function(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); };
    var mapsUrl = G.mapsUrl || function(q){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q); };
    var wazeUrl = G.wazeUrl || function(q){ return 'https://www.waze.com/ul?q='+encodeURIComponent(q)+'&navigate=yes'; };
    var telUrl  = G.telUrl  || function(t){ return 'tel:'+String(t).replace(/[^\d+]/g,''); };
    var compressImage = G.compressImage;

    /* ---------- perfis / cores-assinatura ---------- */
    var PCOLOR = { caio:'#D4A85F', amanda:'#C25E3D', bruna:'#5E7355', lucas:'#3E6E78' };
    var PARTNER = { caio:'amanda', amanda:'caio', lucas:'bruna', bruna:'lucas' };
    var PIDS = ['amanda','bruna','caio','lucas'];
    function pname(id){ var p = PROFILES.find(function(x){ return x.id===id; }); return p ? p.name : (id||'').charAt(0).toUpperCase()+(id||'').slice(1); }
    function activeId(){
      var a = (typeof G.getActiveProfile==='function' && G.getActiveProfile()) || null;
      if(a && a.id && a.id!=='guest') return a.id;
      return state.activeProfile && state.activeProfile!=='guest' ? state.activeProfile : 'caio';
    }
    function pchip(id){
      return '<span class="x2-chip" style="--pc:'+(PCOLOR[id]||'#999')+'">'+pname(id)+'</span>';
    }

    /* ---------- storage auxiliar (dataURLs pesados fora do state) ---------- */
    var ATTACH_KEY = 'pt2026:x2:attach';
    var ALBUM_KEY  = 'pt2026:x2:album';
    function jget(k,f){ try{ return JSON.parse(localStorage.getItem(k)) || f; }catch(e){ return f; } }
    function jset(k,v){
      try{ localStorage.setItem(k, JSON.stringify(v)); return true; }
      catch(e){ alert('Memória do navegador cheia. Apague algum anexo/foto antiga para guardar este.'); return false; }
    }
    state.x2 = state.x2 || {};
    var X = state.x2;
    X.expenses = X.expenses || [];
    X.flights  = X.flights  || null;
    X.tickets  = X.tickets  || [];
    X.albumLink = X.albumLink || '';
    X.fx = X.fx || null; // {rate, ts}
    function px(){ saveState(); }

    /* ---------- câmbio EUR→BRL ---------- */
    function fxRate(){
      if(X.fx && X.fx.rate) return X.fx.rate;
      if(state.fxRate) return state.fxRate;
      return 6.30;
    }
    function eur(n){ return '€ ' + (Number(n)||0).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2}); }
    function brl(n){ return 'R$ ' + ((Number(n)||0)*fxRate()).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
    function refreshFx(cb){
      fetch('https://api.exchangerate.host/latest?base=EUR&symbols=BRL')
        .then(function(r){ return r.json(); })
        .then(function(d){ if(d && d.rates && d.rates.BRL){ X.fx={rate:d.rates.BRL, ts:Date.now()}; state.fxRate=d.rates.BRL; px(); cb && cb(true); } else cb && cb(false); })
        .catch(function(){ cb && cb(false); });
    }

    /* ---------- categorias automáticas ---------- */
    function inferCat(desc){
      var d = (desc||'').toLowerCase();
      if(/restaur|jantar|almo|caf[eé]|tasca|comida|lanch|bar\b|vinho|cervej|petisc|brunch|gelad/.test(d)) return 'Restaurante';
      if(/uber|t[aá]xi|comboio|metro|gasolin|portag|estacion|sixt|carro|combust|bilhete de comboio|aluguer/.test(d)) return 'Transporte';
      if(/ingress|bilhete|museu|torre|most|ticket|entrada|tour|prova de vinh|degust/.test(d)) return 'Ingresso';
      if(/hotel|quinta|airbnb|estadia|hosped|dorm/.test(d)) return 'Hospedagem';
      if(/mercado|supermerc|pingo|continente|farm[aá]ci|merci|minipre/.test(d)) return 'Mercado';
      return 'Outros';
    }
    var CATICON = { 'Restaurante':'fork','Transporte':'car','Ingresso':'star','Hospedagem':'hotel','Mercado':'shop','Outros':'doc' };

    /* ---------- divisão de despesas ---------- */
    function participantsOf(e){
      if(e.split === 'couple'){ var pr = PARTNER[e.payer]; return pr ? [e.payer, pr] : [e.payer]; }
      if(e.split === 'custom' && e.with && e.with.length) return e.with.slice();
      return PIDS.slice();
    }
    function balances(){
      var net = {}; PIDS.forEach(function(p){ net[p]=0; });
      X.expenses.forEach(function(e){
        var parts = participantsOf(e);
        var share = (Number(e.amount)||0) / parts.length;
        net[e.payer] = (net[e.payer]||0) + (Number(e.amount)||0);
        parts.forEach(function(p){ net[p] = (net[p]||0) - share; });
      });
      return net;
    }
    function settlement(){
      var net = balances();
      var deb = [], cred = [];
      PIDS.forEach(function(p){
        var v = Math.round((net[p]||0)*100)/100;
        if(v < -0.005) deb.push({id:p, v:-v});
        else if(v > 0.005) cred.push({id:p, v:v});
      });
      deb.sort(function(a,b){ return b.v-a.v; });
      cred.sort(function(a,b){ return b.v-a.v; });
      var tx = [], i=0, j=0;
      while(i<deb.length && j<cred.length){
        var m = Math.min(deb[i].v, cred[j].v);
        tx.push({ from:deb[i].id, to:cred[j].id, amount:Math.round(m*100)/100 });
        deb[i].v-=m; cred[j].v-=m;
        if(deb[i].v<0.005) i++;
        if(cred[j].v<0.005) j++;
      }
      return { net:net, tx:tx };
    }

    /* ---------- helpers UI ---------- */
    function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
    function ic(n){ return ICONS[n] || ICONS.doc || ''; }
    function back(label){
      return '<div class="pad" style="margin-top:16px"><button class="btn ghost sm" data-sub="home" style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;transform:rotate(180deg)">›</span> '+(label||'voltar')+'</button></div>';
    }
    function mount(html){ var c = $('#mais-content'); if(c) c.innerHTML = html; try{ window.scrollTo(0,0); }catch(e){} }
    function toast(msg){
      var d = document.createElement('div');
      d.className = 'x2-toast'; d.textContent = msg;
      document.body.appendChild(d);
      setTimeout(function(){ d.classList.add('in'); }, 10);
      setTimeout(function(){ d.classList.remove('in'); setTimeout(function(){ d.remove(); }, 300); }, 2400);
    }
    function copy(text){
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){ toast('Copiado'); }, function(){ fallbackCopy(text); }); }
      else fallbackCopy(text);
    }
    function fallbackCopy(text){
      var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); toast('Copiado'); }catch(e){ prompt('Copie manualmente:', text); }
      ta.remove();
    }
    function fileToDataUrl(file){
      return new Promise(function(res,rej){
        if(compressImage && /^image\//.test(file.type)){ compressImage(file, 1400, 0.78).then(res, function(){ raw(); }); }
        else raw();
        function raw(){ var r=new FileReader(); r.onload=function(){ res(r.result); }; r.onerror=rej; r.readAsDataURL(file); }
      });
    }

    /* ============================================================
       MONKEY-PATCH renderMais — adiciona tiles + sub-telas
       ============================================================ */
    var origMais = G.renderMais;
    var MY_SUBS = ['caixinha','passaporte','carta','dormir','voos2','vitrine','album','conversa'];
    G.renderMais = function(){
      var sub = state.maisSub || 'home';
      if(MY_SUBS.indexOf(sub) > -1){ return renderX2(sub); }
      origMais.apply(this, arguments);
      if((state.maisSub||'home') === 'home'){ injectTiles(); }
    };
    function injectTiles(){
      var grid = $('#mais-content .util-grid');
      if(!grid || grid.querySelector('[data-sub="caixinha"]')) return;
      var tiles = [
        ['caixinha','euro','Caixinha','Despesas, saldos e acerto em EUR/BRL.'],
        ['passaporte','star','Passaporte','Selos das missões dos quatro.'],
        ['dormir','hotel','Onde dormimos','Hotéis, anexos, contato, chegada.'],
        ['voos2','plane','Decolagens','Voos, localizador, cartão de embarque.'],
        ['vitrine','bookmark','Vitrine','Ingressos e bilhetes com QR.'],
        ['album','view','Álbum','Fotos compartilhadas da viagem.'],
        ['conversa','bubble','Modo conversa','Diga em PT-PT, com áudio.'],
        ['carta','doc','Carta de Viagem','O resumo afetuoso dos quatro.']
      ];
      var html = tiles.map(function(t){
        return '<button class="util-tile x2-tile" data-sub="'+t[0]+'"><div class="ut-icon">'+ic(t[1])+'</div><h4>'+t[2]+'</h4><p>'+t[3]+'</p></button>';
      }).join('');
      var firstSpacer = $('#mais-content .spacer-lg');
      grid.insertAdjacentHTML('beforeend', html);
    }

    function renderX2(sub){
      if(sub==='caixinha')   return scrCaixinha();
      if(sub==='passaporte') return scrPassaporte();
      if(sub==='carta')      return scrCarta();
      if(sub==='dormir')     return scrDormir();
      if(sub==='voos2')      return scrVoos();
      if(sub==='vitrine')    return scrVitrine();
      if(sub==='album')      return scrAlbum();
      if(sub==='conversa')   return scrConversa();
    }

    /* ============================================================
       FASE 2 · CAIXINHA
       ============================================================ */
    function scrCaixinha(){
      var tab = X._tab || 'lancar';
      var head = back() +
        '<div class="pad mt-16"><div class="eyebrow">Substitui o Splitwise</div><h2 class="serif" style="margin-top:4px">Caixinha</h2></div>' +
        '<div class="pad"><div class="x2-segment">' +
          seg('lancar','Lançar',tab) + seg('saldos','Saldos',tab) + seg('extrato','Extrato',tab) + seg('cambio','Câmbio',tab) +
        '</div></div>';
      var body = tab==='lancar' ? caixaLancar() : tab==='saldos' ? caixaSaldos() : tab==='cambio' ? caixaCambio() : caixaExtrato();
      mount(head + body + '<div class="spacer-lg"></div>');
      wireCaixinha(tab);
    }
    function caixaCambio(){
      var r=fxRate();
      return '<div class="pad mt-12"><div class="tl-card">' +
        '<div class="eyebrow">EUR ↔ BRL</div>' +
        '<label class="x2-l" style="margin-top:10px">Euros (€)</label>' +
        '<input id="fxc-eur" class="x2-in" type="number" inputmode="decimal" value="50" style="font-size:22px;font-family:\'Fraunces\',serif">' +
        '<div style="text-align:center;color:var(--ink-muted);margin:8px 0">▼ ▲</div>' +
        '<label class="x2-l">Reais (R$)</label>' +
        '<input id="fxc-brl" class="x2-in" type="number" inputmode="decimal" value="'+(50*r).toFixed(2)+'" style="font-size:22px;font-family:\'Fraunces\',serif">' +
        '<div class="text-muted text-small" style="margin-top:10px">1 € ≈ R$ '+r.toFixed(2)+' · '+(X.fx?'cotação atualizada':'estimativa')+'</div>' +
        '<button id="fxc-up" class="btn ghost sm" style="margin-top:10px">Atualizar cotação</button>' +
        '</div>' +
        '<div class="tl-card" style="margin-top:12px"><div class="eyebrow">Dica</div><p class="text-soft text-small" style="margin-top:6px">Caixas <strong>Multibanco</strong> (logo verde) cobram menos taxa que Euronet (logo azul). Evite casas de câmbio de rua.</p></div></div>';
    }
    function seg(id,label,cur){ return '<button class="x2-seg'+(cur===id?' on':'')+'" data-x2tab="'+id+'">'+label+'</button>'; }

    function caixaLancar(){
      var me = activeId();
      return '<div class="pad mt-12">' +
        '<div class="tl-card">' +
          '<label class="x2-l">Valor (EUR)</label>' +
          '<input id="x2-amt" class="x2-in" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" style="font-size:24px;font-family:\'Fraunces\',serif">' +
          '<div id="x2-brl" class="text-muted text-small" style="margin-top:4px">≈ R$ 0,00</div>' +
          '<label class="x2-l" style="margin-top:14px">Descrição</label>' +
          '<input id="x2-desc" class="x2-in" type="text" placeholder="Ex.: jantar na tasca, comboio Pinhão...">' +
          '<label class="x2-l" style="margin-top:14px">Pago por</label>' +
          '<div class="x2-payers">' + PIDS.map(function(p){
            return '<button class="x2-payer'+(p===me?' on':'')+'" data-x2payer="'+p+'" style="--pc:'+PCOLOR[p]+'">'+pname(p)+'</button>';
          }).join('') + '</div>' +
          '<label class="x2-l" style="margin-top:14px">Divisão</label>' +
          '<div class="x2-payers">' +
            '<button class="x2-split on" data-x2split="equal">Igual entre 4</button>' +
            '<button class="x2-split" data-x2split="couple">Só o casal</button>' +
            '<button class="x2-split" data-x2split="custom">Personalizada</button>' +
          '</div>' +
          '<div id="x2-custom" style="display:none;margin-top:10px">' +
            '<div class="text-muted text-small" style="margin-bottom:6px">Quem racha:</div>' +
            '<div class="x2-payers">' + PIDS.map(function(p){
              return '<button class="x2-with on" data-x2with="'+p+'" style="--pc:'+PCOLOR[p]+'">'+pname(p)+'</button>';
            }).join('') + '</div>' +
          '</div>' +
          '<button id="x2-add" class="x2-btn-primary" style="margin-top:18px">Registrar despesa</button>' +
        '</div>' +
        '<div class="text-muted text-small" style="text-align:center;margin-top:14px">Categoria detectada automaticamente. Câmbio EUR↔BRL ' + (X.fx?('atualizado · 1 € = R$ '+fxRate().toFixed(2)) : ('estimado · 1 € = R$ '+fxRate().toFixed(2))) + '</div>' +
      '</div>';
    }

    function caixaSaldos(){
      var s = settlement();
      var anyExp = X.expenses.length > 0;
      var rows = PIDS.map(function(p){
        var v = Math.round((s.net[p]||0)*100)/100;
        var pos = v >= 0;
        return '<div class="x2-balrow">' +
          '<span class="x2-chip" style="--pc:'+PCOLOR[p]+'">'+pname(p)+'</span>' +
          '<span class="x2-balv" style="color:'+(pos?'var(--olive)':'var(--terra)')+'">' +
            (pos?'recebe ':'deve ') + eur(Math.abs(v)) + '<small style="display:block;font-weight:400;color:var(--ink-muted)">'+brl(Math.abs(v))+'</small>' +
          '</span></div>';
      }).join('');
      var txHtml = s.tx.length ? s.tx.map(function(t){
        var msg = 'Acerto Portugal 2026: '+pname(t.from)+' paga '+eur(t.amount)+' ('+brl(t.amount)+') para '+pname(t.to)+'.';
        return '<div class="tl-card" style="margin-top:10px">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            pchip(t.from) + '<span style="color:var(--ink-muted)">paga</span>' +
            '<strong style="font-family:\'Fraunces\',serif">'+eur(t.amount)+'</strong>' +
            '<span style="color:var(--ink-muted)">a</span>' + pchip(t.to) +
          '</div>' +
          '<div class="text-muted text-small" style="margin-top:4px">'+brl(t.amount)+'</div>' +
          '<div class="tl-actions">' +
            '<a class="tl-action primary" target="_blank" href="https://wa.me/?text='+encodeURIComponent(msg)+'">'+ic('whats')+'<span>Cobrar no WhatsApp</span></a>' +
            '<button class="tl-action" data-x2copypay="'+esc(msg)+'">'+ic('doc')+'<span>Copiar PIX/Wise</span></button>' +
          '</div></div>';
      }).join('') : '<div class="tl-card" style="margin-top:10px"><p class="text-soft text-small">Tudo quitado — ou ninguém lançou nada ainda.</p></div>';

      return '<div class="pad mt-12">' +
        '<div class="tl-card"><div class="eyebrow">Posição de cada um</div>' + rows +
          '<button id="x2-fx" class="btn ghost sm" style="margin-top:12px">Atualizar câmbio</button></div>' +
        (anyExp ? '<div class="eyebrow" style="margin:20px 0 0">Como zerar com menos transferências</div>' + txHtml : '') +
        '<div class="tl-card" style="margin-top:18px"><div class="eyebrow">Sincronizar com os quatro</div>' +
          '<p class="text-soft text-small" style="margin-top:6px">Sem servidor: gere o código abaixo e cole no grupo. Quem colar o código de volta funde os lançamentos (mais recente vence).</p>' +
          '<div class="tl-actions">' +
            '<button class="tl-action primary" id="x2-exp">'+ic('arrowR')+'<span>Gerar código</span></button>' +
            '<button class="tl-action" id="x2-imp">'+ic('doc')+'<span>Colar código</span></button>' +
          '</div></div>' +
      '</div>';
    }

    function caixaExtrato(){
      if(!X.expenses.length) return '<div class="pad mt-12"><div class="tl-card"><p class="text-soft text-small">Nenhuma despesa ainda. Toque em "Lançar".</p></div></div>';
      var fp = X._fp || 'all';
      var list = X.expenses.slice().sort(function(a,b){ return b.ts-a.ts; });
      if(fp!=='all') list = list.filter(function(e){ return e.payer===fp || participantsOf(e).indexOf(fp)>-1; });
      var total = X.expenses.reduce(function(s,e){ return s+(Number(e.amount)||0); }, 0);
      var filters = '<div class="x2-payers" style="margin-bottom:12px"><button class="x2-with'+(fp==='all'?' on':'')+'" data-x2fp="all">Todos</button>' +
        PIDS.map(function(p){ return '<button class="x2-with'+(fp===p?' on':'')+'" data-x2fp="'+p+'" style="--pc:'+PCOLOR[p]+'">'+pname(p)+'</button>'; }).join('') + '</div>';
      var items = list.map(function(e){
        var d = new Date(e.ts);
        var parts = participantsOf(e);
        return '<div class="tl-card x2-exp" style="margin-top:8px">' +
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">' +
            '<div><div style="font-weight:600">'+esc(e.desc||e.category)+'</div>' +
            '<div class="text-muted text-small" style="margin-top:3px">'+ d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) +' · '+ e.category +' · pagou '+pname(e.payer)+'</div>' +
            '<div class="text-muted text-small" style="margin-top:2px">racha: '+parts.map(pname).join(', ')+'</div></div>' +
            '<div style="text-align:right;white-space:nowrap"><div style="font-family:\'Fraunces\',serif;font-size:17px">'+eur(e.amount)+'</div>' +
            '<div class="text-muted text-small">'+brl(e.amount)+'</div>' +
            '<button class="x2-del" data-x2del="'+e.id+'" aria-label="Excluir">remover</button></div>' +
          '</div></div>';
      }).join('');
      return '<div class="pad mt-12">' +
        '<div class="tl-card"><div class="eyebrow">Total do grupo</div><div style="font-family:\'Fraunces\',serif;font-size:28px;margin-top:4px">'+eur(total)+'</div><div class="text-muted text-small">'+brl(total)+' · '+X.expenses.length+' lançamentos</div></div>' +
        '<div style="margin-top:14px">'+filters+items+'</div></div>';
    }

    function wireCaixinha(tab){
      $$('[data-x2tab]').forEach(function(b){ b.onclick=function(){ X._tab=b.dataset.x2tab; px(); scrCaixinha(); }; });
      if(tab==='lancar'){
        var amt=$('#x2-amt'), brlEl=$('#x2-brl'), splitMode='equal', payer=activeId(), withSet={};
        PIDS.forEach(function(p){ withSet[p]=true; });
        if(amt) amt.oninput=function(){ brlEl.textContent='≈ '+brl(parseFloat(amt.value)||0); };
        $$('[data-x2payer]').forEach(function(b){ b.onclick=function(){ payer=b.dataset.x2payer; $$('[data-x2payer]').forEach(function(x){ x.classList.toggle('on', x===b); }); }; });
        $$('[data-x2split]').forEach(function(b){ b.onclick=function(){ splitMode=b.dataset.x2split; $$('[data-x2split]').forEach(function(x){ x.classList.toggle('on', x===b); }); $('#x2-custom').style.display = splitMode==='custom'?'block':'none'; }; });
        $$('[data-x2with]').forEach(function(b){ b.onclick=function(){ var p=b.dataset.x2with; withSet[p]=!withSet[p]; b.classList.toggle('on', withSet[p]); }; });
        $('#x2-add') && ($('#x2-add').onclick=function(){
          var v=parseFloat((amt.value||'').replace(',','.'));
          if(!v || v<=0){ toast('Informe um valor'); amt.focus(); return; }
          var desc=($('#x2-desc').value||'').trim();
          var withArr = PIDS.filter(function(p){ return withSet[p]; });
          if(splitMode==='custom' && withArr.length===0){ toast('Escolha quem racha'); return; }
          var e={ id:'e'+Date.now()+Math.random().toString(36).slice(2,6), ts:Date.now(), amount:Math.round(v*100)/100,
                  desc:desc, category:inferCat(desc), payer:payer, split:splitMode, with: splitMode==='custom'?withArr:null };
          X.expenses.push(e); px();
          toast('Lançado · '+e.category);
          X._tab='extrato'; scrCaixinha();
        });
      }
      if(tab==='cambio'){
        var fe=$('#fxc-eur'), fb=$('#fxc-brl'), rr=fxRate();
        if(fe) fe.oninput=function(){ fb.value=((parseFloat(fe.value)||0)*rr).toFixed(2); };
        if(fb) fb.oninput=function(){ fe.value=((parseFloat(fb.value)||0)/rr).toFixed(2); };
        $('#fxc-up') && ($('#fxc-up').onclick=function(){ this.textContent='Atualizando...'; refreshFx(function(ok){ toast(ok?'Cotação atualizada':'Sem rede — estimativa'); scrCaixinha(); }); });
      }
      if(tab==='saldos'){
        $('#x2-fx') && ($('#x2-fx').onclick=function(){ this.textContent='Atualizando...'; refreshFx(function(ok){ toast(ok?'Câmbio atualizado':'Sem rede — usando estimativa'); scrCaixinha(); }); });
        $$('[data-x2copypay]').forEach(function(b){ b.onclick=function(){ copy(b.dataset.x2copypay); }; });
        $('#x2-exp') && ($('#x2-exp').onclick=function(){
          var code='PT2026X1'+btoa(unescape(encodeURIComponent(JSON.stringify(X.expenses))));
          copy(code);
          var msg='Caixinha Portugal 2026 — cole este código no app (Caixinha → Saldos → Colar código):\n\n'+code;
          window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
        });
        $('#x2-imp') && ($('#x2-imp').onclick=function(){
          var raw=prompt('Cole o código da caixinha:'); if(!raw) return;
          try{
            var b=raw.trim().replace(/^PT2026X1/,'');
            var arr=JSON.parse(decodeURIComponent(escape(atob(b))));
            if(!Array.isArray(arr)) throw 0;
            var byId={}; X.expenses.forEach(function(e){ byId[e.id]=e; });
            arr.forEach(function(e){ if(!byId[e.id] || (e.ts||0) >= (byId[e.id].ts||0)) byId[e.id]=e; });
            X.expenses=Object.keys(byId).map(function(k){ return byId[k]; });
            px(); toast('Fundido · '+X.expenses.length+' lançamentos'); scrCaixinha();
          }catch(err){ alert('Código inválido.'); }
        });
      }
      if(tab==='extrato'){
        $$('[data-x2fp]').forEach(function(b){ b.onclick=function(){ X._fp=b.dataset.x2fp; px(); scrCaixinha(); }; });
        $$('[data-x2del]').forEach(function(b){ b.onclick=function(){
          if(!confirm('Remover este lançamento?')) return;
          X.expenses=X.expenses.filter(function(e){ return e.id!==b.dataset.x2del; }); px(); scrCaixinha();
        }; });
      }
    }

    /* ============================================================
       FASE 3 · PASSAPORTE / SELOS
       ============================================================ */
    function missDone(stop,mid){ return !!(state.missions && state.missions[stop] && state.missions[stop][mid]); }
    function stopMeta(stop){
      // mapeia chave de missão -> cidade/emoji aproximados
      var m = {
        'porto-1':['Porto','🛬','2026-05-22'], 'porto-2':['Porto','💍','2026-05-23'],
        'porto-3':['Porto','🌉','2026-05-24'], 'douro':['Douro','🍷','2026-05-25'],
        'obidos':['Óbidos','🏰','2026-05-26'], 'fatima':['Fátima','⛪','2026-05-26'],
        'lisboa':['Lisboa','🚋','2026-05-27'], 'belem':['Belém','🥧','2026-05-28'],
        'partida':['Lisboa','✈️','2026-05-29']
      };
      return m[stop] || [stop,'•',''];
    }
    function scrPassaporte(){
      var stops = Object.keys(MISSIONS);
      var totalDone=0, totalAll=0;
      var blocks = stops.map(function(stop){
        var meta=stopMeta(stop), col=MISSIONS[stop]||{};
        var sel=[];
        (col.coletivas||[]).forEach(function(m){ totalAll++; if(missDone(stop,m.id)){ totalDone++; sel.push({t:m.text,who:'grupo'}); } });
        Object.keys(col.individuais||{}).forEach(function(pid){
          var m=col.individuais[pid]; totalAll++;
          if(missDone(stop,m.id)){ totalDone++; sel.push({t:m.text,who:pid}); }
        });
        var stamps = sel.length ? sel.map(function(s){
          var c = s.who==='grupo' ? '#8A8170' : (PCOLOR[s.who]||'#999');
          return '<div class="x2-stamp" style="--sc:'+c+'"><div class="x2-stamp-em">'+meta[1]+'</div>' +
            '<div class="x2-stamp-city">'+meta[0]+'</div>' +
            '<div class="x2-stamp-date">'+(meta[2]?meta[2].split('-').reverse().slice(0,2).join('/'):'')+'</div>' +
            '<div class="x2-stamp-who">'+(s.who==='grupo'?'OS QUATRO':pname(s.who).toUpperCase())+'</div>' +
            '<div class="x2-stamp-t">'+esc(s.t)+'</div></div>';
        }).join('') : '<div class="x2-stamp empty">selo em aberto</div>';
        return '<div class="section" style="margin-top:18px"><div class="section-head"><h2 class="serif" style="font-size:16px">'+meta[1]+' '+meta[0]+'</h2><span class="meta">'+sel.length+'/'+((col.coletivas||[]).length+Object.keys(col.individuais||{}).length)+'</span></div>' +
          '<div class="x2-stampgrid">'+stamps+'</div></div>';
      }).join('');
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Diário coletivo · sem competição</div><h2 class="serif" style="margin-top:4px">Passaporte</h2>' +
        '<p class="text-soft text-small" style="margin-top:8px">Cada missão cumprida no Mapa vira carimbo aqui. '+totalDone+' de '+totalAll+' selos conquistados pelos quatro.</p></div>' +
        '<div class="pad">'+blocks+'</div>' +
        '<div class="pad" style="margin-top:8px"><button class="btn ghost sm" data-x2go="mapa">Ir ao Mapa marcar missões</button></div>' +
        '<div class="spacer-lg"></div>');
      $$('[data-x2go]').forEach(function(b){ b.onclick=function(){ G.goTo(b.dataset.x2go); }; });
    }

    /* ============================================================
       FASE 6 · CARTA DE VIAGEM
       ============================================================ */
    function scrCarta(){
      var doneBy={}; PIDS.forEach(function(p){ doneBy[p]=0; });
      var coletDone=0;
      Object.keys(MISSIONS).forEach(function(stop){
        var col=MISSIONS[stop]||{};
        (col.coletivas||[]).forEach(function(m){ if(missDone(stop,m.id)) coletDone++; });
        Object.keys(col.individuais||{}).forEach(function(pid){
          if(missDone(stop,col.individuais[pid].id)) doneBy[pid]=(doneBy[pid]||0)+1;
        });
      });
      var paidBy={}; PIDS.forEach(function(p){ paidBy[p]=0; });
      var totalE=0;
      X.expenses.forEach(function(e){ paidBy[e.payer]=(paidBy[e.payer]||0)+(Number(e.amount)||0); totalE+=(Number(e.amount)||0); });
      var album = jget(ALBUM_KEY,[]);
      var photoBy={}; PIDS.forEach(function(p){ photoBy[p]=0; });
      album.forEach(function(a){ if(a.by) photoBy[a.by]=(photoBy[a.by]||0)+1; });

      var lines = PIDS.map(function(p){
        var bits=[];
        if(doneBy[p]) bits.push('cumpriu '+doneBy[p]+' missão'+(doneBy[p]>1?'s':''));
        if(photoBy[p]) bits.push('registrou '+photoBy[p]+' foto'+(photoBy[p]>1?'s':''));
        if(paidBy[p]>0) bits.push('adiantou '+eur(paidBy[p])+' da caixinha');
        if(!bits.length) bits.push('esteve presente — e isso já basta');
        return '<div class="x2-cartaline"><span class="x2-chip" style="--pc:'+PCOLOR[p]+'">'+pname(p)+'</span><p style="margin-top:6px">'+bits.join(' · ')+'.</p></div>';
      }).join('');

      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">22–29 de maio de 2026 · Portugal</div><h2 class="serif" style="margin-top:4px">Carta de Viagem</h2></div>' +
        '<div class="pad"><div class="tl-card" style="background:linear-gradient(135deg,var(--olive-50),var(--terra-50))">' +
          '<p style="font-family:\'Fraunces\',serif;font-size:18px;line-height:1.5">Quatro pessoas atravessaram Portugal pelo casamento de Lucie & Thiago. Juntos somaram '+coletDone+' marcos coletivos e movimentaram '+eur(totalE)+' em memórias compartilhadas.</p>' +
          '<div style="margin-top:16px">'+lines+'</div>' +
          '<p class="text-soft text-small" style="margin-top:16px">Não é placar. É o que cada um trouxe de mais seu para a estrada.</p>' +
        '</div>' +
        '<button id="x2-carta-share" class="x2-btn-primary" style="margin-top:16px">Compartilhar a carta</button></div>' +
        '<div class="spacer-lg"></div>');
      $('#x2-carta-share') && ($('#x2-carta-share').onclick=function(){
        var txt='Carta de Viagem · Portugal 2026\n\n'+PIDS.map(function(p){
          var b=[]; if(doneBy[p])b.push(doneBy[p]+' missões'); if(photoBy[p])b.push(photoBy[p]+' fotos'); if(paidBy[p]>0)b.push('€'+paidBy[p].toFixed(0)+' adiantados');
          return pname(p)+': '+(b.join(', ')||'presente');
        }).join('\n')+'\n\nLucie & Thiago ❤';
        if(navigator.share) navigator.share({title:'Carta de Viagem',text:txt}).catch(function(){ copy(txt); });
        else copy(txt);
      });
    }

    /* ============================================================
       FASE 4 · ANEXOS (PDF/imagem) reaproveitáveis
       ============================================================ */
    function attachOf(key){ var a=jget(ATTACH_KEY,{}); return a[key]||[]; }
    function addAttach(key,name,dataUrl){ var a=jget(ATTACH_KEY,{}); a[key]=a[key]||[]; a[key].push({name:name,d:dataUrl,ts:Date.now()}); jset(ATTACH_KEY,a); }
    function delAttach(key,idx){ var a=jget(ATTACH_KEY,{}); if(a[key]){ a[key].splice(idx,1); jset(ATTACH_KEY,a); } }
    function attachBlock(key){
      var list=attachOf(key);
      var thumbs=list.map(function(f,i){
        var isImg=/^data:image\//.test(f.d);
        return '<div class="x2-att">' +
          (isImg?'<img src="'+f.d+'" alt="" data-x2view="'+key+'|'+i+'">':'<a href="'+f.d+'" download="'+esc(f.name)+'" class="x2-att-pdf">'+ic('doc')+'<span>'+esc(f.name)+'</span></a>') +
          '<button class="x2-att-x" data-x2attdel="'+key+'|'+i+'">×</button></div>';
      }).join('');
      return '<div class="x2-attwrap">'+thumbs+
        '<label class="x2-att-add"><input type="file" accept="image/*,application/pdf" data-x2attadd="'+key+'" style="display:none">+ anexar</label></div>';
    }

    /* ============================================================
       FASE 4 · ONDE DORMIMOS
       ============================================================ */
    function scrDormir(){
      var cards = HOTELS.map(function(h){
        var key='hotel:'+h.id;
        return '<div class="tl-card" style="margin-top:12px">' +
          '<div class="eyebrow">'+esc(h.city)+' · '+h.nights+' noite'+(h.nights>1?'s':'')+'</div>' +
          '<h3 class="serif" style="margin-top:4px;font-size:19px">'+esc(h.name)+'</h3>' +
          '<div class="text-soft text-small" style="margin-top:6px">'+esc(h.address)+'</div>' +
          '<div class="x2-kv">' +
            '<div><span>Check-in</span><strong>'+fmtBR(h.in)+' · '+esc(h.checkIn)+'</strong></div>' +
            '<div><span>Check-out</span><strong>'+fmtBR(h.out)+' · '+esc(h.checkOut)+'</strong></div>' +
            '<div><span>Reserva</span><strong>'+esc(h.conf||'—')+'</strong></div>' +
            '<div><span>PIN Booking</span><strong>'+esc(h.pin||'—')+'</strong></div>' +
            (h.parking?'<div><span>Estacionamento</span><strong>sim</strong></div>':'') +
            (h.view?'<div><span>Vista</span><strong>'+esc(h.view)+'</strong></div>':'') +
          '</div>' +
          '<div class="tl-actions">' +
            '<a class="tl-action primary" target="_blank" href="'+mapsUrl(h.mapsQuery||h.address)+'">'+ic('map')+'<span>Como chegar</span></a>' +
            '<a class="tl-action" target="_blank" href="'+wazeUrl(h.mapsQuery||h.address)+'">'+ic('waze')+'<span>Waze</span></a>' +
            (h.phone?'<a class="tl-action" href="'+telUrl(h.phone)+'">'+ic('phone')+'<span>Ligar</span></a>':'') +
            (h.phone?'<a class="tl-action" target="_blank" href="https://wa.me/'+String(h.phone).replace(/[^\d]/g,'')+'">'+ic('whats')+'<span>WhatsApp</span></a>':'') +
            '<button class="tl-action" data-x2copy="'+esc(h.address)+'">'+ic('doc')+'<span>Copiar endereço</span></button>' +
          '</div>' +
          '<div class="eyebrow" style="margin-top:14px">Voucher / e-mail de confirmação</div>' +
          attachBlock(key) +
        '</div>';
      }).join('');
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Substitui o Booking</div><h2 class="serif" style="margin-top:4px">Onde dormimos</h2></div>' +
        '<div class="pad">'+cards+'</div><div class="spacer-lg"></div>');
      wireAttach(); wireCopy();
    }
    function fmtBR(iso){ if(!iso) return '—'; var p=String(iso).split('-'); return p.length===3?(p[2]+'/'+p[1]):iso; }

    /* ============================================================
       FASE 4 · DECOLAGENS (voos)
       ============================================================ */
    function defaultFlights(){
      return [
        { id:'f-ida', airline:'TAP Air Portugal', no:'TP 12', from:'Fortaleza (FOR)', to:'Lisboa (LIS)', dep:'2026-05-21 22:55', arr:'2026-05-22 10:30', loc:'XMQFRJ', seat:'—', term:'T1' },
        { id:'f-con', airline:'TAP Air Portugal', no:'TP 1948', from:'Lisboa (LIS)', to:'Porto (OPO)', dep:'2026-05-22 12:40', arr:'2026-05-22 13:40', loc:'XMQFRJ', seat:'—', term:'T1' },
        { id:'f-vol', airline:'TAP Air Portugal', no:'TP 35', from:'Lisboa (LIS)', to:'Fortaleza (FOR)', dep:'2026-05-29 17:40', arr:'2026-05-29 22:05', loc:'XMQFRJ', seat:'—', term:'T1' }
      ];
    }
    function scrVoos(){
      if(!X.flights) X.flights = defaultFlights();
      var cards = X.flights.map(function(f){
        var key='flight:'+f.id;
        var statusUrl='https://www.flightaware.com/live/flight/'+encodeURIComponent(f.no.replace(/\s/g,''));
        return '<div class="tl-card" style="margin-top:12px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center"><div class="eyebrow">'+esc(f.airline)+'</div><strong style="font-family:\'JetBrains Mono\',monospace">'+esc(f.no)+'</strong></div>' +
          '<div class="x2-fly"><div><div class="x2-fly-c">'+esc(f.from)+'</div><div class="text-muted text-small">'+esc(f.dep)+'</div></div>' +
            '<div class="x2-fly-arrow">'+ic('plane')+'</div>' +
            '<div style="text-align:right"><div class="x2-fly-c">'+esc(f.to)+'</div><div class="text-muted text-small">'+esc(f.arr)+'</div></div></div>' +
          '<div class="x2-kv"><div><span>Localizador</span><strong>'+esc(f.loc)+'</strong></div><div><span>Assento</span><strong>'+esc(f.seat)+'</strong></div><div><span>Terminal</span><strong>'+esc(f.term)+'</strong></div></div>' +
          '<div class="tl-actions">' +
            '<a class="tl-action primary" target="_blank" href="'+statusUrl+'">'+ic('clock')+'<span>Status do voo</span></a>' +
            '<button class="tl-action" data-x2copy="'+esc(f.loc)+'">'+ic('doc')+'<span>Copiar localizador</span></button>' +
          '</div>' +
          '<div class="eyebrow" style="margin-top:14px">Cartão de embarque</div>' + attachBlock(key) +
        '</div>';
      }).join('');
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Substitui o app da companhia</div><h2 class="serif" style="margin-top:4px">Decolagens</h2>' +
        '<p class="text-soft text-small" style="margin-top:8px">Status ao vivo abre o FlightAware (sem chave). Anexe o cartão de embarque — toque para ver em tela cheia.</p></div>' +
        '<div class="pad">'+cards+'</div><div class="spacer-lg"></div>');
      wireAttach(); wireCopy();
    }

    /* ============================================================
       FASE 5b · VITRINE (ingressos)
       ============================================================ */
    function scrVitrine(){
      var today = new Date(); today.setHours(0,0,0,0);
      var sorted = X.tickets.slice().sort(function(a,b){ return (a.dt||'').localeCompare(b.dt||''); });
      var list = sorted.length ? sorted.map(function(t){
        var key='ticket:'+t.id;
        var isToday = t.dt && t.dt.slice(0,10) === isoToday();
        return '<div class="tl-card'+(isToday?' x2-today':'')+'" style="margin-top:12px">' +
          (isToday?'<div class="eyebrow" style="color:var(--terra)">HOJE</div>':'') +
          '<div style="display:flex;justify-content:space-between;gap:10px"><h3 class="serif" style="font-size:18px">'+esc(t.name)+'</h3>' +
          '<button class="x2-del" data-x2tdel="'+t.id+'">remover</button></div>' +
          '<div class="text-soft text-small" style="margin-top:4px">'+esc(t.dt||'sem data')+(t.place?' · '+esc(t.place):'')+(t.price?' · '+esc(t.price):'')+'</div>' +
          (t.note?'<div class="text-muted text-small" style="margin-top:4px">'+esc(t.note)+'</div>':'') +
          '<div class="eyebrow" style="margin-top:12px">Bilhete / QR</div>'+attachBlock(key) +
        '</div>';
      }).join('') : '<div class="tl-card" style="margin-top:12px"><p class="text-soft text-small">Nenhum ingresso ainda.</p></div>';
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Substitui PDFs soltos no e-mail</div><h2 class="serif" style="margin-top:4px">Vitrine</h2></div>' +
        '<div class="pad">' +
          '<div class="tl-card"><label class="x2-l">Nome</label><input id="tk-name" class="x2-in" placeholder="Ex.: Torre de Belém">' +
            '<label class="x2-l" style="margin-top:10px">Data e hora</label><input id="tk-dt" class="x2-in" type="datetime-local">' +
            '<label class="x2-l" style="margin-top:10px">Local</label><input id="tk-place" class="x2-in" placeholder="Endereço">' +
            '<div style="display:flex;gap:10px;margin-top:10px"><div style="flex:1"><label class="x2-l">Preço</label><input id="tk-price" class="x2-in" placeholder="€ 15"></div></div>' +
            '<label class="x2-l" style="margin-top:10px">Observação</label><input id="tk-note" class="x2-in" placeholder="Fila prioritária, etc.">' +
            '<button id="tk-add" class="x2-btn-primary" style="margin-top:14px">Adicionar ingresso</button></div>' +
          list +
        '</div><div class="spacer-lg"></div>');
      $('#tk-add') && ($('#tk-add').onclick=function(){
        var n=($('#tk-name').value||'').trim(); if(!n){ toast('Dê um nome'); return; }
        X.tickets.push({ id:'t'+Date.now(), name:n, dt:($('#tk-dt').value||'').replace('T',' '), place:$('#tk-place').value||'', price:$('#tk-price').value||'', note:$('#tk-note').value||'' });
        px(); toast('Ingresso adicionado'); scrVitrine();
      });
      $$('[data-x2tdel]').forEach(function(b){ b.onclick=function(){ if(confirm('Remover ingresso?')){ X.tickets=X.tickets.filter(function(t){ return t.id!==b.dataset.x2tdel; }); px(); scrVitrine(); } }; });
      wireAttach(); wireCopy();
    }
    function isoToday(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

    /* ============================================================
       FASE 6 · ÁLBUM compartilhado
       ============================================================ */
    function scrAlbum(){
      var album=jget(ALBUM_KEY,[]).slice().sort(function(a,b){ return b.ts-a.ts; });
      var grid = album.length ? '<div class="x2-album">'+album.map(function(a,i){
        return '<div class="x2-ph"><img src="'+a.d+'" alt="" data-x2phview="'+i+'"><span class="x2-ph-by" style="--pc:'+(PCOLOR[a.by]||'#999')+'">'+(a.by?pname(a.by):'?')+'</span><button class="x2-att-x" data-x2phdel="'+a.ts+'">×</button></div>';
      }).join('')+'</div>' : '<div class="tl-card"><p class="text-soft text-small">Álbum vazio. Capture um momento ou cole o link do álbum compartilhado.</p></div>';
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Substitui o Google Photos do dia a dia</div><h2 class="serif" style="margin-top:4px">Álbum</h2></div>' +
        '<div class="pad">' +
          '<div class="tl-card"><label class="x2-l">Link do álbum compartilhado (Google Photos / iCloud)</label>' +
            '<input id="al-link" class="x2-in" placeholder="https://photos.app.goo.gl/..." value="'+esc(X.albumLink)+'">' +
            '<div class="tl-actions"><button class="tl-action" id="al-save">'+ic('check')+'<span>Salvar link</span></button>' +
            (X.albumLink?'<a class="tl-action primary" target="_blank" href="'+esc(X.albumLink)+'">'+ic('view')+'<span>Abrir álbum</span></a>':'')+'</div>' +
            '<label class="x2-att-add" style="margin-top:12px;display:inline-flex"><input type="file" accept="image/*" capture="environment" id="al-cap" style="display:none">'+ic('view')+'&nbsp; Capturar momento</label></div>' +
          '<div style="margin-top:14px">'+grid+'</div>' +
        '</div><div class="spacer-lg"></div>');
      $('#al-save') && ($('#al-save').onclick=function(){ X.albumLink=($('#al-link').value||'').trim(); px(); toast('Link salvo'); scrAlbum(); });
      $('#al-cap') && ($('#al-cap').onchange=function(e){
        var f=e.target.files&&e.target.files[0]; if(!f) return;
        fileToDataUrl(f).then(function(d){
          var al=jget(ALBUM_KEY,[]); al.push({ ts:Date.now(), by:activeId(), d:d });
          if(jset(ALBUM_KEY,al)){ toast('Foto no álbum'); scrAlbum(); }
        });
      });
      $$('[data-x2phview]').forEach(function(im){ im.onclick=function(){ lightbox(im.querySelector?im.src:im.src); }; });
      $$('[data-x2phdel]').forEach(function(b){ b.onclick=function(){
        if(!confirm('Apagar esta foto?')) return;
        var al=jget(ALBUM_KEY,[]).filter(function(a){ return String(a.ts)!==b.dataset.x2phdel; }); jset(ALBUM_KEY,al); scrAlbum();
      }; });
    }

    /* ============================================================
       FASE 6 · MODO CONVERSA (PT-PT + áudio)
       ============================================================ */
    var PTPT = [
      ['ônibus','autocarro'],['ponto de ônibus','paragem'],['trem','comboio'],['fila','bicha'],
      ['sorvete','gelado'],['suco','sumo'],['sanduíche','sande'],['xícara','chávena'],
      ['banheiro','casa de banho'],['celular','telemóvel'],['café da manhã','pequeno-almoço'],
      ['geladeira','frigorífico'],['açougue','talho'],['calçada','passeio'],['meia','peúga'],
      ['terno','fato'],['cafezinho','bica'],['privada','sanita'],['caixa eletrônico','multibanco'],
      ['legal','fixe'],['cara (pessoa)','gajo'],['grama','relva'],['professor','stôr']
    ];
    function toPTPT(txt){
      var out=' '+txt+' ';
      PTPT.forEach(function(p){ out = out.replace(new RegExp('\\b'+p[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'), p[1]); });
      return out.trim();
    }
    function scrConversa(){
      var PH = G.PHRASES || [];
      var phraseCard = PH.length ? '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Frases PT-PT · como falar / o que significa</div>' +
        PH.map(function(p){ return '<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div style="font-family:\'Fraunces\',serif;font-size:15px">'+esc(p.pt)+'</div><div class="text-muted text-small" style="margin-top:2px">'+esc(p.br)+'</div></div>'; }).join('') +
        '</div>' : '';
      mount(back() +
        '<div class="pad mt-16"><div class="eyebrow">Como falar em Portugal</div><h2 class="serif" style="margin-top:4px">Falar PT-PT</h2>' +
        '<p class="text-soft text-small" style="margin-top:8px">Escreva como você falaria no Brasil. Devolvemos a versão PT-PT e o áudio para ouvir e repetir.</p></div>' +
        '<div class="pad"><div class="tl-card">' +
          '<textarea id="cv-in" class="x2-in" rows="3" placeholder="Ex.: onde fica o ponto de ônibus? quero um suco e um sanduíche."></textarea>' +
          '<button id="cv-go" class="x2-btn-primary" style="margin-top:12px">Traduzir para PT-PT</button>' +
          '<div id="cv-out" style="display:none;margin-top:16px"><div class="eyebrow">Em Portugal você diz</div>' +
            '<p id="cv-txt" style="font-family:\'Fraunces\',serif;font-size:20px;margin-top:6px;line-height:1.45"></p>' +
            '<button id="cv-say" class="tl-action primary" style="margin-top:10px">'+ic('bubble')+'<span>Ouvir</span></button></div>' +
        '</div>' +
        '<div class="tl-card" style="margin-top:14px"><div class="eyebrow">Atalhos do dia</div>' +
          ['Bom dia, queria uma bica, se fizer favor.','Onde fica a paragem do autocarro?','A conta, por favor. Aceita multibanco?','Um sumo natural e uma sande mista.','Com licença, pode tirar uma foto?'].map(function(s){
            return '<button class="x2-quote" data-x2say="'+esc(s)+'">"'+esc(s)+'"</button>';
          }).join('') +
        '</div>' + phraseCard + '</div><div class="spacer-lg"></div>');
      $('#cv-go') && ($('#cv-go').onclick=function(){
        var v=($('#cv-in').value||'').trim(); if(!v) return;
        var r=toPTPT(v);
        $('#cv-txt').textContent=r; $('#cv-out').style.display='block';
        $('#cv-say').onclick=function(){ speak(r); };
      });
      $$('[data-x2say]').forEach(function(b){ b.onclick=function(){ speak(b.dataset.x2say); }; });
    }
    function speak(txt){
      try{
        var u=new SpeechSynthesisUtterance(txt); u.lang='pt-PT'; u.rate=.92;
        var vs=speechSynthesis.getVoices(); var pt=vs.filter(function(v){ return /pt-PT/i.test(v.lang); })[0] || vs.filter(function(v){ return /^pt/i.test(v.lang); })[0];
        if(pt) u.voice=pt;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      }catch(e){ toast('Áudio indisponível neste aparelho'); }
    }

    /* ---------- anexos / copiar / lightbox (delegação) ---------- */
    function wireAttach(){
      $$('[data-x2attadd]').forEach(function(inp){ inp.onchange=function(e){
        var f=e.target.files&&e.target.files[0]; if(!f) return;
        if(f.size>4.5*1024*1024 && !/^image\//.test(f.type)){ if(!confirm('Arquivo grande ('+(f.size/1048576).toFixed(1)+'MB). Pode estourar a memória do navegador. Continuar?')) return; }
        fileToDataUrl(f).then(function(d){ addAttach(inp.dataset.x2attadd, f.name, d); G.renderMais(); });
      }; });
      $$('[data-x2attdel]').forEach(function(b){ b.onclick=function(){
        var pr=b.dataset.x2attdel.split('|'); if(confirm('Remover anexo?')){ delAttach(pr[0], parseInt(pr[1],10)); G.renderMais(); }
      }; });
      $$('[data-x2view]').forEach(function(im){ im.onclick=function(){ lightbox(im.src); }; });
    }
    function wireCopy(){ $$('[data-x2copy]').forEach(function(b){ b.onclick=function(){ copy(b.dataset.x2copy); }; }); }
    function lightbox(src){
      var o=document.createElement('div'); o.className='x2-lb';
      o.innerHTML='<img src="'+src+'" alt=""><button class="x2-lb-x" aria-label="Fechar">×</button>';
      o.onclick=function(){ o.remove(); };
      document.body.appendChild(o);
    }

    /* ============================================================
       FASE 5 · CLIMA INTELIGENTE (widget na Hoje)
       ============================================================ */
    var WX_KEY='pt2026:x2:wx';
    function cityForToday(){
      var iso=isoToday();
      var d = DAYS.find(function(x){ return x.date===iso; });
      if(!d){
        // antes da viagem: Porto (chegada); depois: Lisboa
        if(iso < DAYS[0].date) return { name:'Porto', lat:41.1496, lng:-8.6109 };
        return { name:'Lisboa', lat:38.7223, lng:-9.1393 };
      }
      var coords={ 'Porto':[41.1496,-8.6109],'Douro':[41.1797,-7.5436],'Lisboa':[38.7223,-9.1393],'Em trânsito':[39.5,-8.8],'Lisboa → Fortaleza':[38.7223,-9.1393] };
      var c=coords[d.city]||coords['Lisboa'];
      return { name:d.city, lat:c[0], lng:c[1], where:d.where };
    }
    var WMAP={0:['Céu limpo','☀️'],1:['Pouca nuvem','🌤️'],2:['Parcial','⛅'],3:['Nublado','☁️'],45:['Nevoeiro','🌫️'],48:['Nevoeiro','🌫️'],51:['Chuvisco','🌦️'],53:['Chuvisco','🌦️'],55:['Chuvisco','🌦️'],61:['Chuva fraca','🌧️'],63:['Chuva','🌧️'],65:['Chuva forte','🌧️'],71:['Neve','🌨️'],80:['Aguaceiros','🌦️'],81:['Aguaceiros','🌦️'],82:['Aguaceiros fortes','⛈️'],95:['Trovoada','⛈️'],96:['Trovoada','⛈️'],99:['Trovoada','⛈️']};
    function fetchWx(){
      var c=cityForToday();
      var url='https://api.open-meteo.com/v1/forecast?latitude='+c.lat+'&longitude='+c.lng+'&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FLisbon&forecast_days=1';
      return fetch(url).then(function(r){ return r.json(); }).then(function(d){
        var w={ city:c.name, where:c.where||'', t:Math.round(d.current.temperature_2m), feels:Math.round(d.current.apparent_temperature),
          code:d.current.weather_code, max:Math.round(d.daily.temperature_2m_max[0]), min:Math.round(d.daily.temperature_2m_min[0]),
          rain:d.daily.precipitation_probability_max[0], ts:Date.now() };
        try{ localStorage.setItem(WX_KEY, JSON.stringify(w)); }catch(e){}
        return w;
      });
    }
    function wxCardHtml(w){
      var wm=WMAP[w.code]||['—','🌡️'];
      var rainAlert = (w.rain!=null && w.rain>=55) ?
        '<div class="x2-wx-alert">'+ic('warn')+' Alta chance de chuva ('+w.rain+'%) em '+w.city+'. Vale priorizar o que é coberto e deixar o passeio externo para a janela mais seca.</div>' : '';
      return '<div class="x2-wx">' +
        '<div class="x2-wx-em">'+wm[1]+'</div>' +
        '<div class="x2-wx-main"><div class="x2-wx-t">'+w.t+'°<span>C</span></div>' +
          '<div class="x2-wx-meta">'+wm[0]+' · sensação '+w.feels+'° · '+w.city+'</div>' +
          '<div class="x2-wx-meta">máx '+w.max+'° / mín '+w.min+'° · chuva '+(w.rain==null?'—':w.rain+'%')+'</div></div>' +
      '</div>'+rainAlert;
    }
    function injectWeather(){
      var host=$('#hoje-content'); if(!host || host.querySelector('.x2-wx-wrap')) return;
      var wrap=document.createElement('div'); wrap.className='pad x2-wx-wrap'; wrap.style.marginTop='14px';
      wrap.innerHTML='<div class="section"><div class="section-head"><h2 class="serif">Clima de hoje</h2><span class="meta">Open-Meteo</span></div><div id="x2-wx-slot"><div class="x2-wx skel">a carregar…</div></div></div>';
      // inserir após a primeira .section (depois do hero/status), antes do resto
      var firstSection = host.querySelector('.section');
      if(firstSection && firstSection.parentNode) firstSection.parentNode.insertBefore(wrap, firstSection);
      else host.appendChild(wrap);
      var cached=null; try{ cached=JSON.parse(localStorage.getItem(WX_KEY)); }catch(e){}
      if(cached && (Date.now()-cached.ts)<3*3600*1000){ $('#x2-wx-slot').innerHTML=wxCardHtml(cached); }
      fetchWx().then(function(w){ var s=$('#x2-wx-slot'); if(s) s.innerHTML=wxCardHtml(w); })
        .catch(function(){ var s=$('#x2-wx-slot'); if(s){ if(cached) s.innerHTML=wxCardHtml(cached); else s.innerHTML='<div class="x2-wx"><div class="x2-wx-meta">Sem rede agora — o clima volta quando houver sinal.</div></div>'; } });
    }
    // atalho rápido para a Caixinha na tela Hoje
    function injectCaixaShortcut(){
      var grid=$('#hoje-content .quick-grid');
      if(grid && !grid.querySelector('[data-x2caixa]')){
        grid.insertAdjacentHTML('beforeend','<button class="qa" data-x2caixa><div class="qa-icon">'+ic('euro')+'</div><span>Caixinha</span></button>');
        var b=grid.querySelector('[data-x2caixa]'); b.onclick=function(){ state.maisSub='caixinha'; px(); G.goTo('mais'); };
      }
    }
    var origHoje=G.renderHoje;
    if(typeof origHoje==='function'){
      G.renderHoje=function(){ origHoje.apply(this,arguments); try{ injectWeather(); injectCaixaShortcut(); }catch(e){} };
    }

    /* ---------- estilos ---------- */
    injectCSS();
    function injectCSS(){
      if($('#x2-css')) return;
      var s=document.createElement('style'); s.id='x2-css';
      s.textContent = [
        ".x2-tile .ut-icon{color:var(--terra)}",
        ".x2-segment{display:flex;gap:6px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-pill,999px);padding:4px}",
        ".x2-seg{flex:1;padding:9px 6px;border-radius:999px;font-size:13px;font-weight:600;color:var(--ink-muted);transition:.2s}",
        ".x2-seg.on{background:var(--olive);color:#fff}",
        ".x2-in{width:100%;padding:12px 14px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;color:var(--ink);font:inherit;outline:none}",
        ".x2-in:focus{border-color:var(--olive)}",
        ".x2-l{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:6px;font-weight:600}",
        ".x2-payers{display:flex;flex-wrap:wrap;gap:8px}",
        ".x2-payer,.x2-split,.x2-with{padding:9px 14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-size:13px;font-weight:600;color:var(--ink-soft)}",
        ".x2-payer.on,.x2-with.on{background:var(--pc,var(--olive));color:#fff;border-color:transparent}",
        ".x2-split.on{background:var(--olive);color:#fff;border-color:transparent}",
        ".x2-btn-primary{width:100%;padding:15px;background:var(--olive);color:#fff;border-radius:14px;font-weight:700;font-size:15px}",
        ".x2-btn-primary:active{transform:scale(.99)}",
        ".x2-chip{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--pc,#999);color:#fff;font-size:12px;font-weight:700}",
        ".x2-balrow{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}",
        ".x2-balrow:last-child{border-bottom:0}",
        ".x2-balv{text-align:right;font-family:'Fraunces',serif;font-size:17px;font-weight:600}",
        ".x2-balv small{font-size:11px}",
        ".x2-exp .x2-del,.x2-del{background:none;color:var(--terra);font-size:11px;text-decoration:underline;margin-top:6px}",
        ".x2-stampgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;margin-top:10px}",
        ".x2-stamp{aspect-ratio:1;border:2px dashed var(--sc,#999);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px;color:var(--sc,#999);transform:rotate(-6deg);background:var(--surface)}",
        ".x2-stamp.empty{border-style:dotted;color:var(--ink-muted);font-size:11px;transform:none;border-color:var(--line)}",
        ".x2-stamp-em{font-size:22px;line-height:1}",
        ".x2-stamp-city{font-family:'Fraunces',serif;font-size:13px;font-weight:700;margin-top:2px}",
        ".x2-stamp-date{font-size:10px;font-family:'JetBrains Mono',monospace}",
        ".x2-stamp-who{font-size:8px;letter-spacing:.08em;margin-top:2px}",
        ".x2-stamp-t{font-size:8px;opacity:.8;margin-top:3px;line-height:1.2}",
        ".x2-cartaline{padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06)}",
        ".x2-cartaline:last-child{border-bottom:0}",
        ".x2-kv{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-top:12px}",
        ".x2-kv span{display:block;font-size:11px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:.04em}",
        ".x2-kv strong{font-size:14px}",
        ".x2-attwrap{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}",
        ".x2-att{position:relative;width:74px;height:74px;border-radius:10px;overflow:hidden;border:1px solid var(--line)}",
        ".x2-att img{width:100%;height:100%;object-fit:cover}",
        ".x2-att-pdf{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;font-size:9px;text-align:center;color:var(--ink-soft);padding:4px;gap:2px}",
        ".x2-att-x{position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:14px;line-height:1}",
        ".x2-att-add{width:74px;height:74px;border-radius:10px;border:1px dashed var(--olive);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--olive);font-weight:600;cursor:pointer}",
        ".x2-fly{display:flex;justify-content:space-between;align-items:center;margin:14px 0;gap:10px}",
        ".x2-fly-c{font-family:'Fraunces',serif;font-size:15px;font-weight:600}",
        ".x2-fly-arrow{color:var(--olive)}",
        ".x2-today{border:2px solid var(--terra)}",
        ".x2-album{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}",
        ".x2-ph{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden}",
        ".x2-ph img{width:100%;height:100%;object-fit:cover}",
        ".x2-ph-by{position:absolute;left:4px;bottom:4px;padding:2px 8px;border-radius:999px;background:var(--pc,#999);color:#fff;font-size:10px;font-weight:700}",
        ".x2-quote{display:block;width:100%;text-align:left;padding:11px 14px;margin-top:8px;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;font-size:14px;color:var(--ink-soft)}",
        ".x2-toast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,20px);background:var(--ink);color:var(--surface);padding:11px 20px;border-radius:999px;font-size:13px;font-weight:600;z-index:9999;opacity:0;transition:.3s;pointer-events:none}",
        ".x2-toast.in{opacity:1;transform:translate(-50%,0)}",
        ".x2-lb{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}",
        ".x2-lb img{max-width:100%;max-height:100%;border-radius:8px}",
        ".x2-lb-x{position:absolute;top:calc(16px + env(safe-area-inset-top));right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:22px}",
        ".x2-wx{display:flex;align-items:center;gap:16px;padding:16px;background:var(--surface-2);border:1px solid var(--line);border-radius:16px}",
        ".x2-wx.skel{opacity:.6;font-size:13px;color:var(--ink-muted);justify-content:center}",
        ".x2-wx-em{font-size:42px;line-height:1}",
        ".x2-wx-t{font-family:'Fraunces',serif;font-size:34px;line-height:1}",
        ".x2-wx-t span{font-size:15px;color:var(--ink-muted)}",
        ".x2-wx-meta{font-size:12px;color:var(--ink-muted);margin-top:3px}",
        ".x2-wx-alert{margin-top:10px;padding:11px 14px;background:var(--terra-50);border:1px solid var(--terra-light);border-radius:12px;font-size:12.5px;color:var(--terra-dark);display:flex;gap:8px;align-items:flex-start;line-height:1.4}",
        ".x2-wx-alert svg{flex:none;width:16px;height:16px}"
      ].join('\n');
      document.head.appendChild(s);
    }

    // se já estiver na tela Mais agora, re-render para mostrar tiles
    try{
      var cur=document.querySelector('.view.active');
      if(cur && cur.dataset.view==='mais') G.renderMais();
      if(cur && cur.dataset.view==='hoje' && typeof G.renderHoje==='function') G.renderHoje();
    }catch(e){}

    console.log('[PT-2026] extras.js v3.0 carregado — Fases 2–6 ativas');
  }
})();
