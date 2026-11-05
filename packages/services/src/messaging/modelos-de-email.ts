/**
 * Modelos dos e-mails transacionais, com a identidade do Rapidinho.
 *
 * HTML de e-mail não é HTML de site: tabela no lugar de flex, estilo inline,
 * sem fonte web garantida (Bricolage e DM Sans entram só onde o cliente
 * aceita, com Arial de reserva) e degradê sempre com cor sólida por baixo,
 * porque o Outlook ignora `linear-gradient`. A logo é PNG: WebP não abre em
 * todo cliente de e-mail.
 */

const COR = {
  marca: '#FF5A1F',
  marcaEscura: '#D93F0B',
  marcaClara: '#FFEDE5',
  noite: '#1C1A2E',
  fundo: '#FFF8F2',
  texto: '#2B2838',
  textoMedio: '#6B6878',
  linha: '#F1E4DC',
};
const DEGRADE = 'linear-gradient(90deg,#FF8A1F 0%,#FF5A1F 55%,#F0361F 100%)';
const TITULO = "'Bricolage Grotesque','DM Sans',Arial,Helvetica,sans-serif";
const CORPO = "'DM Sans',Arial,Helvetica,sans-serif";

export interface EmailPronto {
  subject: string;
  html: string;
  text: string;
}

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Endereço do site, de onde a logo é servida. */
function site(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://rapidinhoentrega.com.br').replace(/\/$/, '');
}

function botao(texto: string, link: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 8px">
  <tr><td align="center" bgcolor="${COR.marca}" style="border-radius:14px;background:${COR.marca};background-image:${DEGRADE}">
    <a href="${link}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${TITULO};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px">${escaparHtml(texto)}</a>
  </td></tr>
</table>`;
}

/**
 * Esqueleto comum: faixa da marca, logo, cartão branco e rodapé escuro.
 * `previa` é o texto que o Gmail mostra ao lado do assunto na lista.
 */
export function layoutDoEmail({
  previa,
  titulo,
  conteudo,
  acao,
  observacao,
}: {
  previa: string;
  titulo: string;
  /** HTML já escapado: parágrafos do corpo. */
  conteudo: string;
  acao?: { texto: string; link: string };
  /** Linha miúda abaixo do botão (validade do link, endereço por extenso). */
  observacao?: string;
}): string {
  const ano = new Date().getFullYear();
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COR.fundo}">${escaparHtml(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background:${COR.fundo}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
    <tr><td height="6" bgcolor="${COR.marca}" style="height:6px;line-height:6px;font-size:0;border-radius:6px 6px 0 0;background:${COR.marca};background-image:${DEGRADE}">&nbsp;</td></tr>
    <tr><td align="center" bgcolor="#ffffff" style="background:#ffffff;padding:28px 24px 8px">
      <a href="${site()}" target="_blank"><img src="${site()}/marca/email-logo.png" width="180" height="125" alt="Rapidinho Entrega" style="display:block;width:180px;max-width:60%;height:auto;border:0"></a>
    </td></tr>
    <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:8px 32px 32px;font-family:${CORPO};font-size:16px;line-height:1.6;color:${COR.texto}">
      <h1 style="margin:12px 0 16px;font-family:${TITULO};font-size:26px;line-height:1.25;font-weight:800;color:${COR.noite};text-align:center">${escaparHtml(titulo)}</h1>
      ${conteudo}
      ${acao ? botao(acao.texto, acao.link) : ''}
      ${observacao ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${COR.textoMedio};text-align:center">${observacao}</p>` : ''}
    </td></tr>
    <tr><td bgcolor="${COR.noite}" style="background:${COR.noite};padding:22px 28px;border-radius:0 0 18px 18px;font-family:${CORPO};font-size:12px;line-height:1.6;color:#C9C6D6;text-align:center">
      <strong style="color:#ffffff;font-family:${TITULO};font-size:14px">Rapidinho Entrega</strong><br>
      Comida, mercado e farmácia da sua cidade.<br>
      <a href="${site()}" target="_blank" style="color:#FFB27F;text-decoration:none">rapidinhoentrega.com.br</a>
      &nbsp;·&nbsp; <a href="${site()}/privacidade" target="_blank" style="color:#FFB27F;text-decoration:none">Privacidade</a><br>
      <span style="color:#8E8AA3">Este é um e-mail automático; respostas não são lidas. © ${ano} Rapidinho Entrega</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const paragrafo = (texto: string) => `<p style="margin:0 0 14px">${texto}</p>`;
const saudacao = (nome?: string | null) => {
  const primeiro = nome?.trim().split(/\s+/)[0];
  return primeiro ? `Olá, ${escaparHtml(primeiro)}!` : 'Olá!';
};

/** Link de "esqueci minha senha" do painel. */
export function emailDeRecuperacaoDeSenha({
  nome,
  link,
}: {
  nome?: string | null;
  link: string;
}): EmailPronto {
  const subject = 'Crie sua senha nova do painel Rapidinho';
  return {
    subject,
    html: layoutDoEmail({
      previa: 'O link vale por 30 minutos e só funciona uma vez.',
      titulo: 'Vamos criar sua senha nova',
      conteudo: [
        paragrafo(saudacao(nome)),
        paragrafo(
          'Recebemos um pedido para redefinir a senha do seu acesso ao <strong>painel do Rapidinho Entrega</strong>. Toque no botão para escolher a senha nova.',
        ),
      ].join(''),
      acao: { texto: 'Criar senha nova', link },
      observacao: `O link vale por 30 minutos e só funciona uma vez. Se o botão não abrir, copie este endereço:<br><a href="${link}" style="color:${COR.marcaEscura};word-break:break-all">${link}</a><br><br><strong>Não foi você?</strong> Ignore este e-mail: sua senha continua a mesma.`,
    }),
    text: [
      saudacao(nome),
      '',
      'Recebemos um pedido para redefinir a senha do seu acesso ao painel do Rapidinho Entrega.',
      'Para escolher a senha nova, abra o link abaixo. Ele vale por 30 minutos e só funciona uma vez.',
      '',
      link,
      '',
      'Não foi você? Ignore este e-mail: sua senha continua a mesma.',
      '',
      'Rapidinho Entrega',
    ].join('\n'),
  };
}

/** Aviso de segurança depois que a senha muda, por link ou pelo próprio painel. */
export function emailDeSenhaAlterada({
  nome,
  painel,
}: {
  nome?: string | null;
  painel: string;
}): EmailPronto {
  const quando = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const recuperar = `${painel.replace(/\/$/, '')}/entrar/esqueci`;
  return {
    subject: 'Sua senha do painel Rapidinho foi alterada',
    html: layoutDoEmail({
      previa: `Senha alterada em ${quando}.`,
      titulo: 'Sua senha foi alterada',
      conteudo: [
        paragrafo(saudacao(nome)),
        paragrafo(
          `A senha do seu acesso ao painel do Rapidinho Entrega foi alterada em <strong>${quando}</strong>. Por segurança, as sessões abertas em outros aparelhos foram encerradas.`,
        ),
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px"><tr><td bgcolor="${COR.marcaClara}" style="background:${COR.marcaClara};border-radius:12px;padding:14px 16px;font-size:15px;color:${COR.texto}"><strong>Não foi você?</strong> Crie uma senha nova agora e avise a equipe Rapidinho.</td></tr></table>`,
      ].join(''),
      acao: { texto: 'Criar senha nova', link: recuperar },
      observacao: 'Se foi você, não precisa fazer nada.',
    }),
    text: [
      saudacao(nome),
      '',
      `A senha do seu acesso ao painel do Rapidinho Entrega foi alterada em ${quando}.`,
      'Por segurança, as sessões abertas em outros aparelhos foram encerradas.',
      '',
      `Não foi você? Crie uma senha nova agora: ${recuperar}`,
      'Se foi você, não precisa fazer nada.',
      '',
      'Rapidinho Entrega',
    ].join('\n'),
  };
}

/** Aviso genérico das notificações (pedido, loja, campanha). */
export function emailDeNotificacao({
  titulo,
  corpo,
  link,
}: {
  titulo: string;
  corpo: string;
  link?: string | null;
}): EmailPronto {
  const linhas = corpo.split(/\n+/).filter(Boolean);
  const destino = link ? (link.startsWith('http') ? link : `${site()}${link}`) : null;
  return {
    subject: titulo,
    html: layoutDoEmail({
      previa: linhas[0] ?? titulo,
      titulo,
      conteudo: linhas.map((linha) => paragrafo(escaparHtml(linha))).join(''),
      ...(destino ? { acao: { texto: 'Ver no Rapidinho', link: destino } } : {}),
    }),
    text: [titulo, '', corpo, ...(destino ? ['', destino] : []), '', 'Rapidinho Entrega'].join(
      '\n',
    ),
  };
}
