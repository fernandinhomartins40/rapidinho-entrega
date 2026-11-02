/**
 * Contrato da API do app nativo (`/api/app/v1`).
 *
 * Só tipos, e sem nenhum `import`: o app faz `import type` deste arquivo e nada
 * de servidor (Prisma, Redis, `node:crypto`) pode vir junto no bundle dele.
 *
 * Convenções:
 * - valores em dinheiro são inteiros em centavos, com sufixo `Cents`;
 * - datas são texto ISO 8601 em UTC, com sufixo `Em` (`criadoEm`, `expiraEm`);
 * - quem escreve valor em dinheiro é sempre o servidor: nenhuma entrada aceita
 *   preço, taxa ou total. O app informa escolhas, e o servidor recalcula.
 */

// ---------------------------------------------------------------------------
// Erro e respostas simples
// ---------------------------------------------------------------------------

export type CodigoDeErro =
  | 'NAO_AUTENTICADO'
  | 'PROIBIDO'
  | 'NAO_ENCONTRADO'
  | 'DADOS_INVALIDOS'
  | 'MUITAS_TENTATIVAS'
  | 'CONFLITO'
  | 'REGRA_DE_NEGOCIO'
  | 'CODIGO_INCORRETO'
  | 'PEDIDO_DE_ACESSO_ENCERRADO'
  | 'CARRINHO_VAZIO'
  | 'LOJA_INDISPONIVEL'
  | 'LOJA_FECHADA'
  | 'PAGAMENTO_NAO_ACEITO'
  | 'ESTOQUE_INSUFICIENTE'
  | 'RECEITA_OBRIGATORIA'
  | 'MAIORIDADE_OBRIGATORIA'
  | 'TROCO_INVALIDO'
  | 'CHAVE_REUTILIZADA'
  | 'ARMAZENAMENTO_INDISPONIVEL'
  | 'ERRO_INTERNO';

/** Corpo de toda resposta de erro, com o status HTTP correspondente. */
export interface ErroDaApiDoApp {
  erro: string;
  codigo?: CodigoDeErro;
}

export interface RespostaOk {
  ok: true;
  mensagem?: string;
}

// ---------------------------------------------------------------------------
// Valores de domínio
// ---------------------------------------------------------------------------

export type Papel =
  | 'CUSTOMER'
  | 'STORE_OWNER'
  | 'STORE_STAFF'
  | 'COURIER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type Segmento = 'MARKET' | 'PHARMACY' | 'RESTAURANT' | 'OTHER';

export type StatusDoPedido =
  | 'PENDING_PAYMENT'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';

export type StatusDaEntrega =
  | 'PENDING'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUSED';

export type TipoDePedido = 'DELIVERY' | 'PICKUP';

/** Sem pagamento online: dinheiro ou cartão na entrega, ou Pix na chave da loja. */
export type FormaDePagamento = 'PIX' | 'CASH_ON_DELIVERY' | 'CARD_ON_DELIVERY';

export type StatusDoPagamento =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export type PoliticaDeSubstituicao = 'SUBSTITUTE_SIMILAR' | 'CONTACT_ME' | 'REMOVE_ITEM';

export type RegraDeReceita = 'NONE' | 'REQUIRED' | 'CONTROLLED';

export type Veiculo = 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'ON_FOOT';

// ---------------------------------------------------------------------------
// Autenticação (auth/*)
// ---------------------------------------------------------------------------

export interface Usuario {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  papel: Papel;
  /** Preenchido para quem tem cadastro de entregador, aprovado ou não. */
  entregador: { id: string; status: 'PENDING_APPROVAL' | 'ACTIVE' | 'BLOCKED' } | null;
}

export interface EntradaPedirCodigo {
  telefone: string;
}

/**
 * `codigo`: a pessoa recebe o SMS e digita (segue para `auth/entrar`).
 * `sms-reverso`: a pessoa envia o SMS pronto e o app pergunta em `auth/conferir`,
 * guardando `identificador` em memória: ele é o segredo deste pedido de acesso.
 */
export type RespostaPedirCodigo =
  | {
      modo: 'codigo';
      telefone: string;
      expiraEm: string;
      /** Só em desenvolvimento, nunca em produção. */
      codigoDev?: string;
    }
  | {
      modo: 'sms-reverso';
      telefone: string;
      expiraEm: string;
      identificador: string;
      sms: { texto: string; link: string; numero: string };
    };

export interface EntradaEntrar {
  telefone: string;
  codigo: string;
}

export interface SessaoCriada {
  /** Vai em `Authorization: Bearer <token>`. Guardar no armazenamento cifrado. */
  token: string;
  /** O prazo recomeça a cada uso: quem usa o app não precisa de outro SMS. */
  expiraEm: string;
  usuario: Usuario;
  novoUsuario: boolean;
}

export type RespostaEntrar = SessaoCriada;

export interface EntradaConferirSms {
  identificador: string;
}

export type RespostaConferirSms = { status: 'aguardando' } | ({ status: 'ok' } & SessaoCriada);

// ---------------------------------------------------------------------------
// Conta (eu)
// ---------------------------------------------------------------------------

export type RespostaEu = Usuario;

export interface EntradaAtualizarEu {
  nome: string;
}

/** Exportação LGPD: o JSON completo do titular, sem forma fixa para o app. */
export type RespostaExportarDados = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface Cidade {
  id: string;
  slug: string;
  nome: string;
  uf: string;
}

export interface RespostaCidades {
  cidades: Cidade[];
}

export interface BannerDaVitrine {
  id: string;
  titulo: string;
  imagemUrl: string;
  /** Loja vinculada; null quando ela saiu do ar ou o banner não tem loja. */
  lojaSlug: string | null;
  linkUrl: string | null;
  /** Código do cupom da campanha, só enquanto ele estiver valendo. */
  cupom: string | null;
}

export interface CategoriaDaVitrine {
  slug: string;
  nome: string;
  segmento: Segmento;
  quantidadeDeLojas: number;
}

export interface ProdutoDaVitrine {
  id: string;
  nome: string;
  precoCents: number;
  imagemUrl: string | null;
  lojaId: string;
  lojaSlug: string;
  lojaNome: string;
  categoriaSlug: string | null;
  segmento: Segmento;
  tempoMin: number;
  /** Entre os mais pedidos da cidade nesta hora do dia. */
  emAlta: boolean;
}

export interface LojaDaVitrine {
  id: string;
  slug: string;
  nome: string;
  /** Loja sem logo existe no banco: o app desenha as iniciais. */
  logoUrl: string | null;
  capaUrl: string | null;
  /** Nome da categoria; sem categoria, o rótulo do segmento. */
  categoria: string;
  categoriaSlug: string | null;
  segmento: Segmento;
  nota: number;
  avaliacoes: number;
  taxaCents: number;
  taxaGratis: boolean;
  tempoMin: number;
  tempoMax: number;
  pedidoMinimoCents: number;
  aberta: boolean;
  /** "Aberta agora", "Abre às 18:00", "Abre sexta-feira às 18:00" ou o motivo. */
  rotuloHorario: string;
  patrocinada: boolean;
  precoDeBalcao: boolean;
}

export interface Vitrine {
  cidade: Cidade;
  banners: BannerDaVitrine[];
  categorias: CategoriaDaVitrine[];
  saindoAgora: ProdutoDaVitrine[];
  lojas: LojaDaVitrine[];
}

export interface ProdutoDoCardapio {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
  /** Preço "de", riscado. */
  precoDeCents: number | null;
  /** Por peso, `precoCents` é o preço do quilo. */
  porPeso: boolean;
  disponivel: boolean;
  imagemUrl: string | null;
}

export interface SecaoDoCardapio {
  id: string;
  nome: string;
  descricao: string | null;
  produtos: ProdutoDoCardapio[];
}

export interface TamanhoDePizza {
  id: string;
  nome: string;
  descricao: string | null;
  maxSabores: number;
  fatias: number | null;
}

export interface SaborDePizza {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  /** Preço por id de tamanho. Sabor sem preço num tamanho não vale nele. */
  precos: Record<string, number>;
}

export interface ExtraDePizza {
  id: string;
  nome: string;
  tipo: 'EDGE' | 'CRUST' | 'TOPPING';
  precoCents: number;
}

export interface CardapioDePizza {
  regra: 'HIGHEST_PRICE' | 'AVERAGE_PRICE';
  tamanhos: TamanhoDePizza[];
  sabores: SaborDePizza[];
  extras: ExtraDePizza[];
}

export interface ComentarioDaLoja {
  id: string;
  nota: number;
  comentario: string;
  resposta: string | null;
  /** Só o primeiro nome. */
  autor: string;
  criadoEm: string;
}

export interface LojaDetalhada extends LojaDaVitrine {
  descricao: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string;
  aceitaRetirada: boolean;
  aceitaPix: boolean;
  aceitaDinheiro: boolean;
  aceitaCartaoNaEntrega: boolean;
  entregaGratisAcimaCents: number | null;
  /** Falso sem token: favorito é por usuário. */
  favorita: boolean;
  secoes: SecaoDoCardapio[];
  /** Null quando a loja não vende pizza montada. */
  pizza: CardapioDePizza | null;
  comentarios: ComentarioDaLoja[];
}

export interface OpcaoDeComplemento {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
}

export interface GrupoDeComplemento {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  minimo: number;
  maximo: number;
  permiteRepetir: boolean;
  opcoes: OpcaoDeComplemento[];
}

export interface ProdutoDetalhado {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
  precoDeCents: number | null;
  porPeso: boolean;
  passoGramas: number;
  minimoGramas: number;
  disponivel: boolean;
  esgotado: boolean;
  /** Estoque controlado; null quando a loja não controla. */
  estoque: number | null;
  receita: RegraDeReceita;
  maiorDeIdade: boolean;
  imagemUrl: string | null;
  loja: {
    id: string;
    nome: string;
    slug: string;
    aberta: boolean;
    motivoFechada: string | null;
  };
  grupos: GrupoDeComplemento[];
}

export interface ProdutoDaBusca {
  id: string;
  nome: string;
  precoCents: number;
  porPeso: boolean;
  lojaNome: string;
  lojaSlug: string;
}

/** Com menos de duas letras em `q`, as duas listas voltam vazias. */
export interface ResultadoDaBusca {
  lojas: LojaDaVitrine[];
  produtos: ProdutoDaBusca[];
}

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------

export interface ComplementoNoCarrinho {
  id: string;
  opcaoId: string;
  grupo: string;
  nome: string;
  quantidade: number;
  precoCents: number;
}

export interface PizzaNoCarrinho {
  tamanho: string;
  sabores: { id: string; nome: string; precoCents: number }[];
  extras: { id: string; nome: string; tipo: string; precoCents: number }[];
  extraPrecoCents: number;
}

export interface ItemDoCarrinho {
  id: string;
  produtoId: string | null;
  nome: string;
  quantidade: number;
  gramas: number | null;
  porPeso: boolean;
  observacao: string | null;
  imagemUrl: string | null;
  indisponivel: boolean;
  motivoIndisponivel: string | null;
  exigeReceita: boolean;
  maiorDeIdade: boolean;
  complementos: ComplementoNoCarrinho[];
  pizza: PizzaNoCarrinho | null;
  unitarioCents: number;
  totalCents: number;
}

export interface CarrinhoDaLoja {
  id: string;
  lojaId: string;
  loja: { nome: string; slug: string; cidadeSlug: string; pedidoMinimoCents: number };
  itens: ItemDoCarrinho[];
  observacao: string | null;
  subtotalCents: number;
  temIndisponivel: boolean;
  exigeReceita: boolean;
  exigeMaioridade: boolean;
}

/**
 * Um carrinho por loja, como no site. Adicionar item de outra loja NÃO apaga o
 * carrinho anterior: abre outro, e cada um vira um pedido separado.
 */
export interface RespostaCarrinho {
  carrinhos: CarrinhoDaLoja[];
  quantidadeDeItens: number;
}

export interface ItemParaOCarrinho {
  /** Obrigatório, exceto para pizza montada (que informa `pizzaTamanhoId`). */
  produtoId?: string;
  quantidade?: number;
  /** Produto vendido por peso. */
  gramas?: number;
  observacao?: string;
  complementos?: { opcaoId: string; quantidade?: number }[];
  pizzaTamanhoId?: string;
  /** Borda, massa e adicionais: uma borda e uma massa no máximo. */
  pizzaExtraIds?: string[];
  saborIds?: string[];
}

export interface EntradaAdicionarAoCarrinho {
  lojaId: string;
  item: ItemParaOCarrinho;
}

/** Quantidade zero remove o item. */
export interface EntradaAlterarItem {
  quantidade: number;
}

// ---------------------------------------------------------------------------
// Endereços
// ---------------------------------------------------------------------------

export interface Endereco {
  id: string;
  rotulo: string | null;
  rua: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  bairroId: string | null;
  referencia: string | null;
  cep: string | null;
  cidade: { id: string; slug: string; nome: string; uf: string };
  latitude: number | null;
  longitude: number | null;
  padrao: boolean;
}

export interface RespostaEnderecos {
  enderecos: Endereco[];
}

/** Sem CEP e sem número são casos normais; o ponto de referência é obrigatório. */
export interface EntradaEndereco {
  rotulo?: string;
  rua: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  bairroId?: string;
  referencia: string;
  cep?: string;
  cidadeId: string;
  latitude?: number;
  longitude?: number;
  padrao?: boolean;
}

// ---------------------------------------------------------------------------
// Checkout e pedidos
// ---------------------------------------------------------------------------

/** Parâmetros de `GET checkout/resumo`. */
export interface ParametrosDoResumo {
  lojaId: string;
  tipo?: TipoDePedido;
  enderecoId?: string;
  cupom?: string;
}

export interface ValoresDoCheckout {
  subtotalCents: number;
  taxaEntregaCents: number;
  /** "Entrega grátis pelo cupom", por exemplo. */
  motivoDaTaxa: string | null;
  descontoCents: number;
  freteGratisPorCupom: boolean;
  totalCents: number;
}

export interface ResumoDoCheckout {
  loja: {
    id: string;
    nome: string;
    slug: string;
    cidadeSlug: string;
    aceitaRetirada: boolean;
    ehMercado: boolean;
    tempoMin: number;
    tempoMax: number;
  };
  carrinho: CarrinhoDaLoja;
  tipo: TipoDePedido;
  enderecos: Endereco[];
  enderecoEscolhidoId: string | null;
  /** O que esta loja aceita agora. Só as formas sem pagamento online. */
  formasDePagamento: FormaDePagamento[];
  /** A forma do último pedido, se ainda for aceita aqui. */
  pagamentoSugerido: FormaDePagamento | null;
  exigencias: { maioridade: boolean; receita: boolean; temPesavel: boolean };
  valores: ValoresDoCheckout;
  /** Aviso do cupom digitado; null quando valeu ou não houve cupom. */
  mensagemDoCupom: string | null;
  /** Preenchido, impede o pedido, e o texto diz ao cliente o porquê. */
  bloqueio: string | null;
}

export interface EntradaCriarPedido {
  /**
   * Gerada pelo app ao abrir a tela e mantida nas repetições do mesmo envio:
   * rede ruim que reenvia não cria dois pedidos. De 8 a 64 caracteres.
   */
  chaveDeIdempotencia: string;
  lojaId: string;
  tipo?: TipoDePedido;
  /** Obrigatório na entrega. */
  enderecoId?: string;
  formaDePagamento: FormaDePagamento;
  /** "Troco para quanto?", só no dinheiro. */
  trocoParaCents?: number | null;
  cupom?: string;
  observacao?: string;
  nome?: string;
  telefone?: string;
  /** Obrigatório quando `exigencias.maioridade`. */
  confirmaMaioridade?: boolean;
  /** Id devolvido por `uploads`; obrigatório quando `exigencias.receita`. */
  receitaImagemId?: string;
  politicaDeSubstituicao?: PoliticaDeSubstituicao;
}

export interface RespostaCriarPedido {
  id: string;
  numero: string;
  status: StatusDoPedido;
  /** Verdadeiro quando a chave já tinha gerado este pedido: nada novo foi criado. */
  repetido: boolean;
  mensagem: string;
}

export interface LojaDoPedido {
  id: string;
  nome: string;
  slug: string;
}

export interface PedidoResumido {
  id: string;
  numero: string;
  status: StatusDoPedido;
  rotuloDoStatus: string;
  /** Ainda em andamento. */
  ativo: boolean;
  criadoEm: string;
  totalCents: number;
  loja: LojaDoPedido;
  itens: { nome: string; quantidade: number }[];
}

export interface RespostaPedidos {
  pedidos: PedidoResumido[];
}

export interface EnderecoDoPedido {
  rua: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  referencia: string | null;
  cep: string | null;
}

export interface ItemDoPedido {
  id: string;
  nome: string;
  quantidade: number;
  gramas: number | null;
  totalCents: number;
  observacao: string | null;
  pizzaTamanho: string | null;
  pizzaExtra: string | null;
  complementos: { id: string; nome: string; quantidade: number }[];
  sabores: { id: string; nome: string }[];
  /** Separação no mercado: PENDING, PICKED, REPLACED, MISSING, AWAITING_CUSTOMER. */
  statusDaSeparacao: string;
  gramasSeparadas: number | null;
  substituto: { nome: string; precoCents: number } | null;
}

export interface PixDoPedido {
  /** Chave Pix da loja, para copiar. */
  chave: string | null;
  /** Pix copia e cola (BR Code), de onde o app também desenha o QR. */
  copiaECola: string | null;
  expiraEm: string | null;
  /** Comprovante é opcional: quem libera o pedido é a loja, ao conferir. */
  comprovanteEnviado: boolean;
}

export interface PagamentoDoPedido {
  forma: string;
  status: StatusDoPagamento;
  trocoParaCents: number | null;
  estornadoCents: number;
  /** Só em pedido pago por Pix. */
  pix: PixDoPedido | null;
}

export interface EntregadorDoPedido {
  nome: string;
  telefone: string | null;
  veiculo: Veiculo;
  statusDaEntrega: StatusDaEntrega;
}

export interface PedidoDetalhado {
  id: string;
  numero: string;
  status: StatusDoPedido;
  rotuloDoStatus: string;
  mensagemDoStatus: string;
  ativo: boolean;
  tipo: TipoDePedido;
  criadoEm: string;
  previstoProntoEm: string | null;
  subtotalCents: number;
  taxaEntregaCents: number;
  descontoCents: number;
  totalCents: number;
  /** Total do checkout, quando a separação mudou o valor final. */
  totalEstimadoCents: number | null;
  observacao: string | null;
  motivoDoCancelamento: string | null;
  endereco: EnderecoDoPedido | null;
  loja: LojaDoPedido & { telefone: string | null; whatsapp: string | null; cidadeSlug: string };
  pagamento: PagamentoDoPedido | null;
  itens: ItemDoPedido[];
  historico: {
    id: string;
    status: StatusDoPedido;
    rotulo: string;
    nota: string | null;
    em: string;
  }[];
  entregador: EntregadorDoPedido | null;
  avaliacaoDaLoja: { nota: number; comentario: string | null; resposta: string | null } | null;
  jaAvaliado: boolean;
  podeCancelar: boolean;
  podeAvaliar: boolean;
  podeEnviarComprovante: boolean;
}

export interface EntradaAvaliarPedido {
  notaDaLoja?: number;
  comentarioDaLoja?: string;
  notaDoEntregador?: number;
  comentarioDoEntregador?: string;
}

export interface EntradaComprovante {
  /** Id devolvido por `uploads` com contexto `comprovante`. */
  imagemId: string;
}

export interface EntradaRespostaDaTroca {
  itemId: string;
  aceita: boolean;
}

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export interface RespostaFavoritos {
  lojas: (LojaDaVitrine & { cidadeSlug: string })[];
}

export interface EntradaAlternarFavorito {
  lojaId: string;
}

export interface RespostaAlternarFavorito {
  favorita: boolean;
}

// ---------------------------------------------------------------------------
// Pedido por lista (cidades/[cidade]/pedir)
// ---------------------------------------------------------------------------

export interface EntradaMontarLista {
  texto: string;
}

export interface ProdutoSugerido {
  id: string;
  nome: string;
  precoCents: number;
  porPeso: boolean;
  gramas: number | null;
  /** Pizza ou produto com escolha obrigatória: não dá para pôr direto. */
  precisaEscolher: boolean;
  imagemUrl: string | null;
}

export interface LojaSugerida {
  id: string;
  nome: string;
  slug: string;
  imagemUrl: string | null;
  tempoMin: number;
  taxaCents: number;
  taxaGratis: boolean;
  minimoCents: number;
  nota: number;
  avaliacoes: number;
  /** Candidatos por índice do item da lista, do mais provável ao menos. */
  produtos: Record<number, ProdutoSugerido[]>;
}

export interface PedidoMontado {
  itens: { indice: number; original: string; quantidade: number }[];
  lojas: LojaSugerida[];
  /** Melhor combinação: índice do item → id da loja. */
  plano: Record<number, string>;
  naoEncontrados: number[];
  soEmFechadas: number[];
}

export interface EntradaListaNoCarrinho {
  itens: { lojaId: string; produtoId: string; quantidade: number; gramas: number | null }[];
}

export interface RespostaListaNoCarrinho {
  adicionados: number;
  mensagem: string | null;
}

// ---------------------------------------------------------------------------
// Tô com fome (cidades/[cidade]/fome)
// ---------------------------------------------------------------------------

export interface PratoDoBaralho {
  /** `p:<produto>` ou `s:<sabor de pizza>`. */
  chave: string;
  nome: string;
  descricao: string | null;
  lojaId: string;
  lojaNome: string;
  lojaSlug: string;
  /** Sabor de pizza: o preço é do menor tamanho. */
  aPartirDe: boolean;
  precoCents: number;
  tempoMin: number;
  tipo: string;
  paraDividir: boolean;
  popularidade: number;
  imagemUrl: string | null;
  emAlta: boolean;
  jaPediu: boolean;
}

export interface RespostaPratos {
  pratos: PratoDoBaralho[];
}

export interface EntradaCriarSessaoDeFome {
  chaves: string[];
  apelido: string;
}

export interface RespostaCriarSessaoDeFome {
  id: string;
}

export interface EntradaVotoDeFome {
  chave: string;
  gostou: boolean;
  apelido: string;
}

export interface PlacarDaFome {
  participantes: { apelido: string; votos: number; souEu: boolean }[];
  curtidas: { chave: string; total: number; quem: string[] }[];
  match: string | null;
  totalDePratos: number;
  expirada: boolean;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * `POST uploads` é multipart: campo `arquivo` (imagem) e campo `contexto`.
 * As duas imagens são privadas: o `url` devolvido é assinado e vence.
 */
export type ContextoDeUpload = 'receita' | 'comprovante';

export interface RespostaUpload {
  id: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Entregador
// ---------------------------------------------------------------------------

export type TipoDeCorrida = 'pedido' | 'avulsa';

export interface LojaDaCorrida {
  nome: string;
  telefone: string | null;
  endereco: string;
}

export interface CorridaDisponivel {
  id: string;
  ganhoCents: number;
  distanciaMetros: number | null;
  numero: string;
  totalCents: number;
  loja: LojaDaCorrida;
  destino: EnderecoDoPedido | null;
}

export interface CorridaMinha {
  id: string;
  status: 'ACCEPTED' | 'PICKED_UP';
  ganhoCents: number;
  numero: string;
  cliente: string;
  telefoneDoCliente: string;
  totalCents: number;
  destino: EnderecoDoPedido | null;
  loja: LojaDaCorrida;
  /** Item +18: conferir o documento com foto na entrega. */
  conferirDocumento: boolean;
  /** Remédio com receita: conferir a receita original na entrega. */
  conferirReceita: boolean;
  pagamento: {
    forma: string;
    status: StatusDoPagamento;
    trocoParaCents: number | null;
  } | null;
}

export interface CorridaAvulsa {
  id: string;
  status: 'OPEN' | 'ACCEPTED' | 'PICKED_UP';
  ganhoCents: number;
  /** Quanto cobrar do cliente na entrega, se houver. */
  cobrarCents: number | null;
  loja: LojaDaCorrida;
  cliente: string;
  telefoneDoCliente: string | null;
  endereco: string;
  referencia: string | null;
  recado: string | null;
}

export interface PainelDoEntregador {
  entregador: {
    nome: string | null;
    online: boolean;
    entregasTotais: number;
    nota: number;
    daLoja: boolean;
    veiculo: Veiculo;
  };
  ganhosDeHoje: { ganhoCents: number; entregas: number };
  disponiveis: CorridaDisponivel[];
  minhas: CorridaMinha[];
  avulsasDisponiveis: CorridaAvulsa[];
  avulsasMinhas: CorridaAvulsa[];
}

/** Corpo de `aceitar`. Sem `tipo`, vale `pedido`. */
export interface EntradaAceitarCorrida {
  tipo?: TipoDeCorrida;
}

/**
 * Corrida da fila: some do painel deste entregador por um tempo e segue aberta
 * aos demais. Corrida já aceita e ainda não retirada: volta para a fila.
 */
export interface EntradaRecusarCorrida {
  tipo?: TipoDeCorrida;
  motivo?: string;
}

export interface EntradaAvancarCorrida {
  tipo?: TipoDeCorrida;
  status: 'PICKED_UP' | 'DELIVERED';
}

export interface EntradaDisponibilidade {
  online: boolean;
}

export interface EntradaLocalizacao {
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Tempo real, configuração e dispositivos
// ---------------------------------------------------------------------------

/** Parâmetros de `GET realtime/token`. */
export type ParametrosDoTempoReal =
  | { canal: 'pedido'; id: string }
  /** O canal do próprio entregador: não leva id. */
  | { canal: 'entregador' };

/** No socket: `emit('subscribe', { channel: canal, token })`. */
export interface RespostaTokenDeTempoReal {
  canal: string;
  token: string;
  url: string;
  expiraEm: string;
}

export interface ConfiguracaoDoApp {
  /** Abaixo disto o app pede atualização antes de continuar. */
  versaoMinima: { android: string; ios: string };
  recursos: {
    pedidoPorLista: boolean;
    toComFome: boolean;
    comprovantePix: boolean;
    modoEntregador: boolean;
  };
  textos: {
    aviso: string | null;
    suporteWhatsapp: string | null;
  };
}

export interface EntradaDispositivo {
  expoPushToken: string;
  plataforma: 'android' | 'ios';
}
