import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
const STATES = {
  atendida: ['Atendida', CheckCircle2, 'success'],
  violada: ['Violada', XCircle, 'danger'],
  dados_insuficientes: ['Dados Insuficientes', AlertTriangle, 'warning'],
  fora_escopo: ['Fora do Escopo', Info, 'neutral'],
  nao_atendida: ['Fora do Escopo', Info, 'neutral'],
};
export default function StatusBadge({ status }) {
  const [text, Icon, tone] = STATES[status] || [status, Info, 'neutral'];
  return (
    <span className={`state-badge ${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {text}
    </span>
  );
}
