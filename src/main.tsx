import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Inscription from './pages/joueur/Inscription';
import MonInscription from './pages/joueur/MonInscription';
import Jeux from './pages/joueur/Jeux';
import Retrouver from './pages/joueur/Retrouver';
import Diagnostic from './pages/Diagnostic';
import AdminLayout from './pages/admin/AdminLayout';
import AdminTournoi from './pages/admin/Tournoi';
import AdminJeux from './pages/admin/Jeux';
import AdminInscrits from './pages/admin/Inscrits';
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
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminTournoi />} />
          <Route path="jeux" element={<AdminJeux />} />
          <Route path="inscrits" element={<AdminInscrits />} />
        </Route>
        <Route path="*" element={<Inscription />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
