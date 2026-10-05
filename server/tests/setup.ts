// Variáveis de ambiente fictícias só pra config.ts não reclamar durante os
// testes -- nenhuma chamada de rede de verdade é feita nos testes
// automatizados (Groq/SearchApi/WhatsApp são todos mockados ou simplesmente
// não exercitados aqui).
process.env.GROQ_API_KEY = 'teste-fake-key';
process.env.APP_API_TOKEN = 'teste-fake-token';
process.env.WHATSAPP_PHONE_NUMBER = '5500000000000';
process.env.DATABASE_PATH = './dados/teste.sqlite';
process.env.RESEARCH_API_KEY = 'teste-fake-key';
