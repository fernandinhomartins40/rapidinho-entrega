'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ImageUploader,
  Input,
  Label,
  SwitchField,
} from '@rapidinho/ui';
import { formatDocument, maskPhoneBR } from '@rapidinho/shared';
import {
  salvarImagensDaLoja,
  salvarOperacao,
  salvarPagamentos,
  salvarPerfilDaLoja,
} from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Loja {
  name: string;
  description: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  document: string;
  legalName: string | null;
  street: string;
  number: string | null;
  neighborhood: string;
  referencePoint: string | null;
  zipCode: string | null;
  acceptsPix: boolean;
  acceptsCardOnline: boolean;
  acceptsCashOnDelivery: boolean;
  acceptsCardOnDelivery: boolean;
  pixKey: string | null;
  soundAlertEnabled: boolean;
  autoAcceptOrders: boolean;
  logoId: string | null;
  coverId: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
}

export function FormulariosDeConfiguracao({ loja }: { loja: Loja }) {
  return (
    <div className="space-y-6">
      <Imagens loja={loja} />
      <Perfil loja={loja} />
      <Pagamentos loja={loja} />
      <Operacao loja={loja} />
    </div>
  );
}

function Imagens({ loja }: { loja: Loja }) {
  const [logoId, setLogoId] = useState(loja.logoId);
  const [coverId, setCoverId] = useState(loja.coverId);
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function salvar(novoLogo: string | null, novaCapa: string | null) {
    iniciarTransicao(async () => {
      const resultado = await salvarImagensDaLoja({ logoId: novoLogo, coverId: novaCapa });
      setMensagem(resultado.message ?? null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo e capa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
          <ImageUploader
            context="STORE_LOGO"
            value={logoId}
            previewUrl={loja.logoUrl}
            label="Logo"
            helperText="Quadrada"
            disabled={pendente}
            onChange={(id) => {
              setLogoId(id);
              salvar(id, coverId);
            }}
          />
          <ImageUploader
            context="STORE_COVER"
            value={coverId}
            previewUrl={loja.coverUrl}
            label="Capa"
            helperText="Aparece no topo da sua página"
            disabled={pendente}
            onChange={(id) => {
              setCoverId(id);
              salvar(logoId, id);
            }}
          />
        </div>
        {mensagem ? <p className="text-success text-sm font-medium">{mensagem}</p> : null}
      </CardContent>
    </Card>
  );
}

function Perfil({ loja }: { loja: Loja }) {
  const [estado, acao, pendente] = useActionState(salvarPerfilDaLoja, ACTION_IDLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da loja</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nome da loja</Label>
              <Input
                id="name"
                name="name"
                defaultValue={loja.name}
                required
                error={estado.fieldErrors?.name}
              />
            </div>
            <div>
              <Label htmlFor="document">CPF ou CNPJ</Label>
              <Input
                id="document"
                name="document"
                defaultValue={formatDocument(loja.document)}
                required
                error={estado.fieldErrors?.document}
              />
            </div>
            <div>
              <Label htmlFor="legalName">Razão social (opcional)</Label>
              <Input id="legalName" name="legalName" defaultValue={loja.legalName ?? ''} />
            </div>
            <div>
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={loja.email ?? ''}
                error={estado.fieldErrors?.email}
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                inputMode="tel"
                defaultValue={maskPhoneBR(loja.phone)}
                required
                error={estado.fieldErrors?.phone}
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp (opcional)</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                inputMode="tel"
                defaultValue={loja.whatsapp ? maskPhoneBR(loja.whatsapp) : ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              defaultValue={loja.description ?? ''}
              placeholder="Uma frase sobre a sua loja"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="street">Rua</Label>
              <Input
                id="street"
                name="street"
                defaultValue={loja.street}
                required
                error={estado.fieldErrors?.street}
              />
            </div>
            <div>
              <Label htmlFor="number">Número (se tiver)</Label>
              <Input id="number" name="number" defaultValue={loja.number ?? ''} />
            </div>
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                name="neighborhood"
                defaultValue={loja.neighborhood}
                required
                error={estado.fieldErrors?.neighborhood}
              />
            </div>
            <div>
              <Label htmlFor="zipCode">CEP (se souber)</Label>
              <Input
                id="zipCode"
                name="zipCode"
                inputMode="numeric"
                defaultValue={loja.zipCode ?? ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="referencePoint">Ponto de referência</Label>
            <Input
              id="referencePoint"
              name="referencePoint"
              defaultValue={loja.referencePoint ?? ''}
              placeholder="Ex.: em frente à praça"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar dados'}
            </Button>
            {estado.message ? (
              <p
                role="status"
                className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}
              >
                {estado.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Pagamentos({ loja }: { loja: Loja }) {
  const [estado, acao, pendente] = useActionState(salvarPagamentos, ACTION_IDLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formas de pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="space-y-4">
          <SwitchField name="acceptsPix" defaultChecked={loja.acceptsPix} label="Pix" />
          <SwitchField
            name="acceptsCardOnline"
            defaultChecked={loja.acceptsCardOnline}
            label="Cartão pelo app"
            description="O cliente paga na hora do pedido."
          />
          <SwitchField
            name="acceptsCashOnDelivery"
            defaultChecked={loja.acceptsCashOnDelivery}
            label="Dinheiro na entrega"
            description="O cliente informa para quanto precisa de troco."
          />
          <SwitchField
            name="acceptsCardOnDelivery"
            defaultChecked={loja.acceptsCardOnDelivery}
            label="Maquininha na entrega"
          />

          <div>
            <Label htmlFor="pixKey">Sua chave Pix (opcional)</Label>
            <Input
              id="pixKey"
              name="pixKey"
              defaultValue={loja.pixKey ?? ''}
              placeholder="Telefone, CPF/CNPJ, e-mail ou chave aleatória"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar'}
            </Button>
            {estado.message ? (
              <p
                role="status"
                className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}
              >
                {estado.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Operacao({ loja }: { loja: Loja }) {
  const [estado, acao, pendente] = useActionState(salvarOperacao, ACTION_IDLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="space-y-4">
          <SwitchField
            name="soundAlertEnabled"
            defaultChecked={loja.soundAlertEnabled}
            label="Tocar alerta quando chegar pedido"
            description="O som repete até alguém atender."
          />
          <SwitchField
            name="autoAcceptOrders"
            defaultChecked={loja.autoAcceptOrders}
            label="Aceitar pedidos automaticamente"
            description="Só use se você sempre aceita. O pedido entra direto em preparo, sem confirmação."
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar'}
            </Button>
            {estado.message ? (
              <p
                role="status"
                className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}
              >
                {estado.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
