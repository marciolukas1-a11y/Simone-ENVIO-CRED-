(function(){
var STAGES=[{id:'novo',nome:'Novo'},{id:'simulacao',nome:'Simulação'},{id:'proposta',nome:'Proposta'},{id:'contratado',nome:'Contratado'},{id:'perdido',nome:'Perdido'}];
var ITEM_ST=[{id:'disponivel',nome:'Disponível'},{id:'reservado',nome:'Reservado'},{id:'vendido',nome:'Vendido'}];
var S=null, storageOk=true;
var ATENDENTE='Simone', TAXA_PADRAO=5, SERVIDOR_URL='', APP_API_TOKEN='';
var conversasCache=[], iaPausada=false;
var brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function money(v){return brl.format(Number(v)||0)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uid(){return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function stageName(id){var s=STAGES.filter(function(x){return x.id===id})[0];return s?s.nome:id}
function itemName(id){var s=ITEM_ST.filter(function(x){return x.id===id})[0];return s?s.nome:id}

function seed(){
  return {
    clients:[
      {id:uid(),ex:true,nome:'Maria Souza',tel:'(11) 90000-0001',tipo:'emprestimo',valor:2000,etapa:'simulacao',obs:'Quer pagar em 6 parcelas.'},
      {id:uid(),ex:true,nome:'João Pereira',tel:'(11) 90000-0002',tipo:'objeto',valor:650,etapa:'proposta',obs:'Interessado no violão.'},
      {id:uid(),ex:true,nome:'Ana Lima',tel:'(11) 90000-0003',tipo:'emprestimo',valor:1200,etapa:'novo',obs:''}
    ],
    items:[
      {id:uid(),ex:true,nome:'Violão Takamine',preco:650,status:'disponivel',desc:'Bom estado, acompanha capa.'},
      {id:uid(),ex:true,nome:'Bicicleta aro 29',preco:900,status:'reservado',desc:'Pouco uso.'}
    ],
    sim:{valor:1500,n:6,taxa:5,clientId:''}
  };
}

// Persistência: carregamento acontece uma vez no boot(); daí pra frente S
// fica em memória e save() grava em segundo plano no SQLite a cada mudança.
function save(){
  if(!global_EnvioCredStorage) return;
  global_EnvioCredStorage.save(S).catch(function(e){storageOk=false;console.error('Falha ao salvar',e)});
}
var global_EnvioCredStorage=window.EnvioCredStorage;

var ui={tab:'clientes',filter:'todos',q:''};
try{var h=(location.hash||'').replace('#','');if(['clientes','funil','simulador','objetos'].indexOf(h)>-1)ui.tab=h}catch(e){}
var $main=document.getElementById('main');

function digits(t){return String(t||'').replace(/\D/g,'')}
function waNumber(t){var d=digits(t);if(!d)return '';if(d.length<=11)d='55'+d;return d}
function waLink(tel,text){var n=waNumber(tel);return 'https://wa.me/'+(n?n:'')+'?text='+encodeURIComponent(text||'')}
function pmt(P,i,n){if(n<=0)return 0;if(i===0)return P/n;return P*i/(1-Math.pow(1+i,-n))}
function calc(sim){
  var P=Number(sim.valor)||0,n=Math.round(Number(sim.n)||0),i=(Number(sim.taxa)||0)/100;
  var p=pmt(P,i,n),total=p*n;
  return {P:P,n:n,i:i,parcela:p,total:total,juros:total-P};
}
function simText(sim,nome){
  var c=calc(sim);
  return 'Olá'+(nome?', '+nome:'')+'! Segue a simulação de empréstimo pessoal da ENVIO CRED:\n'+
   '• Valor: '+money(c.P)+'\n• Parcelas: '+c.n+'x de '+money(c.parcela)+'\n• Taxa: '+String(sim.taxa).replace('.',',')+'% ao mês\n• Total a pagar: '+money(c.total)+'\n'+
   'Valores sujeitos a análise. Posso seguir com a proposta?';
}
function clientById(id){return S.clients.filter(function(c){return c.id===id})[0]}
function nextStage(id){var o=['novo','simulacao','proposta','contratado'];var k=o.indexOf(id);return k>-1&&k<o.length-1?o[k+1]:null}

/* ---------- Views ---------- */
function hasExamples(){return S.clients.some(function(c){return c.ex})||S.items.some(function(c){return c.ex})}
function banner(){
  var out='';
  if(hasExamples())out+='<div class="banner"><span>Os cadastros marcados como exemplo são só para mostrar o app.</span><button class="linkbtn" data-act="clearEx" type="button">Apagar exemplos</button></div>';
  if(!storageOk)out+='<div class="banner"><span>Não consegui salvar os dados agora. Use Backup para não perder nada.</span></div>';
  return out;
}
function clientCard(c){
  var nx=nextStage(c.etapa);
  var greet='Olá, '+c.nome.split(' ')[0]+'! Aqui é a '+ATENDENTE+', da ENVIO CRED.';
  return '<div class="card">'+
   '<div class="row"><div><div class="name">'+esc(c.nome)+(c.ex?' <span class="tag">exemplo</span>':'')+'</div>'+
   '<div class="sub">'+(c.tipo==='emprestimo'?'Empréstimo pessoal':'Compra de objeto')+(c.tel?' · '+esc(c.tel):'')+'</div></div>'+
   '<span class="pill '+esc(c.etapa)+'">'+esc(stageName(c.etapa))+'</span></div>'+
   (c.valor?'<div class="num">'+money(c.valor)+'</div>':'')+
   (c.obs?'<div class="sub">'+esc(c.obs)+'</div>':'')+
   '<div class="btns">'+
   (c.tel?'<a class="btn primary" target="_blank" rel="noopener" href="'+esc(waLink(c.tel,greet))+'" data-wa="1">WhatsApp</a>':'')+
   (nx?'<button class="btn" type="button" data-act="advance" data-id="'+c.id+'">Mover para '+esc(stageName(nx))+'</button>':'')+
   '<button class="btn" type="button" data-act="editClient" data-id="'+c.id+'">Editar</button></div></div>';
}
function viewClientes(){
  var q=ui.q.trim().toLowerCase();
  var list=S.clients.filter(function(c){
    if(ui.filter!=='todos'&&c.etapa!==ui.filter)return false;
    if(q&&(c.nome+' '+c.tel).toLowerCase().indexOf(q)<0)return false;
    return true;
  });
  var chips='<button class="chip" type="button" data-act="filter" data-v="todos" aria-pressed="'+(ui.filter==='todos')+'">Todos ('+S.clients.length+')</button>';
  STAGES.forEach(function(s){
    var n=S.clients.filter(function(c){return c.etapa===s.id}).length;
    chips+='<button class="chip" type="button" data-act="filter" data-v="'+s.id+'" aria-pressed="'+(ui.filter===s.id)+'">'+s.nome+' ('+n+')</button>';
  });
  return banner()+
   '<input class="search" id="q" type="search" placeholder="Buscar por nome ou telefone" value="'+esc(ui.q)+'" aria-label="Buscar cliente">'+
   '<div class="chips">'+chips+'</div>'+
   '<div class="list" id="clist">'+(list.length?list.map(clientCard).join(''):'<div class="empty">Nenhum cliente aqui ainda. Toque em “Novo cliente” para cadastrar o primeiro.</div>')+'</div>'+
   '<div class="fab"><button class="btn primary wide" type="button" data-act="newClient">Novo cliente</button></div>';
}
function viewFunil(){
  var total=S.clients.length||1;
  var html=banner()+'<h2>Funil de vendas</h2><div class="list">';
  STAGES.forEach(function(s){
    var cs=S.clients.filter(function(c){return c.etapa===s.id});
    var sum=cs.reduce(function(a,c){return a+(Number(c.valor)||0)},0);
    html+='<button class="card stage" type="button" data-act="goStage" data-v="'+s.id+'" style="text-align:left;cursor:pointer;--c:var(--s-'+({novo:'novo',simulacao:'sim',proposta:'prop',contratado:'ok',perdido:'lost'}[s.id])+')">'+
     '<div class="row"><span class="pill '+s.id+'">'+s.nome+'</span><span class="num">'+cs.length+(cs.length===1?' cliente':' clientes')+'</span></div>'+
     '<div class="bar"><i style="width:'+Math.round(cs.length/total*100)+'%"></i></div>'+
     '<div class="sub">Valor em negociação: <span class="num">'+money(sum)+'</span></div></button>';
  });
  html+='</div><p class="note">Toque em uma etapa para ver os clientes dela.</p>';
  return html;
}
function viewSimulador(){
  var sim=S.sim;
  var opts='<option value="">Sem cliente (escolho o contato no WhatsApp)</option>'+S.clients.map(function(c){return '<option value="'+c.id+'"'+(c.id===sim.clientId?' selected':'')+'>'+esc(c.nome)+'</option>'}).join('');
  return banner()+'<h2>Simulador de empréstimo pessoal</h2>'+
   '<div class="card">'+
   '<label class="f">Cliente<select id="s_cli">'+opts+'</select></label>'+
   '<label class="f">Valor do empréstimo (R$)<input id="s_valor" type="number" inputmode="decimal" min="0" step="50" value="'+esc(sim.valor)+'"></label>'+
   '<div class="grid2"><label class="f">Parcelas<input id="s_n" type="number" inputmode="numeric" min="1" max="120" step="1" value="'+esc(sim.n)+'"></label>'+
   '<label class="f">Taxa ao mês (%)<input id="s_taxa" type="number" inputmode="decimal" min="0" step="0.1" value="'+esc(sim.taxa)+'"></label></div>'+
   '</div>'+
   '<div id="simResult" style="margin-top:12px"></div>'+
   '<div class="btns" style="margin-top:12px"><a class="btn primary" id="s_wa" target="_blank" rel="noopener" href="#" data-wa="1">Enviar pelo WhatsApp</a>'+
   '<button class="btn" type="button" data-act="copySim" id="s_copy">Copiar mensagem</button>'+
   '<button class="btn" type="button" data-act="saveSim">Salvar no cliente</button></div>'+
   '<p class="note" id="s_msg" style="margin-top:10px">Cálculo pela tabela Price (parcelas fixas). Informe a taxa que a ENVIO CRED pratica; os valores mostrados são só um exemplo.</p>';
}
function updateSim(){
  var c=calc(S.sim);
  var el=document.getElementById('simResult');if(!el)return;
  el.innerHTML='<div class="result"><span style="font-size:13px;opacity:.9">Parcela mensal</span><span class="big">'+money(c.parcela)+'</span>'+
   '<div class="lines"><span>Valor liberado</span><span class="num">'+money(c.P)+'</span><span>Número de parcelas</span><span class="num">'+c.n+'x</span><span>Juros no período</span><span class="num">'+money(c.juros)+'</span><span>Total a pagar</span><span class="num">'+money(c.total)+'</span></div></div>';
  var cli=clientById(S.sim.clientId);
  var a=document.getElementById('s_wa');
  if(a)a.href=waLink(cli?cli.tel:'',simText(S.sim,cli?cli.nome.split(' ')[0]:''));
}
function itemCard(it){
  var msg='Olá! Tenho à venda: '+it.nome+' por '+money(it.preco)+'.'+(it.desc?' '+it.desc:'')+' Tem interesse?';
  return '<div class="card"><div class="row"><div><div class="name">'+esc(it.nome)+(it.ex?' <span class="tag">exemplo</span>':'')+'</div>'+
   (it.desc?'<div class="sub">'+esc(it.desc)+'</div>':'')+'</div><span class="pill '+esc(it.status)+'">'+esc(itemName(it.status))+'</span></div>'+
   '<div class="num">'+money(it.preco)+'</div>'+
   '<div class="btns"><a class="btn primary" target="_blank" rel="noopener" href="'+esc(waLink('',msg))+'" data-wa="1">Divulgar no WhatsApp</a>'+
   '<button class="btn" type="button" data-act="editItem" data-id="'+it.id+'">Editar</button></div></div>';
}
function viewObjetos(){
  var disp=S.items.filter(function(i){return i.status==='disponivel'});
  var sum=disp.reduce(function(a,i){return a+(Number(i.preco)||0)},0);
  return banner()+'<h2>Objetos à venda</h2>'+
   '<p class="sub" style="margin:-6px 0 12px">'+disp.length+' disponível'+(disp.length===1?'':'is')+' · <span class="num">'+money(sum)+'</span> em estoque</p>'+
   '<div class="list">'+(S.items.length?S.items.map(itemCard).join(''):'<div class="empty">Nenhum objeto cadastrado. Toque em “Novo objeto” para começar.</div>')+'</div>'+
   '<div class="fab"><button class="btn primary wide" type="button" data-act="newItem">Novo objeto</button></div>';
}

function conversaCard(c){
  var atendendoIa=c.atendido_por==='ia';
  return '<div class="card"><div class="row"><div><div class="name">'+esc(c.telefone)+'</div>'+
   (c.ultima_mensagem?'<div class="sub">'+esc(c.ultima_mensagem)+'</div>':'')+'</div>'+
   '<span class="pill '+(atendendoIa?'simulacao':'contratado')+'">'+(atendendoIa?'IA atendendo':'Simone atendendo')+'</span></div>'+
   '<div class="btns">'+
   (atendendoIa
     ?'<button class="btn" type="button" data-act="assumirConversa" data-tel="'+esc(c.telefone)+'">Assumir conversa</button>'
     :'<button class="btn" type="button" data-act="devolverConversa" data-tel="'+esc(c.telefone)+'">Devolver para a IA</button>')+
   '<button class="btn primary" type="button" data-act="responderConversa" data-tel="'+esc(c.telefone)+'">Responder</button>'+
   '</div></div>';
}
function viewConversas(){
  var aviso=!SERVIDOR_URL?'<div class="banner"><span>Configure o endereço do servidor em Config para ver as conversas.</span></div>':'';
  return banner()+aviso+
   '<div class="row" style="margin-bottom:12px"><h2 style="margin:0">Conversas</h2>'+
   '<button class="btn '+(iaPausada?'primary':'danger')+'" type="button" data-act="alternarPausaIa">'+(iaPausada?'Retomar IA':'Pausar IA')+'</button></div>'+
   '<div class="list" id="conversasList">'+
   (conversasCache.length?conversasCache.map(conversaCard).join(''):'<div class="empty">Nenhuma conversa ainda (ou servidor não configurado/offline).</div>')+
   '</div>';
}
async function carregarConversas(){
  if(!SERVIDOR_URL)return;
  try{
    conversasCache=await window.EnvioCredApi.listarConversas(SERVIDOR_URL,APP_API_TOKEN);
    var cfg=await window.EnvioCredApi.obterConfiguracoesServidor(SERVIDOR_URL,APP_API_TOKEN);
    iaPausada=!!cfg.ia_pausada;
    if(ui.tab==='conversas')render(true);
  }catch(e){console.error('Falha ao carregar conversas',e)}
}

function render(keepScroll){
  var st=$main.scrollTop;
  var v={clientes:viewClientes,funil:viewFunil,simulador:viewSimulador,objetos:viewObjetos,conversas:viewConversas}[ui.tab]();
  $main.innerHTML=v;
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'),function(b){b.setAttribute('aria-selected',String(b.getAttribute('data-tab')===ui.tab))});
  if(ui.tab==='simulador')updateSim();
  if(ui.tab==='conversas')carregarConversas();
  if(keepScroll)$main.scrollTop=st;
}

/* ---------- Sheet ---------- */
var sheet=document.getElementById('sheet'),form=document.getElementById('sheetForm'),onSubmit=null;
function openSheet(html,submit){form.innerHTML=html;onSubmit=submit;sheet.hidden=false;var f=form.querySelector('input,textarea,select');if(f&&!(/backup|config/.test(form.className)))f.focus()}
function closeSheet(){sheet.hidden=true;onSubmit=null;form.innerHTML='';form.className=''}
form.addEventListener('submit',function(e){e.preventDefault();if(onSubmit)onSubmit(new FormData(form))});
function opt(list,sel){return list.map(function(s){return '<option value="'+s.id+'"'+(s.id===sel?' selected':'')+'>'+s.nome+'</option>'}).join('')}

function clientForm(c){
  var isNew=!c;c=c||{nome:'',tel:'',tipo:'emprestimo',valor:'',etapa:'novo',obs:''};
  openSheet('<h3>'+(isNew?'Novo cliente':'Editar cliente')+'</h3>'+
   '<label class="f">Nome<input name="nome" required value="'+esc(c.nome)+'" autocomplete="off"></label>'+
   '<label class="f">WhatsApp com DDD<input name="tel" type="tel" inputmode="tel" placeholder="(11) 90000-0000" value="'+esc(c.tel)+'"></label>'+
   '<div class="grid2"><label class="f">Interesse<select name="tipo"><option value="emprestimo"'+(c.tipo==='emprestimo'?' selected':'')+'>Empréstimo</option><option value="objeto"'+(c.tipo==='objeto'?' selected':'')+'>Compra de objeto</option></select></label>'+
   '<label class="f">Valor (R$)<input name="valor" type="number" inputmode="decimal" min="0" step="0.01" value="'+esc(c.valor)+'"></label></div>'+
   '<label class="f">Etapa<select name="etapa">'+opt(STAGES,c.etapa)+'</select></label>'+
   '<label class="f">Observações<textarea name="obs">'+esc(c.obs)+'</textarea></label>'+
   '<div class="btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
   (isNew?'':'<button class="btn danger" type="button" data-act="askDel" data-kind="client" data-id="'+c.id+'">Excluir</button>')+'</div>',
   function(fd){
     var data={nome:fd.get('nome').trim(),tel:fd.get('tel').trim(),tipo:fd.get('tipo'),valor:Number(fd.get('valor'))||0,etapa:fd.get('etapa'),obs:fd.get('obs').trim()};
     if(!data.nome)return;
     if(isNew){data.id=uid();S.clients.unshift(data)}else{Object.keys(data).forEach(function(k){c[k]=data[k]});delete c.ex}
     save();closeSheet();render(true);
   });
}
function itemForm(it){
  var isNew=!it;it=it||{nome:'',preco:'',status:'disponivel',desc:''};
  openSheet('<h3>'+(isNew?'Novo objeto':'Editar objeto')+'</h3>'+
   '<label class="f">Objeto<input name="nome" required value="'+esc(it.nome)+'"></label>'+
   '<div class="grid2"><label class="f">Preço (R$)<input name="preco" type="number" inputmode="decimal" min="0" step="0.01" required value="'+esc(it.preco)+'"></label>'+
   '<label class="f">Situação<select name="status">'+opt(ITEM_ST,it.status)+'</select></label></div>'+
   '<label class="f">Descrição<textarea name="desc">'+esc(it.desc)+'</textarea></label>'+
   '<div class="btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button>'+
   (isNew?'':'<button class="btn danger" type="button" data-act="askDel" data-kind="item" data-id="'+it.id+'">Excluir</button>')+'</div>',
   function(fd){
     var data={nome:fd.get('nome').trim(),preco:Number(fd.get('preco'))||0,status:fd.get('status'),desc:fd.get('desc').trim()};
     if(!data.nome)return;
     if(isNew){data.id=uid();S.items.unshift(data)}else{Object.keys(data).forEach(function(k){it[k]=data[k]});delete it.ex}
     save();closeSheet();render(true);
   });
}

/* ---------- Configurações ---------- */
function configSheet(){
  form.className='config';
  openSheet('<h3>Configurações</h3>'+
   '<label class="f">Nome de quem atende<input name="atendente" required value="'+esc(ATENDENTE)+'"></label>'+
   '<label class="f">Taxa padrão do simulador (% ao mês)<input name="taxa_padrao" type="number" inputmode="decimal" min="0" step="0.1" value="'+esc(TAXA_PADRAO)+'"></label>'+
   '<label class="f">Endereço do servidor (motor de atendimento)<input name="servidor_url" type="url" placeholder="http://192.168.0.10:3000" value="'+esc(SERVIDOR_URL)+'"></label>'+
   '<label class="f">Token da API do servidor (APP_API_TOKEN)<input name="app_api_token" type="text" autocomplete="off" value="'+esc(APP_API_TOKEN)+'"></label>'+
   '<p class="note" style="margin:0">Endereço e token ligam este app ao motor de atendimento por IA no WhatsApp (aba Conversas e modo copiloto). Pode deixar em branco até a Fase 2 estar rodando no Termux.</p>'+
   '<div class="btns">'+
   '<button class="btn" type="button" data-act="parearWhatsAppSheet">Parear WhatsApp</button>'+
   '</div>'+
   '<div class="btns"><button class="btn primary" type="submit">Salvar</button><button class="btn" type="button" data-act="close">Cancelar</button></div>',
   async function(fd){
     ATENDENTE=fd.get('atendente').trim()||'Simone';
     TAXA_PADRAO=Number(fd.get('taxa_padrao'))||0;
     SERVIDOR_URL=fd.get('servidor_url').trim();
     APP_API_TOKEN=fd.get('app_api_token').trim();
     try{
       await window.EnvioCredStorage.saveSettings({atendente:ATENDENTE,taxa_padrao:TAXA_PADRAO,servidor_url:SERVIDOR_URL,app_api_token:APP_API_TOKEN});
     }catch(e){storageOk=false;console.error('Falha ao salvar configurações',e)}
     form.className='';closeSheet();render(true);
   });
}

/* ---------- Chaves de IA (Groq, SearchApi) ----------
 * Ficam guardadas num cofre criptografado dentro do próprio celular
 * (Android Keystore, via SecureVaultPlugin). Moradia fixa no topo da
 * tela principal, fora do sistema de "janela flutuante" (sheet) -- em
 * alguns aparelhos essa janela trava a tela inteira, então as chaves
 * (a parte mais importante de configurar) não podem depender dela.
 * Depois de guardadas no cofre, o app também tenta enviá-las pro
 * servidor (pra IA poder usá-las de fato); se o servidor não estiver
 * acessível nesse momento, não tem problema -- a chave já está salva
 * com segurança aqui e o app tenta sincronizar de novo sozinho no
 * próximo boot.
 */
function mostrarCamposChaves(mostrar){
  var campos=document.getElementById('chaves_campos');
  var botao=document.getElementById('chaves_toggle_btn');
  if(campos)campos.hidden=!mostrar;
  if(botao)botao.textContent=mostrar?'Esconder':'Editar';
}
function toggleChavesTopo(){
  var campos=document.getElementById('chaves_campos');
  mostrarCamposChaves(campos?campos.hidden:true);
}
async function carregarChavesTopo(){
  var m=document.getElementById('chaves_topo_msg');
  try{
    var groqSalva=await window.EnvioCredCofre.obter('groq_api_key');
    var researchSalva=await window.EnvioCredCofre.obter('research_api_key');
    var campoGroq=document.getElementById('chaves_groq');
    var campoResearch=document.getElementById('chaves_research');
    if(campoGroq&&groqSalva)campoGroq.value=groqSalva;
    if(campoResearch&&researchSalva)campoResearch.value=researchSalva;
    if(m)m.textContent='Neste celular -- Groq: '+(groqSalva?'guardada ✓':'ainda não guardada')+' · SearchApi: '+(researchSalva?'guardada ✓':'ainda não guardada');
    // Já tem as duas guardadas: esconde os campos pra não ocupar a tela toda.
    // Falta alguma: deixa aberto, é provavelmente a primeira configuração.
    mostrarCamposChaves(!(groqSalva&&researchSalva));
  }catch(e){
    if(m)m.textContent='Não consegui ler o cofre: '+e.message;
  }
}
async function salvarChavesTopo(){
  var m=document.getElementById('chaves_topo_msg');
  var groq=(document.getElementById('chaves_groq').value||'').trim();
  var research=(document.getElementById('chaves_research').value||'').trim();
  try{
    if(groq)await window.EnvioCredCofre.salvar('groq_api_key',groq);
    if(research)await window.EnvioCredCofre.salvar('research_api_key',research);
    if(m)m.textContent='Guardado neste celular ✓. Tentando enviar ao servidor...';
  }catch(e){
    if(m)m.textContent='Não consegui guardar no cofre deste celular: '+e.message;
    return;
  }
  try{
    await sincronizarChavesComServidor();
    if(m)m.textContent='Guardado neste celular ✓ e enviado ao servidor ✓.';
  }catch(e){
    if(m)m.textContent='Guardado neste celular ✓ (não consegui enviar ao servidor agora -- tentará de novo sozinho).';
  }
  mostrarCamposChaves(false);
}
// Tenta mandar pro servidor as chaves que já estão no cofre deste celular.
// É "melhor esforço": se o servidor não estiver acessível agora, não tem
// problema -- a chave continua guardada com segurança aqui e a sincronização
// é tentada de novo sozinha no próximo boot do app.
async function sincronizarChavesComServidor(){
  if(!SERVIDOR_URL)throw new Error('endereço do servidor não configurado');
  var groq=await window.EnvioCredCofre.obter('groq_api_key');
  var research=await window.EnvioCredCofre.obter('research_api_key');
  if(!groq&&!research)return;
  await window.EnvioCredApi.salvarChavesDeIa(SERVIDOR_URL,APP_API_TOKEN,groq||undefined,research||undefined);
}

/* ---------- Parear WhatsApp (código de 8 dígitos) ---------- */
function parearWhatsAppSheet(){
  form.className='';
  if(!SERVIDOR_URL){
    openSheet('<h3>Parear WhatsApp</h3><p class="note" style="margin:0">Configure primeiro o endereço do servidor (campo acima) e salve, depois volte aqui.</p>'+
     '<div class="btns"><button class="btn" type="button" data-act="close">Fechar</button></div>',function(){});
    return;
  }
  openSheet('<h3>Parear WhatsApp</h3>'+
   '<p class="note" id="parear_msg" style="margin:0">Consultando status...</p>'+
   '<div id="parear_resultado"></div>'+
   '<div class="btns"><button class="btn primary" type="button" data-act="gerarCodigoPareamento">Gerar código</button><button class="btn" type="button" data-act="close">Fechar</button></div>',
   function(){});
  atualizarStatusWhatsApp();
}
async function atualizarStatusWhatsApp(){
  var m=document.getElementById('parear_msg');
  if(!m)return;
  try{
    var s=await window.EnvioCredApi.statusWhatsApp(SERVIDOR_URL,APP_API_TOKEN);
    var textos={conectado:'Conectado ✓',pareando:'Aguardando pareamento -- toque em "Gerar código"',desconectado:'Desconectado'};
    m.textContent='Status: '+(textos[s.status]||s.status);
  }catch(e){m.textContent='Não consegui falar com o servidor: '+e.message}
}
async function gerarCodigoPareamento(){
  var r=document.getElementById('parear_resultado');
  if(!r)return;
  r.innerHTML='<p class="note">Gerando código...</p>';
  try{
    var resp=await window.EnvioCredApi.parearWhatsApp(SERVIDOR_URL,APP_API_TOKEN);
    r.innerHTML='<div class="result"><span style="font-size:13px;opacity:.9">Código de pareamento</span>'+
     '<span class="big" style="font-size:26px">'+esc(resp.codigo)+'</span></div>'+
     '<p class="note" style="margin-top:8px">No celular: WhatsApp Business &gt; Configurações &gt; Aparelhos conectados &gt; Conectar um aparelho &gt; Conectar com número de telefone. Digite esse código.</p>';
  }catch(e){
    r.innerHTML='<p class="note">Não consegui gerar o código: '+esc(e.message)+'</p>';
  }
}

/* ---------- Backup ---------- */
function backupSheet(){
  form.className='backup';
  openSheet('<h3>Backup dos dados</h3><p class="note" style="margin:0">Seus dados ficam guardados neste aparelho. Gere um arquivo de backup de verdade (recomendado) ou use o texto abaixo para copiar/colar.</p>'+
   '<div class="btns"><button class="btn primary" type="button" data-act="exportFile">Gerar arquivo de backup</button>'+
   '<button class="btn" type="button" data-act="importFile">Importar arquivo de backup</button></div>'+
   '<input type="file" id="bkfile" accept="application/json,.json" hidden>'+
   '<label class="f">Ou copie/cole o texto<textarea class="mono" id="bk" name="bk" spellcheck="false">'+esc(JSON.stringify(S))+'</textarea></label>'+
   '<div class="btns"><button class="btn" type="button" data-act="copyBk">Copiar texto</button><button class="btn primary" type="submit">Restaurar do texto</button><button class="btn" type="button" data-act="close">Fechar</button></div><p class="note" id="bkmsg" style="margin:0"></p>',
   async function(fd){
     var m=document.getElementById('bkmsg');
     try{
       var d=JSON.parse(fd.get('bk'));
       if(!d||!Array.isArray(d.clients)||!Array.isArray(d.items))throw 0;
       d.sim=d.sim||S.sim;S=d;save();closeSheet();render();
     }catch(e){m.textContent='Esse texto não é um backup válido. Cole o conteúdo completo que você copiou.'}
   });
}
function copyText(t,done,fail){
  try{navigator.clipboard.writeText(t).then(done,fail)}catch(e){fail()}
}
async function exportBackupFile(){
  var m=document.getElementById('bkmsg');
  try{
    var Filesystem=window.Capacitor.Plugins.Filesystem;
    var Share=window.Capacitor.Plugins.Share;
    var nomeArq='enviocred-backup-'+new Date().toISOString().slice(0,10)+'.json';
    var conteudo=JSON.stringify(S,null,2);
    var res=await Filesystem.writeFile({path:nomeArq,data:conteudo,directory:'CACHE',encoding:'utf8'});
    await Share.share({title:'Backup ENVIO CRED',text:'Backup dos dados do ENVIO CRED',url:res.uri,dialogTitle:'Guardar backup'});
    if(m)m.textContent='Arquivo gerado. Escolha onde guardar (Drive, e-mail, WhatsApp...).';
  }catch(e){
    console.error(e);
    if(m)m.textContent='Não consegui gerar o arquivo. Use o texto abaixo como alternativa.';
  }
}
function importBackupFile(){
  var input=document.getElementById('bkfile');
  if(!input)return;
  input.value='';
  input.click();
}
function handleBackupFileChosen(file){
  var m=document.getElementById('bkmsg');
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var d=JSON.parse(String(reader.result));
      if(!d||!Array.isArray(d.clients)||!Array.isArray(d.items))throw 0;
      d.sim=d.sim||S.sim;S=d;save();closeSheet();render();
    }catch(e){if(m)m.textContent='Esse arquivo não é um backup válido do ENVIO CRED.'}
  };
  reader.onerror=function(){if(m)m.textContent='Não consegui ler esse arquivo.'};
  reader.readAsText(file);
}

/* ---------- Conversas (Fase 2) ---------- */
function responderConversaSheet(telefone){
  form.className='';
  openSheet('<h3>Responder '+esc(telefone)+'</h3>'+
   '<label class="f">Mensagem<textarea name="texto" required autofocus></textarea></label>'+
   '<div class="btns"><button class="btn primary" type="submit">Enviar pelo servidor</button><button class="btn" type="button" data-act="close">Cancelar</button></div>'+
   '<p class="note" id="conv_msg" style="margin:0"></p>',
   async function(fd){
     var texto=fd.get('texto').trim();
     if(!texto)return;
     var m=document.getElementById('conv_msg');
     try{
       await window.EnvioCredApi.responderConversa(SERVIDOR_URL,APP_API_TOKEN,telefone,texto);
       closeSheet();carregarConversas();
     }catch(e){if(m)m.textContent='Não consegui enviar: '+e.message}
   });
}
async function alternarPausaIa(){
  try{
    if(iaPausada)await window.EnvioCredApi.retomarIa(SERVIDOR_URL,APP_API_TOKEN);
    else await window.EnvioCredApi.pausarIa(SERVIDOR_URL,APP_API_TOKEN);
    iaPausada=!iaPausada;
    render(true);
  }catch(e){console.error('Falha ao pausar/retomar IA',e);alert('Não consegui falar com o servidor: '+e.message)}
}

/* ---------- Modo copiloto: compartilhar mensagem -> sugestão da IA ---------- */
function copilotoSheet(textoCompartilhado){
  form.className='';
  openSheet('<h3>Sugestão da IA</h3>'+
   '<label class="f">Mensagem do cliente (compartilhada)<textarea name="mensagem_cliente" required>'+esc(textoCompartilhado)+'</textarea></label>'+
   '<label class="f">Telefone do cliente (opcional, com DDD)<input name="telefone" type="tel" placeholder="(83) 90000-0000"></label>'+
   '<div class="btns"><button class="btn primary" type="submit">Gerar sugestão</button><button class="btn" type="button" data-act="close">Cancelar</button></div>'+
   '<div id="copiloto_resultado"></div>',
   async function(fd){
     var mensagem=fd.get('mensagem_cliente').trim();
     var telInput=fd.get('telefone').trim();
     var resultadoEl=document.getElementById('copiloto_resultado');
     if(!mensagem)return;
     resultadoEl.innerHTML='<p class="note">Pensando...</p>';
     try{
       var telefoneNormalizado=telInput?waNumber(telInput):'';
       var resp=await window.EnvioCredApi.sugestaoCopiloto(SERVIDOR_URL,APP_API_TOKEN,telefoneNormalizado,mensagem);
       var sugestao=resp.sugestao||'';
       resultadoEl.innerHTML='<label class="f">Sugestão<textarea class="mono" id="copiloto_sugestao" readonly>'+esc(sugestao)+'</textarea></label>'+
        '<div class="btns" style="margin-top:8px"><button class="btn" type="button" data-act="copiarSugestaoCopiloto">Copiar</button>'+
        (telefoneNormalizado?'<a class="btn primary" target="_blank" rel="noopener" href="'+esc(waLink(telInput,sugestao))+'" data-wa="1">Abrir no WhatsApp Business</a>':'')+
        '</div>';
     }catch(e){
       resultadoEl.innerHTML='<p class="note">Não consegui gerar a sugestão: '+esc(e.message)+'</p>';
     }
   });
}
document.addEventListener('enviocred:textoCompartilhado',function(e){
  copilotoSheet(e.detail.texto||'');
});

/* ---------- WhatsApp Business: abrir fora do app, Business primeiro ---------- */
function openWhatsApp(e){
  var a=e.target.closest('[data-wa]');
  if(!a)return;
  e.preventDefault();
  var href=a.getAttribute('href');
  if(window.EnvioCredWhatsApp&&window.EnvioCredWhatsApp.open){
    window.EnvioCredWhatsApp.open(href);
  }else{
    window.open(href,'_system');
  }
}

/* ---------- Proteção contra tela travada em branco ---------- */
function mostrarErroFatal(origem,erro){
  console.error('Erro em '+origem,erro);
  try{
    var msg=(erro&&(erro.message||String(erro)))||'erro desconhecido';
    sheet.hidden=false;
    form.className='';
    form.innerHTML='<h3>Deu um problema</h3>'+
     '<p class="note" style="margin:0">Aconteceu um erro em "'+esc(origem)+'": '+esc(msg)+'</p>'+
     '<p class="note" style="margin:0">Tira um print desta tela e manda, assim dá pra corrigir certo.</p>'+
     '<div class="btns"><button class="btn primary" type="button" data-act="close">Fechar</button></div>';
  }catch(e2){ /* se nem isso funcionar, não tem mais o que fazer aqui */ }
}
window.addEventListener('error',function(e){mostrarErroFatal('app (erro geral)',e.error||e.message)});
window.addEventListener('unhandledrejection',function(e){mostrarErroFatal('app (promessa)',e.reason)});

/* ---------- Events ---------- */
document.addEventListener('click',function(e){
 try{
  if(e.target.closest('[data-wa]')){openWhatsApp(e);return}
  var tb=e.target.closest('[data-tab]');
  if(tb){ui.tab=tb.getAttribute('data-tab');render();$main.scrollTop=0;return}
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.getAttribute('data-act'),id=t.getAttribute('data-id');
  if(act==='close'){form.className='';closeSheet()}
  else if(act==='backup')backupSheet();
  else if(act==='config')configSheet();
  else if(act==='salvarChavesTopo')salvarChavesTopo();
  else if(act==='toggleChavesTopo')toggleChavesTopo();
  else if(act==='newClient')clientForm();
  else if(act==='editClient')clientForm(clientById(id));
  else if(act==='newItem')itemForm();
  else if(act==='editItem')itemForm(S.items.filter(function(i){return i.id===id})[0]);
  else if(act==='advance'){var c=clientById(id);var n=nextStage(c.etapa);if(n){c.etapa=n;delete c.ex;save();render(true)}}
  else if(act==='filter'){ui.filter=t.getAttribute('data-v');render(true)}
  else if(act==='goStage'){ui.filter=t.getAttribute('data-v');ui.tab='clientes';render();$main.scrollTop=0}
  else if(act==='clearEx'){S.clients=S.clients.filter(function(c){return !c.ex});S.items=S.items.filter(function(c){return !c.ex});S.sim.clientId='';save();render(true)}
  else if(act==='askDel'){
    t.textContent='Confirmar exclusão';t.setAttribute('data-act','doDel');
  }
  else if(act==='doDel'){
    var kind=t.getAttribute('data-kind');
    if(kind==='client'){S.clients=S.clients.filter(function(c){return c.id!==id});if(S.sim.clientId===id)S.sim.clientId=''}
    else S.items=S.items.filter(function(c){return c.id!==id});
    save();closeSheet();render(true);
  }
  else if(act==='copySim'){
    var cli=clientById(S.sim.clientId);
    var msg=document.getElementById('s_msg');
    copyText(simText(S.sim,cli?cli.nome.split(' ')[0]:''),function(){msg.textContent='Mensagem copiada.'},function(){msg.textContent='Não foi possível copiar. Use o botão do WhatsApp.'});
  }
  else if(act==='saveSim'){
    var cl=clientById(S.sim.clientId),m=document.getElementById('s_msg');
    if(!cl){m.textContent='Escolha um cliente no topo para salvar a simulação nele.';return}
    cl.valor=calc(S.sim).P;cl.tipo='emprestimo';
    cl.obs=(cl.obs?cl.obs+'\n':'')+'Simulação: '+calc(S.sim).n+'x de '+money(calc(S.sim).parcela)+' ('+String(S.sim.taxa).replace('.',',')+'% a.m.)';
    if(cl.etapa==='novo')cl.etapa='simulacao';
    delete cl.ex;save();m.textContent='Simulação salva em '+cl.nome+'.';
  }
  else if(act==='copyBk'){
    var ta=document.getElementById('bk'),bm=document.getElementById('bkmsg');
    copyText(ta.value,function(){bm.textContent='Backup copiado.'},function(){ta.focus();ta.select();bm.textContent='Selecione e copie o texto manualmente.'});
  }
  else if(act==='exportFile'){exportBackupFile()}
  else if(act==='importFile'){importBackupFile()}
  else if(act==='assumirConversa'){
    window.EnvioCredApi.assumirConversa(SERVIDOR_URL,APP_API_TOKEN,t.getAttribute('data-tel')).then(carregarConversas).catch(function(e){alert('Falha: '+e.message)});
  }
  else if(act==='devolverConversa'){
    window.EnvioCredApi.devolverParaIa(SERVIDOR_URL,APP_API_TOKEN,t.getAttribute('data-tel')).then(carregarConversas).catch(function(e){alert('Falha: '+e.message)});
  }
  else if(act==='responderConversa'){responderConversaSheet(t.getAttribute('data-tel'))}
  else if(act==='alternarPausaIa'){alternarPausaIa()}
  else if(act==='chavesIaSheet'){chavesIaSheet()}
  else if(act==='parearWhatsAppSheet'){parearWhatsAppSheet()}
  else if(act==='gerarCodigoPareamento'){gerarCodigoPareamento()}
  else if(act==='copiarSugestaoCopiloto'){
    var ta=document.getElementById('copiloto_sugestao');
    if(ta)copyText(ta.value,function(){},function(){});
  }
 }catch(erro){mostrarErroFatal('clique em "'+(t&&t.getAttribute&&t.getAttribute('data-act')||'?')+'"',erro)}
});
document.addEventListener('change',function(e){
  if(e.target.id==='s_cli'){S.sim.clientId=e.target.value;save();updateSim()}
  if(e.target.id==='bkfile'&&e.target.files&&e.target.files[0]){handleBackupFileChosen(e.target.files[0])}
});
document.addEventListener('input',function(e){
  var id=e.target.id;
  if(id==='q'){ui.q=e.target.value;var keep=e.target.selectionStart;render(true);var q=document.getElementById('q');q.focus();try{q.setSelectionRange(keep,keep)}catch(x){}return}
  if(id==='s_valor'){S.sim.valor=e.target.value;save();updateSim()}
  else if(id==='s_n'){S.sim.n=e.target.value;save();updateSim()}
  else if(id==='s_taxa'){S.sim.taxa=e.target.value;save();updateSim()}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden){form.className='';closeSheet()}});

/* ---------- Boot ---------- */
async function boot(){
  try{
    var loaded=await window.EnvioCredStorage.load();
    var settings=await window.EnvioCredStorage.getSettings();
    ATENDENTE=settings.atendente||'Simone';
    TAXA_PADRAO=Number(settings.taxa_padrao)||5;
    SERVIDOR_URL=settings.servidor_url||'';
    APP_API_TOKEN=settings.app_api_token||'';
    if(loaded){
      S=loaded;
    }else{
      // Primeira abertura: sem nada salvo ainda. Começa com os exemplos
      // (igual o protótipo), já usando a taxa padrão configurada.
      S=seed();
      S.sim.taxa=TAXA_PADRAO;
      save();
    }
  }catch(e){
    console.error('Falha ao carregar dados salvos, usando exemplos como fallback',e);
    storageOk=false;
    S=seed();
  }
  render();
  carregarChavesTopo();
  sincronizarChavesComServidor().catch(function(e){console.error('Sincronização de chaves adiada',e)});
}
boot();
})();
