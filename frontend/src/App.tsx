import { Routes, Route, Navigate } from 'react-router-dom';
import { UiPreview } from './routes/UiPreview';
import Layout from './components/Layout';
import CampaignLayout from './components/CampaignLayout';
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
    <Routes>
      <Route path="/ui-preview" element={<UiPreview />} />
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
    </Routes>
  );
}
