import { Routes, Route } from 'react-router-dom';
import { Home } from './routes/Home';
import { UiPreview } from './routes/UiPreview';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ui-preview" element={<UiPreview />} />
    </Routes>
  );
}
