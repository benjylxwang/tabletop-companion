import { Routes, Route } from 'react-router-dom';
import { Home } from './routes/Home';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
