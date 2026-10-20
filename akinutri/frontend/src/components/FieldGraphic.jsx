import React from 'react';
export default function FieldGraphic() {
  return (
    <svg className="field-graphic" viewBox="0 0 600 310" fill="none" aria-hidden="true">
      <defs>
        <pattern id="field-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" stroke="currentColor" strokeOpacity=".12" />
        </pattern>
      </defs>
      <path fill="url(#field-grid)" d="M0 0h600v310H0z" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${-70 + i * 28} 290 Q${120 + i * 28} ${110 - i * 12} ${290 + i * 28} ${160 - i * 13} T650 ${50 + i * 21}`}
          stroke="currentColor"
          strokeOpacity={0.15 + i * 0.08}
          strokeWidth="1.2"
        />
      ))}
      <path
        d="M68 214L190 163L300 195L420 107L532 126"
        stroke="#6EE7B7"
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      {[
        [68, 214],
        [190, 163],
        [300, 195],
        [420, 107],
        [532, 126],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="10" fill="#143D23" stroke="#6EE7B7" />
          <circle cx={x} cy={y} r="3" fill="#6EE7B7" />
        </g>
      ))}
      <g stroke="currentColor" strokeWidth="1.5">
        <path d="M100 100V62l42-23 42 23v38H100ZM142 39v61M111 100V73h62v27M315 270v-37h59v37M304 233h81l-40-25-41 25Z" />
      </g>
      <text x="202" y="146" fill="#C9DECC" fontSize="10" fontFamily="monospace">
        LOTE / 01
      </text>
      <text x="430" y="88" fill="#C9DECC" fontSize="10" fontFamily="monospace">
        VAGÃO / MN
      </text>
      <text x="68" y="299" fill="#C9DECC" fontSize="10" fontFamily="monospace">
        DADOS → REGRAS → OPERAÇÃO
      </text>
    </svg>
  );
}
