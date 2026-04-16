import { useState } from 'react';
import { Sword } from 'lucide-react';
import {
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
          {colorPalette.map((group) => (
            <div key={group.name} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-ink-500 capitalize">{group.name}</p>
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
