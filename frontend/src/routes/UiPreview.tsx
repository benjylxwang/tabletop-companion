import { useState } from 'react';
import { Sword } from 'lucide-react';
import {
  AITextInput,
  AITextarea,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorDisplay,
  FileUpload,
  FormField,
  Modal,
  Select,
  Skeleton,
  Spinner,
  Textarea,
  TextInput,
} from '../components';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold text-ink-900 border-b border-parchment-300 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-ink-300 uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const themes = [
  {
    id: 'A',
    name: 'Arcane',
    tag: 'Mystical · wizard-tower',
    recommended: true,
    pageBg: '#020617',      // slate-950
    sidebarBg: '#0f172a',   // slate-900
    border: '#1e293b',      // slate-800
    accent: '#fbbf24',      // amber-400
    accentTint: 'rgba(245,158,11,0.12)',
    muted: '#94a3b8',       // slate-400
    text: '#f1f5f9',        // slate-100
  },
  {
    id: 'B',
    name: 'Dark Fantasy',
    tag: 'Brooding · gothic · dramatic',
    recommended: false,
    pageBg: '#09090b',      // zinc-950
    sidebarBg: '#18181b',   // zinc-900
    border: '#27272a',      // zinc-800
    accent: '#ef4444',      // red-500
    accentTint: 'rgba(220,38,38,0.12)',
    muted: '#a1a1aa',       // zinc-400
    text: '#f4f4f5',        // zinc-100
  },
  {
    id: 'C',
    name: 'Tavern Warmth',
    tag: 'Cozy · candlelit · old-world',
    recommended: false,
    pageBg: '#0c0a09',      // stone-950
    sidebarBg: '#1c1917',   // stone-900
    border: '#44403c',      // stone-700
    accent: '#fb923c',      // orange-400
    accentTint: 'rgba(249,115,22,0.12)',
    muted: '#a8a29e',       // stone-400
    text: '#f5f5f4',        // stone-100
  },
  {
    id: 'D',
    name: 'Void & Violet',
    tag: 'Eldritch · cosmic horror · sorcery',
    recommended: false,
    pageBg: '#0d0a14',
    sidebarBg: '#1a0e2e',   // ~purple-950
    border: '#2e1065',      // purple-950 border
    accent: '#a78bfa',      // violet-400
    accentTint: 'rgba(167,139,250,0.12)',
    muted: '#c4b5fd',       // violet-300
    text: '#ede9fe',        // violet-100
  },
  {
    id: 'E',
    name: 'Verdant',
    tag: 'Ranger · druid · nature',
    recommended: false,
    pageBg: '#081510',
    sidebarBg: '#052e16',   // green-950
    border: '#14532d',      // green-900
    accent: '#34d399',      // emerald-400
    accentTint: 'rgba(52,211,153,0.12)',
    muted: '#6ee7b7',       // emerald-300
    text: '#ecfdf5',        // emerald-50
  },
];

type Theme = typeof themes[number];

function ThemeCard({ theme }: { theme: Theme }) {
  const navItems = ['Overview', 'Sessions', 'Characters', 'NPCs', 'Locations'];
  return (
    <div className="flex flex-col gap-2 w-52">
      {/* Mini app shell */}
      <div
        className="rounded-lg overflow-hidden border"
        style={{ background: theme.pageBg, borderColor: theme.border }}
      >
        {/* Top bar */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ background: theme.sidebarBg, borderColor: theme.border }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: theme.accent }} />
          <span className="text-[10px] font-semibold tracking-wide" style={{ color: theme.text }}>
            Tabletop Companion
          </span>
        </div>
        {/* Sidebar nav mockup */}
        <div className="flex" style={{ minHeight: 130 }}>
          <div
            className="w-28 border-r flex flex-col py-2 gap-0.5"
            style={{ background: theme.sidebarBg, borderColor: theme.border }}
          >
            {navItems.map((item, i) => (
              <div
                key={item}
                className="flex items-center gap-1.5 px-2 py-1 text-[9px]"
                style={
                  i === 0
                    ? {
                        background: theme.accentTint,
                        borderLeft: `2px solid ${theme.accent}`,
                        color: theme.accent,
                        fontWeight: 600,
                      }
                    : { color: theme.muted, borderLeft: '2px solid transparent' }
                }
              >
                <div
                  className="w-1.5 h-1.5 rounded-sm shrink-0"
                  style={{ background: i === 0 ? theme.accent : theme.muted, opacity: i === 0 ? 1 : 0.5 }}
                />
                {item}
              </div>
            ))}
          </div>
          {/* Content area */}
          <div className="flex-1 p-3 flex flex-col gap-1.5">
            <div className="h-2 rounded" style={{ background: theme.border, width: '70%' }} />
            <div className="h-1.5 rounded" style={{ background: theme.border, width: '90%' }} />
            <div className="h-1.5 rounded" style={{ background: theme.border, width: '55%' }} />
            <div
              className="mt-2 rounded px-2 py-1 text-[8px] font-semibold self-start"
              style={{ background: theme.accent, color: theme.pageBg }}
            >
              New Campaign
            </div>
          </div>
        </div>
      </div>
      {/* Label */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-900">{theme.id} — {theme.name}</span>
          {theme.recommended && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600">
              recommended
            </span>
          )}
        </div>
        <p className="text-[10px] text-ink-400">{theme.tag}</p>
        <div className="flex gap-1 mt-1">
          {[theme.pageBg, theme.sidebarBg, theme.border, theme.accent, theme.muted].map((hex) => (
            <div
              key={hex}
              className="h-3 w-5 rounded-sm border border-parchment-300"
              style={{ background: hex }}
              title={hex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const colorPalette = [
  { name: 'parchment', shades: ['50', '100', '200', '300', '400'], hex: ['#faf7f2', '#f5f0e8', '#ede3d0', '#ddd0b8', '#c9b99a'] },
  { name: 'ink',       shades: ['300', '500', '700', '900'], hex: ['#a8967f', '#6b5c48', '#3d3329', '#1c1814'] },
  { name: 'amber',     shades: ['400', '500', '600'],         hex: ['#f59e0b', '#d97706', '#b45309'] },
  { name: 'sage',      shades: ['200', '600', '700'],         hex: ['#d1e8d4', '#4a7c59', '#3a6147'] },
  { name: 'crimson',   shades: ['100', '200', '600', '700'],  hex: ['#fce8e8', '#f8d0d0', '#b91c1c', '#991b1b'] },
  { name: 'stone',     shades: ['100', '200', '600', '700'],  hex: ['#f5f5f4', '#e7e5e4', '#57534e', '#44403c'] },
];

export function UiPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectValue, setSelectValue] = useState('');
  const [uploadedFile, setUploadedFile] = useState<string | undefined>(undefined);
  const [aiDemoCampaignId, setAiDemoCampaignId] = useState('');
  const [aiDemoNpcName, setAiDemoNpcName] = useState('');
  const [aiDemoBackstory, setAiDemoBackstory] = useState('');

  return (
    <div className="min-h-screen bg-parchment-50 font-sans">
      <header className="sticky top-0 z-10 bg-parchment-100 border-b border-parchment-300 shadow-card px-6 py-4">
        <h1 className="font-display text-2xl font-bold text-ink-900">
          UI Components
        </h1>
        <p className="text-sm text-ink-500 mt-0.5">Developer reference — Tabletop Companion design system</p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-14">

        {/* ── Color Palette ─────────────────────────────── */}
        <Section title="Color Palette">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide -mt-2">Base design tokens</p>
          {colorPalette.map((group) => (
            <div key={group.name} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-ink-700 capitalize">{group.name}</p>
              <div className="flex gap-2 flex-wrap">
                {group.shades.map((shade, i) => (
                  <div key={shade} className="flex flex-col items-center gap-1">
                    <div
                      className="h-10 w-16 rounded border border-parchment-300"
                      style={{ background: group.hex[i] }}
                    />
                    <span className="text-[10px] text-ink-300">{shade}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t border-parchment-300 pt-4 mt-2">
            <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Theme option palettes</p>
            <div className="flex flex-col gap-4">
              {themes.map((t) => (
                <div key={t.id} className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-ink-700">
                    {t.id} — {t.name}
                    <span className="ml-2 text-ink-400 font-normal">{t.tag}</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'page',    hex: t.pageBg },
                      { label: 'surface', hex: t.sidebarBg },
                      { label: 'border',  hex: t.border },
                      { label: 'accent',  hex: t.accent },
                      { label: 'muted',   hex: t.muted },
                      { label: 'text',    hex: t.text },
                    ].map(({ label, hex }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <div
                          className="h-10 w-16 rounded border border-parchment-300"
                          style={{ background: hex }}
                          title={hex}
                        />
                        <span className="text-[10px] text-ink-300">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Theme Options ─────────────────────────────── */}
        <Section title="Theme Options">
          <p className="text-sm text-ink-500 -mt-2">
            Five candidate colour schemes for the app shell. Pick one to apply to the sidebar.
          </p>
          <div className="flex flex-wrap gap-6">
            {themes.map((t) => (
              <ThemeCard key={t.id} theme={t} />
            ))}
          </div>
        </Section>

        {/* ── Typography ────────────────────────────────── */}
        <Section title="Typography">
          <p className="font-display text-3xl font-bold text-ink-900">Display heading (Crimson Text)</p>
          <p className="font-display text-xl font-semibold text-ink-900">Section heading</p>
          <p className="text-base text-ink-900">Body text — regular weight</p>
          <p className="text-sm text-ink-700">Small body / label text</p>
          <p className="text-xs text-ink-500">Metadata / caption text</p>
          <p className="text-xs text-ink-300">Muted / placeholder text</p>
        </Section>

        {/* ── Buttons ───────────────────────────────────── */}
        <Section title="Buttons">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="States">
            <Button isLoading>Loading</Button>
            <Button disabled>Disabled</Button>
          </Row>
        </Section>

        {/* ── Cards ─────────────────────────────────────── */}
        <Section title="Cards">
          <Row label="Simple card">
            <Card className="w-64">
              <Card.Body>
                <p className="text-sm text-ink-700">A simple card body with no header or footer.</p>
              </Card.Body>
            </Card>
          </Row>
          <Row label="With header, body, footer">
            <Card className="w-72">
              <Card.Header>
                <p className="font-display text-base font-semibold text-ink-900">The Lost Mines</p>
                <p className="text-xs text-ink-500">D&D 5e · Active</p>
              </Card.Header>
              <Card.Body>
                <p className="text-sm text-ink-700">A grand adventure into the depths of the Sword Coast.</p>
              </Card.Body>
              <Card.Footer>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm">Edit</Button>
                  <Button variant="primary" size="sm">Open</Button>
                </div>
              </Card.Footer>
            </Card>
          </Row>
        </Section>

        {/* ── Form Controls ─────────────────────────────── */}
        <Section title="Form Controls">
          <Row label="TextInput">
            <div className="w-64 flex flex-col gap-2">
              <TextInput placeholder="Default state" />
              <TextInput placeholder="Error state" error defaultValue="bad value" />
              <TextInput placeholder="Disabled" disabled />
            </div>
          </Row>
          <Row label="Textarea">
            <div className="w-64 flex flex-col gap-2">
              <Textarea placeholder="Default textarea" rows={3} />
              <Textarea placeholder="Error textarea" error rows={3} />
            </div>
          </Row>
          <Row label="Select">
            <div className="w-64">
              <Select
                value={selectValue}
                onChange={setSelectValue}
                placeholder="Choose a system…"
                options={[
                  { value: 'dnd5e', label: 'D&D 5e' },
                  { value: 'pathfinder', label: 'Pathfinder 2e' },
                  { value: 'daggerheart', label: 'Daggerheart' },
                  { value: 'blades', label: 'Blades in the Dark' },
                ]}
              />
            </div>
          </Row>
          <Row label="FileUpload">
            <div className="w-64">
              <FileUpload
                accept=".pdf,image/*"
                onChange={(f) => setUploadedFile(f?.name)}
                currentFileName={uploadedFile}
              />
            </div>
          </Row>
        </Section>

        {/* ── FormField ─────────────────────────────────── */}
        <Section title="FormField (label + input + error)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <FormField label="Campaign Name" htmlFor="demo-name" required>
              <TextInput id="demo-name" placeholder="The Lost Mines" />
            </FormField>
            <FormField
              label="System"
              htmlFor="demo-system"
              hint="Which ruleset are you using?"
            >
              <TextInput id="demo-system" placeholder="D&D 5e" />
            </FormField>
            <FormField
              label="Description"
              htmlFor="demo-desc"
              error="Description must be at least 10 characters."
            >
              <Textarea id="demo-desc" placeholder="Describe your campaign…" error rows={3} />
            </FormField>
          </div>
        </Section>

        {/* ── AI inputs ─────────────────────────────────── */}
        <Section title="AI inputs (AITextInput / AITextarea)">
          <p className="text-sm text-ink-500 -mt-2">
            Sparkle button calls <code>/api/ai/generate-field</code> with campaign context + the current draft.
            Paste a real campaign id you own (DM role required) to try it live. Requires <code>ANTHROPIC_API_KEY</code> on the API.
          </p>
          <FormField
            label="Demo campaign id"
            htmlFor="ai-demo-campaign"
            hint="UUID of a campaign where you are the DM."
          >
            <TextInput
              id="ai-demo-campaign"
              value={aiDemoCampaignId}
              onChange={(e) => setAiDemoCampaignId(e.target.value)}
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <FormField label="NPC name" htmlFor="ai-demo-npc-name">
              <AITextInput
                id="ai-demo-npc-name"
                campaignId={aiDemoCampaignId}
                entityType="npc"
                fieldName="name"
                entityDraft={{ name: aiDemoNpcName }}
                value={aiDemoNpcName}
                onChange={(e) => setAiDemoNpcName(e.target.value)}
                placeholder="Click the sparkle to generate…"
              />
            </FormField>
            <FormField label="Character backstory" htmlFor="ai-demo-backstory">
              <AITextarea
                id="ai-demo-backstory"
                campaignId={aiDemoCampaignId}
                entityType="character"
                fieldName="backstory"
                entityDraft={{ backstory: aiDemoBackstory }}
                value={aiDemoBackstory}
                onChange={(e) => setAiDemoBackstory(e.target.value)}
                rows={5}
                placeholder="Click the sparkle to generate…"
              />
            </FormField>
          </div>
        </Section>

        {/* ── Loading States ────────────────────────────── */}
        <Section title="Loading States">
          <Row label="Spinner sizes">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </Row>
          <Row label="Skeleton variants">
            <div className="flex flex-col gap-2 w-64">
              <Skeleton variant="text" />
              <Skeleton variant="text" className="w-3/4" />
              <Skeleton variant="rect" className="h-24 w-full" />
              <div className="flex items-center gap-3">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="flex-1 flex flex-col gap-1">
                  <Skeleton variant="text" />
                  <Skeleton variant="text" className="w-2/3" />
                </div>
              </div>
            </div>
          </Row>
        </Section>

        {/* ── Empty State ───────────────────────────────── */}
        <Section title="Empty State">
          <Row label="Without action">
            <Card className="w-72">
              <EmptyState title="No sessions yet" description="Sessions you create will appear here." />
            </Card>
          </Row>
          <Row label="With action + custom icon">
            <Card className="w-72">
              <EmptyState
                title="No campaigns found"
                description="Create your first campaign to get started."
                action={{ label: 'Create Campaign', onClick: () => {} }}
                icon={<Sword className="h-10 w-10" />}
              />
            </Card>
          </Row>
        </Section>

        {/* ── Error Display ─────────────────────────────── */}
        <Section title="Error Display">
          <Row label="Without retry">
            <div className="w-72">
              <ErrorDisplay title="Failed to load" message="Could not connect to the server." />
            </div>
          </Row>
          <Row label="With retry">
            <div className="w-72">
              <ErrorDisplay
                title="Something went wrong"
                message="An unexpected error occurred."
                onRetry={() => {}}
              />
            </div>
          </Row>
        </Section>

        {/* ── Modals ────────────────────────────────────── */}
        <Section title="Modals">
          <Row label="General modal">
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          </Row>
          <Row label="Confirmation modal">
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete Something
            </Button>
          </Row>
        </Section>

      </main>

      {/* Live modal demos */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Example Modal"
        description="This is an optional subtitle for the modal."
      >
        <p className="text-sm text-ink-700">
          Modal content goes here. The backdrop click and Escape key both close this dialog.
          Focus is trapped inside while open.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setModalOpen(false)}>
            Save
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Delete item?"
        message="This action cannot be undone. The item will be permanently removed."
        confirmLabel="Delete"
      />
    </div>
  );
}
