/*
 * Cliente HTTP simples pro servidor da Fase 2 (motor de atendimento).
 * Usa o endereço e o token salvos em Configurações.
 */
(function (global) {
  'use strict';

  function baseUrl(servidorUrl) {
    return String(servidorUrl || '').replace(/\/+$/, '');
  }

  async function chamar(servidorUrl, token, caminho, opcoes) {
    opcoes = opcoes || {};
    if (!servidorUrl) throw new Error('Endereço do servidor não configurado (ver Configurações).');
    var resposta = await fetch(baseUrl(servidorUrl) + caminho, {
      method: opcoes.method || 'GET',
      headers: Object.assign(
        { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
        opcoes.headers || {}
      ),
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });
    var dados = null;
    try { dados = await resposta.json(); } catch (e) { /* resposta sem corpo */ }
    if (!resposta.ok) {
      var msg = (dados && dados.erro) || ('o servidor respondeu ' + resposta.status);
      throw new Error(msg);
    }
    return dados;
  }

  global.EnvioCredApi = {
    listarConversas: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/conversas');
    },
    listarMensagens: function (servidorUrl, token, telefone) {
      return chamar(servidorUrl, token, '/api/conversas/' + encodeURIComponent(telefone) + '/mensagens');
    },
    assumirConversa: function (servidorUrl, token, telefone) {
      return chamar(servidorUrl, token, '/api/conversas/' + encodeURIComponent(telefone) + '/assumir', { method: 'POST' });
    },
    devolverParaIa: function (servidorUrl, token, telefone) {
      return chamar(servidorUrl, token, '/api/conversas/' + encodeURIComponent(telefone) + '/devolver', { method: 'POST' });
    },
    responderConversa: function (servidorUrl, token, telefone, texto) {
      return chamar(servidorUrl, token, '/api/conversas/' + encodeURIComponent(telefone) + '/responder', {
        method: 'POST',
        body: { texto: texto }
      });
    },
    pausarIa: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/ia/pausar', { method: 'POST' });
    },
    retomarIa: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/ia/retomar', { method: 'POST' });
    },
    obterConfiguracoesServidor: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/configuracoes');
    },
    statusWhatsApp: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/whatsapp/status');
    },
    parearWhatsApp: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/whatsapp/parear', { method: 'POST' });
    },
    salvarChavesDeIa: function (servidorUrl, token, groqApiKey, researchApiKey) {
      return chamar(servidorUrl, token, '/api/chaves', {
        method: 'POST',
        body: { groq_api_key: groqApiKey, research_api_key: researchApiKey }
      });
    },
    statusChavesDeIa: function (servidorUrl, token) {
      return chamar(servidorUrl, token, '/api/chaves/status');
    },
    salvarObjeto: function (servidorUrl, token, objeto) {
      return chamar(servidorUrl, token, '/api/objetos', {
        method: 'POST',
        body: {
          app_item_id: objeto.id,
          nome: objeto.nome,
          preco: objeto.preco,
          status: objeto.status,
          descricao: objeto.desc || '',
          descricao_venda: objeto.descVenda || '',
          foto: objeto.foto || ''
        }
      });
    },
    gerarDescricaoVenda: function (servidorUrl, token, descricao) {
      return chamar(servidorUrl, token, '/api/objetos/gerar-descricao', {
        method: 'POST',
        body: { descricao: descricao }
      });
    },
    sugestaoCopiloto: function (servidorUrl, token, telefone, mensagemCliente) {
      return chamar(servidorUrl, token, '/api/copiloto/sugestao', {
        method: 'POST',
        body: { telefone: telefone || undefined, mensagem_cliente: mensagemCliente }
      });
    }
  };
})(window);
