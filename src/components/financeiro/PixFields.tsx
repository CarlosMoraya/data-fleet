import React from 'react';

import type { PixKeyType } from '../../types/payment';

const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Aleatória',
};

export interface PixFieldsValue {
  pixKeyType?: PixKeyType;
  pixKey?: string;
  pixBeneficiaryName?: string;
}

interface PixFieldsProps {
  pixKeyType?: PixKeyType;
  pixKey?: string;
  pixBeneficiaryName?: string;
  onChange: (patch: PixFieldsValue) => void;
}

export default function PixFields({
  pixKeyType,
  pixKey,
  pixBeneficiaryName,
  onChange,
}: PixFieldsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <select
          value={pixKeyType ?? 'aleatoria'}
          onChange={(e) => onChange({ pixKeyType: e.target.value as PixKeyType })}
          className="rounded-lg border border-zinc-300 px-1.5 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
        >
          {(Object.keys(PIX_KEY_TYPE_LABELS) as PixKeyType[]).map((k) => (
            <option key={k} value={k}>{PIX_KEY_TYPE_LABELS[k]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Chave Pix"
          value={pixKey ?? ''}
          onChange={(e) => onChange({ pixKey: e.target.value })}
          className="flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
        />
      </div>
      <input
        type="text"
        placeholder="Favorecido"
        value={pixBeneficiaryName ?? ''}
        onChange={(e) => onChange({ pixBeneficiaryName: e.target.value })}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs focus:ring-1 focus:ring-orange-400 focus:outline-none"
      />
    </div>
  );
}

export { PIX_KEY_TYPE_LABELS };
