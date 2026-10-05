/**
 * Camada isolada do WhatsApp. Tudo que fala com o WhatsApp de verdade passa
 * por aqui -- o resto do servidor (IA, API, regras) nunca importa Baileys
 * diretamente. Isso é de propósito: permite trocar pela API oficial da Meta
 * no futuro sem reescrever o resto (ver ordem de serviço, seção 3.2).
 */
export type StatusConexao = 'desconectado' | 'pareando' | 'conectado';

export interface WhatsAppGateway {
  iniciar(): Promise<void>;

  /** Pede um código de pareamento de 8 dígitos pro número configurado. */
  obterCodigoPareamento(): Promise<string>;

  enviarTexto(telefone: string, texto: string): Promise<void>;
  marcarDigitando(telefone: string): Promise<void>;

  aoReceberMensagem(handler: (telefone: string, texto: string) => void | Promise<void>): void;
  aoMudarStatus(handler: (status: StatusConexao) => void): void;

  statusAtual(): StatusConexao;
}
