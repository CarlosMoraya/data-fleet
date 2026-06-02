import { test } from '@playwright/test';

test.describe.skip('Operations Manager readonly scope', () => {
  test('manual validation guide', async () => {
    test.info().annotations.push({
      type: 'manual',
      description: [
        '1. Login como Coordinator ou Manager.',
        '2. Criar usuario Operations Manager com 2 embarcadores e 2 bases.',
        '3. Fazer logout e login com o novo usuario.',
        '4. Confirmar sidebar apenas com Agendamentos e Manutencao.',
        '5. Acessar /, /cadastros/usuarios, /checklists e /settings e validar redirect para /agendamentos.',
        '6. Em Agendamentos, validar listagem somente leitura e sem botoes de criar/editar/excluir/gerar OS.',
        '7. Em Manutencao, validar listagem somente leitura e sem botoes de criar/editar/cancelar/aprovar.',
        '8. Confirmar que apenas registros dentro do escopo aparecem.',
        '9. Editar o escopo via Coordinator ou Manager e confirmar mudanca apos refresh.',
      ].join(' '),
    });
  });
});
