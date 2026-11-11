import React from 'react';
import { createRoot } from 'react-dom/client';
import RationPreview from '../src/components/RationPreview.jsx';
import '../src/styles/theme.css';
import '../src/styles/navigation.css';
import './portfolio.css';

createRoot(document.getElementById('root')).render(
  <main className="portfolio-demo">
    <header className="portfolio-intro">
      <p className="portfolio-brand">AkiNutri</p>
      <h1>Quanto custa alimentar uma vaca em lactação?</h1>
      <p>
        Ajuste a produção de leite corrigido para comparar o custo, o consumo e a composição da
        dieta em 26 cenários de referência.
      </p>
      <p>Projeto desenvolvido no Hackathon RERUM 2026 da UFJF.</p>
      <a href="https://github.com/hlanzieri/hackathon-rerum">Ver código e documentação no GitHub</a>
    </header>
    <RationPreview />
  </main>,
);
