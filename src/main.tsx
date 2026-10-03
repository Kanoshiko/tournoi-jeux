import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Inscription from './pages/joueur/Inscription';
import MonInscription from './pages/joueur/MonInscription';
import Jeux from './pages/joueur/Jeux';
import Retrouver from './pages/joueur/Retrouver';
import Diagnostic from './pages/Diagnostic';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inscription />} />
        <Route path="/moi/:token" element={<MonInscription />} />
        <Route path="/jeux" element={<Jeux />} />
        <Route path="/retrouver" element={<Retrouver />} />
        <Route path="/diagnostic" element={<Diagnostic />} />
        <Route path="*" element={<Inscription />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
