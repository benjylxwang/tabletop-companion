import { lazy, Suspense } from 'react';
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
import { PageSkeleton } from './components/PageSkeleton';

// Lazy-loaded authenticated routes
const CampaignList = lazy(() =>
  import('./routes/campaigns/CampaignList').then((m) => ({ default: m.default })),
);
const CampaignDetail = lazy(() =>
  import('./routes/campaigns/CampaignDetail').then((m) => ({ default: m.default })),
);
const CampaignMembers = lazy(() =>
  import('./routes/campaigns/CampaignMembers').then((m) => ({ default: m.default })),
);
const SessionList = lazy(() =>
  import('./routes/sessions/SessionList').then((m) => ({ default: m.default })),
);
const SessionDetail = lazy(() =>
  import('./routes/sessions/SessionDetail').then((m) => ({ default: m.default })),
);
const CharacterList = lazy(() =>
  import('./routes/characters/CharacterList').then((m) => ({ default: m.default })),
);
const CharacterDetail = lazy(() =>
  import('./routes/characters/CharacterDetail').then((m) => ({ default: m.default })),
);
const NpcList = lazy(() =>
  import('./routes/npcs/NpcList').then((m) => ({ default: m.default })),
);
const NpcDetail = lazy(() =>
  import('./routes/npcs/NpcDetail').then((m) => ({ default: m.default })),
);
const LocationList = lazy(() =>
  import('./routes/locations/LocationList').then((m) => ({ default: m.default })),
);
const LocationDetail = lazy(() =>
  import('./routes/locations/LocationDetail').then((m) => ({ default: m.default })),
);
const FactionList = lazy(() =>
  import('./routes/factions/FactionList').then((m) => ({ default: m.default })),
);
const FactionDetail = lazy(() =>
  import('./routes/factions/FactionDetail').then((m) => ({ default: m.default })),
);
const LoreList = lazy(() =>
  import('./routes/lore/LoreList').then((m) => ({ default: m.default })),
);
const LoreDetail = lazy(() =>
  import('./routes/lore/LoreDetail').then((m) => ({ default: m.default })),
);
const CampaignMap = lazy(() =>
  import('./routes/map/CampaignMap').then((m) => ({ default: m.default })),
);

export function App() {
  return (
    <>
      <DevGeneratorModal />
      <Routes>
        {/* Public routes — eagerly loaded */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ui-preview" element={<UiPreview />} />

        {/* Authenticated app */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Suspense fallback={<PageSkeleton />}>
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
                <Route path="members" element={<CampaignMembers />} />
                <Route path="map" element={<CampaignMap />} />
              </Route>
            </Suspense>
          </Route>
        </Route>
      </Routes>
    </>
  );
}
