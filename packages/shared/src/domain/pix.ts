/**
 * Geração do BR Code (Pix copia-e-cola), padrão EMV do Banco Central.
 *
 * Existe aqui, e não só no gateway, porque a loja pode receber direto na
 * própria chave Pix — que é como a maioria opera no interior, sem
 * intermediário e sem tarifa. Quando há gateway, ele devolve o código dele e
 * esta função não é usada.
 *
 * O formato é TLV: cada campo é ID (2) + tamanho (2) + valor. O CRC no fim é
 * o que os bancos conferem para recusar código adulterado.
 */

/** Monta um campo no formato ID + tamanho + valor. */
function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`;
}

/**
 * Remove acento e caractere fora do ASCII imprimível.
 *
 * O padrão do BC só aceita ASCII; um "ç" no nome do recebedor faz o app do
 * banco recusar o código inteiro.
 */
function somenteAscii(texto: string, tamanhoMaximo: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, tamanhoMaximo);
}

/**
 * CRC-16/CCITT-FALSE, exigido pelo padrão.
 *
 * Calculado sobre a string inteira já com "6304" no fim — é assim que o
 * validador do banco recalcula para conferir.
 */
export function crc16(payload: string): string {
  let resultado = 0xffff;

  for (let indice = 0; indice < payload.length; indice += 1) {
    resultado ^= payload.charCodeAt(indice) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      resultado =
        resultado & 0x8000 ? ((resultado << 1) ^ 0x1021) & 0xffff : (resultado << 1) & 0xffff;
    }
  }

  return resultado.toString(16).toUpperCase().padStart(4, '0');
}

export interface BrCodeInput {
  /// Chave Pix do recebedor (telefone, CPF/CNPJ, e-mail ou aleatória).
  pixKey: string;
  amountCents: number;
  merchantName: string;
  merchantCity: string;
  /// Identificador do pagamento; volta no extrato e liga o Pix ao pedido.
  txid?: string;
  description?: string;
}

export function buildPixBrCode({
  pixKey,
  amountCents,
  merchantName,
  merchantCity,
  txid,
  description,
}: BrCodeInput): string {
  const merchantAccount =
    campo('00', 'br.gov.bcb.pix') +
    campo('01', pixKey) +
    (description ? campo('02', somenteAscii(description, 72)) : '');

  // O txid aceita apenas alfanumérico; "***" é o valor neutro do padrão.
  const referencia = txid ? txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) : '***';

  const payload =
    campo('00', '01') +
    // 12 = Pix dinâmico de uso único; aqui é estático com valor definido.
    campo('26', merchantAccount) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', (amountCents / 100).toFixed(2)) +
    campo('58', 'BR') +
    campo('59', somenteAscii(merchantName, 25)) +
    campo('60', somenteAscii(merchantCity, 15)) +
    campo('62', campo('05', referencia)) +
    // O CRC entra por último, calculado sobre tudo isto mais "6304".
    '6304';

  return payload + crc16(payload);
}
