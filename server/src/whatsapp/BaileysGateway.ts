import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import type { WhatsAppGateway, StatusConexao } from './WhatsAppGateway.js';
import { logger } from '../logging/logger.js';

/**
 * Implementação com Baileys (@whiskeysockets/baileys, versão estável 6.7.24
 * -- não a 7.x release-candidate). Conecta como "aparelho conectado", igual
 * o WhatsApp Web, usando código de pareamento de 8 dígitos em vez de QR
 * (decisão do Márcio).
 *
 * AVISO IMPORTANTE (ver README.md): isso não é a API oficial da Meta. Vai
 * contra os termos de uso do WhatsApp e o número pode ser bloqueado. As
 * proteções de server/src/safety/antiSpam.ts existem justamente por causa
 * disso. Use por sua conta e risco, sabendo do risco.
 */
export class BaileysGateway implements WhatsAppGateway {
  private sock: WASocket | null = null;
  private status: StatusConexao = 'desconectado';
  private handlersMensagem: Array<(telefone: string, texto: string) => void | Promise<void>> = [];
  private handlersStatus: Array<(status: StatusConexao) => void> = [];
  private resolvePareamento: ((codigo: string) => void) | null = null;

  constructor(
    private readonly sessionDir: string,
    private readonly phoneNumber: string
  ) {}

  statusAtual(): StatusConexao {
    return this.status;
  }

  aoReceberMensagem(handler: (telefone: string, texto: string) => void | Promise<void>): void {
    this.handlersMensagem.push(handler);
  }

  aoMudarStatus(handler: (status: StatusConexao) => void): void {
    this.handlersStatus.push(handler);
  }

  private mudarStatus(status: StatusConexao) {
    this.status = status;
    for (const h of this.handlersStatus) h(status);
  }

  async iniciar(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('ENVIO CRED'),
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const codigoSaida = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const deveReconectar = codigoSaida !== DisconnectReason.loggedOut;
        logger.warn({ codigoSaida, deveReconectar }, 'WhatsApp: conexão caiu');
        this.mudarStatus('desconectado');
        if (deveReconectar) {
          setTimeout(() => this.iniciar().catch((e) => logger.error(e, 'Falha ao reconectar')), 3000);
        } else {
          logger.warn('WhatsApp: sessão encerrada (logout) -- precisa parear de novo.');
        }
      } else if (connection === 'open') {
        logger.info('WhatsApp: conectado');
        this.mudarStatus('conectado');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;
        const texto =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';
        if (!texto) continue;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us')) continue; // ignora grupos
        const telefone = jid.replace(/@s\.whatsapp\.net$/, '');
        for (const handler of this.handlersMensagem) {
          try {
            await handler(telefone, texto);
          } catch (e) {
            logger.error(e, 'Erro processando mensagem recebida');
          }
        }
      }
    });

    // Se ainda não está pareado, fica pronto pra obterCodigoPareamento() ser
    // chamado (pela rota /api/parear) e mostrar o código pra Simone digitar.
    if (!sock.authState.creds.registered) {
      this.mudarStatus('pareando');
    }
  }

  async obterCodigoPareamento(): Promise<string> {
    if (!this.sock) throw new Error('WhatsApp ainda não iniciado');
    if (this.sock.authState.creds.registered) {
      throw new Error('Este número já está pareado. Desconecte antes de parear de novo.');
    }
    try {
      const codigo = await this.sock.requestPairingCode(this.phoneNumber);
      logger.info({ codigo }, 'Código de pareamento gerado');
      return codigo;
    } catch (e: any) {
      // Baileys às vezes rejeita com um objeto sem .message (ex: erro de
      // conexão ainda não pronta) -- nunca deixa isso virar uma mensagem
      // vazia pro app, sempre dá algo pra Simone/Márcio lerem ou me
      // mandarem de volta.
      const detalhe = (e && (e.message || e.toString())) || JSON.stringify(e);
      throw new Error(
        `Não consegui pedir o código ao WhatsApp (${detalhe}). Se o servidor acabou de ligar, espere alguns segundos e tente de novo.`
      );
    }
  }

  async marcarDigitando(telefone: string): Promise<void> {
    if (!this.sock) return;
    const jid = `${telefone}@s.whatsapp.net`;
    await this.sock.sendPresenceUpdate('composing', jid);
  }

  async enviarTexto(telefone: string, texto: string): Promise<void> {
    if (!this.sock) throw new Error('WhatsApp ainda não iniciado');
    const jid = `${telefone}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text: texto });
  }
}
