import { Routes, Route, Navigate } from 'react-router-dom';
import { UiPreview } from './routes/UiPreview';
import { DevGeneratorModal } from './components/DevGeneratorModal';
import Layout from './components/Layout';
import CampaignLayout from './components/CampaignLayout';
import RequireAuth from './components/RequireAuth';
import Login from './routes/auth/Login';
import Signup from './routes/auth/Signup';
import CheckEmail from './routes/auth/CheckEmail';
import AuthCallback from './routes/auth/AuthCallback';
import CampaignList from './routes/campaigns/CampaignList';
import CampaignDetail from './routes/campaigns/CampaignDetail';
import SessionList from './routes/sessions/SessionList';
import SessionDetail from './routes/sessions/SessionDetail';
import CharacterList from './routes/characters/CharacterList';
import CharacterDetail from './routes/characters/CharacterDetail';
import NpcList from './routes/npcs/NpcList';
import NpcDetail from './routes/npcs/NpcDetail';
import LocationList from './routes/locations/LocationList';
import LocationDetail from './routes/locations/LocationDetail';
import FactionList from './routes/factions/FactionList';
import FactionDetail from './routes/factions/FactionDetail';
import LoreList from './routes/lore/LoreList';
import LoreDetail from './routes/lore/LoreDetail';

export function App() {
  return (
    <>
      <DevGeneratorModal />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ui-preview" element={<UiPreview />} />

        {/* Authenticated app */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/campaigns" replace />} />
            <Route path="campaigns" element={<CampaignList />} />
            <Route path="campaigns/:id" element={<CampaignLayout />}>
              <Route index element={<CampaignDetail />} />
              <Route path="sessions" element={<SessionList />} />
              <Route path="sessions/:sessionId" element={<SessionDetail />} />
              <Route path="characters" element={<CharacterList />} />
              <Route path="characters/:charId" element={<CharacterDetail />} />
              <Route path="npcs" element={<NpcList />} />
              <Route path="npcs/:npcId" element={<NpcDetail />} />
              <Route path="locations" element={<LocationList />} />
              <Route path="locations/:locationId" element={<LocationDetail />} />
              <Route path="factions" element={<FactionList />} />
              <Route path="factions/:factionId" element={<FactionDetail />} />
              <Route path="lore" element={<LoreList />} />
              <Route path="lore/:loreId" element={<LoreDetail />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </>
  );
}
