import { describe, expect, it } from 'vitest';

import { messageForOcrStatus } from './geminiProvider';

describe('messageForOcrStatus', () => {
  it('traduz 413 para a mensagem de arquivo grande', () => {
    expect(messageForOcrStatus(413)).toMatch(/10MB/);
  });

  it('traduz 415 para a mensagem de formato não suportado', () => {
    expect(messageForOcrStatus(415)).toMatch(/Formato não suportado/i);
  });

  it('traduz 429 para a mensagem de limite atingido, sugerindo preenchimento manual', () => {
    const message = messageForOcrStatus(429);

    expect(message).toMatch(/limite/i);
    expect(message).toMatch(/manual/i);
  });

  it('traduz 401 e 502 sem expor detalhes internos', () => {
    expect(messageForOcrStatus(401)).toMatch(/login/i);
    expect(messageForOcrStatus(502)).toMatch(/indisponível/i);
  });

  it('usa a mensagem do backend apenas em status genéricos', () => {
    expect(messageForOcrStatus(500, 'Erro inesperado ao processar o documento.')).toBe(
      'Erro inesperado ao processar o documento.',
    );
    expect(messageForOcrStatus(500)).toMatch(/manualmente/i);
  });

  it('não repassa token nem conteúdo do documento vindos do backend em status conhecidos', () => {
    const leaky = 'Bearer eyJhbGciOi... conteudo=%PDF-1.7 dados do CRLV';

    for (const status of [401, 413, 415, 429, 502]) {
      const message = messageForOcrStatus(status, leaky);

      expect(message).not.toContain('Bearer');
      expect(message).not.toContain('%PDF');
      expect(message).not.toContain('eyJhbGciOi');
    }
  });
});
