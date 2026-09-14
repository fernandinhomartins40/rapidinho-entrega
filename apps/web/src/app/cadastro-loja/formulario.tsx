'use client';

import { useActionState } from 'react';
import { Button, Card, CardContent, Input, Label } from '@rapidinho/ui';
import { cadastrarLoja } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function FormularioDeCadastro({
  cidades,
  categorias,
}: {
  cidades: { id: string; name: string; state: string }[];
  categorias: { id: string; name: string }[];
}) {
  const [estado, acao, pendente] = useActionState(cadastrarLoja, ACTION_IDLE);

  if (estado.ok) {
    return (
      <Card className="border-success mt-6">
        <CardContent className="pt-6">
          <p className="text-success font-bold">Tudo certo!</p>
          <p className="mt-2 leading-relaxed">{estado.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={acao} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="nome" required>
          Nome da loja
        </Label>
        <Input id="nome" name="nome" required error={estado.fieldErrors?.nome} />
      </div>

      <div>
        <Label htmlFor="documento" required>
          CPF ou CNPJ
        </Label>
        <Input
          id="documento"
          name="documento"
          inputMode="numeric"
          required
          error={estado.fieldErrors?.documento}
        />
        {/* MEI sem CNPJ é a realidade da maioria no interior. */}
        <p className="text-muted-foreground mt-1 text-sm">Pode ser o seu CPF, se você é MEI.</p>
      </div>

      <div>
        <Label htmlFor="responsavel" required>
          Seu nome
        </Label>
        <Input
          id="responsavel"
          name="responsavel"
          required
          error={estado.fieldErrors?.responsavel}
        />
      </div>

      <div>
        <Label htmlFor="telefone" required>
          WhatsApp
        </Label>
        <Input
          id="telefone"
          name="telefone"
          inputMode="tel"
          placeholder="(44) 99999-0000"
          required
          error={estado.fieldErrors?.telefone}
        />
        <p className="text-muted-foreground mt-1 text-sm">
          É por aqui que você entra no painel e recebe os avisos.
        </p>
      </div>

      <div>
        <Label htmlFor="email">E-mail (opcional)</Label>
        <Input id="email" name="email" type="email" error={estado.fieldErrors?.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cityId" required>
            Cidade
          </Label>
          <select
            id="cityId"
            name="cityId"
            required
            className="border-input min-h-touch w-full rounded-lg border px-3"
          >
            {cidades.map((cidade) => (
              <option key={cidade.id} value={cidade.id}>
                {cidade.name}/{cidade.state}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="categoryId">Tipo de loja</Label>
          <select
            id="categoryId"
            name="categoryId"
            className="border-input min-h-touch w-full rounded-lg border px-3"
            defaultValue=""
          >
            <option value="">Escolher depois</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <Label htmlFor="rua" required>
            Rua
          </Label>
          <Input id="rua" name="rua" required error={estado.fieldErrors?.rua} />
        </div>
        <div>
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" name="numero" placeholder="Se tiver" />
        </div>
      </div>

      <div>
        <Label htmlFor="bairro" required>
          Bairro
        </Label>
        <Input id="bairro" name="bairro" required error={estado.fieldErrors?.bairro} />
      </div>

      <div>
        <Label htmlFor="referencia">Ponto de referência</Label>
        <Input id="referencia" name="referencia" placeholder="Ex.: ao lado do posto" />
      </div>

      {estado.message && !estado.ok ? (
        <p role="alert" className="text-destructive font-medium">
          {estado.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={pendente}>
        {pendente ? 'Enviando…' : 'Enviar cadastro'}
      </Button>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Ao enviar você aceita os termos de uso e a política de privacidade da plataforma.
      </p>
    </form>
  );
}
