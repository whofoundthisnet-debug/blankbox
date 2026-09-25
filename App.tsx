import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  Box,
  ChevronRight,
  CircleHelp,
  Crosshair,
  DoorOpen,
  Ghost,
  Keyboard,
  MousePointer2,
  Package,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Swords,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  WandSparkles,
  Redo2,
} from 'lucide-react';

type ObjectKind = 'player' | 'enemy' | 'weapon' | 'npc' | 'item';
type SpriteVariant = 'default' | 'sunset' | 'mint' | 'night';

type SceneObject = {
  id: string;
  kind: ObjectKind;
  name: string;
  x: number;
  y: number;
  sprite?: string;
  spriteVariant: SpriteVariant;
  health?: number;
  speed?: number;
  jumpPower?: number;
  enemyType?: 'Melee' | 'Ranged' | 'Patrol' | 'Stationary';
  damage?: number;
  attackCooldown?: number;
  canDoubleJump?: boolean;
  gravity?: number;
  startingX?: number;
  startingY?: number;
  fistDamage?: number;
  weaponType?: 'Melee' | 'Ranged' | 'Magic' | 'Tool';
  uses?: 'Unlimited' | '1' | '2' | '3' | 'Custom';
  customUses?: number;
  canDrop?: boolean;
  ranged?: boolean;
  projectile?: string;
  projectileSpeed?: number;
  meleeRange?: number;
  range?: number;
  cooldown?: number;
  dialogue?: string;
  npcSpeed?: number;
  itemType?: 'Coin' | 'Potion' | 'Key' | 'Power-up';
  value?: number;
  pickupHint?: string;
};

type LevelPlatform = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const objectMeta: Record<ObjectKind, {
  label: string;
  hint: string;
  icon: typeof UserRound;
  color: string;
}> = {
  player: { label: 'Player', hint: 'The hero of your game', icon: UserRound, color: '#dcd7ff' },
  enemy: { label: 'Enemy', hint: 'Something to challenge', icon: Ghost, color: '#ffdad0' },
  weapon: { label: 'Weapon', hint: 'A tool for action', icon: Swords, color: '#ffe7aa' },
  npc: { label: 'NPC', hint: 'A friendly character', icon: WandSparkles, color: '#d4f0e9' },
  item: { label: 'Item', hint: 'Something to collect', icon: Package, color: '#dcecfb' },
};

const defaultNames: Record<ObjectKind, string> = {
  player: 'Hero',
  enemy: 'Gremlin',
  weapon: 'Bubble Blaster',
  npc: 'Mira',
  item: 'Shiny Coin',
};

const spriteColors: Record<SpriteVariant, string> = {
  default: '#dcd7ff',
  sunset: '#ffb29d',
  mint: '#bce8dc',
  night: '#bdc9ed',
};

const spriteBackground = (object: SceneObject) =>
  object.sprite ? undefined : { background: spriteColors[object.spriteVariant] };

const newObject = (kind: ObjectKind, index: number): SceneObject => {
  const base: SceneObject = {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    name: defaultNames[kind],
    x: 72 + (index % 3) * 145,
    y: 72 + (Math.floor(index / 3) % 3) * 118,
    spriteVariant: kind === 'enemy' ? 'sunset' : kind === 'npc' ? 'mint' : 'default',
  };
  if (kind === 'player') return {
    ...base,
    health: 100,
    speed: 5,
    jumpPower: 8,
    canDoubleJump: false,
    gravity: 18,
    startingX: base.x,
    startingY: base.y,
    fistDamage: 8,
  };
  if (kind === 'enemy') return { ...base, health: 45, enemyType: 'Patrol', damage: 8, speed: 2, attackCooldown: 1.2 };
  if (kind === 'weapon') return {
    ...base,
    damage: 12,
    cooldown: 0.6,
    weaponType: 'Ranged',
    ranged: true,
    projectile: 'Orb',
    range: 180,
    projectileSpeed: 260,
    uses: 'Unlimited',
    canDrop: true,
  };
  if (kind === 'npc') return { ...base, dialogue: 'Welcome to my little corner.', npcSpeed: 0 };
  return { ...base, itemType: 'Coin', value: 10, pickupHint: 'Walk over me to collect.' };
};

const newPlatform = (x: number, y: number): LevelPlatform => ({
  id: `platform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  x,
  y,
  width: 180,
  height: 24,
});

function IconForObject({ kind }: { kind: ObjectKind }) {
  const Icon = objectMeta[kind].icon;
  return <Icon aria-hidden="true" />;
}

function LogoMark() {
  return <div className="bb-brand-mark" aria-hidden="true"><Box /></div>;
}

function App() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [platforms, setPlatforms] = useState<LevelPlatform[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState(false);
  const [saveLabel, setSaveLabel] = useState('All changes saved');
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [platformPast, setPlatformPast] = useState<LevelPlatform[][]>([]);
  const [platformFuture, setPlatformFuture] = useState<LevelPlatform[][]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const platformDragRef = useRef<{
    id: string;
    mode: 'move' | 'resize';
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startPlatforms: LevelPlatform[];
  } | null>(null);
  const platformsRef = useRef(platforms);

  const selected = useMemo(
    () => objects.find((object) => object.id === selectedId) ?? null,
    [objects, selectedId],
  );
  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === selectedPlatformId) ?? null,
    [platforms, selectedPlatformId],
  );
  const player = useMemo(() => objects.find((object) => object.kind === 'player'), [objects]);

  useEffect(() => {
    platformsRef.current = platforms;
  }, [platforms]);

  const showSaved = () => {
    setSaveLabel('Saving…');
    window.setTimeout(() => setSaveLabel('All changes saved'), 500);
  };

  const addObject = (kind: ObjectKind) => {
    const object = newObject(kind, objects.length);
    setObjects((current) => [...current, object]);
    setSelectedId(object.id);
    setSelectedPlatformId(null);
    setContextMenu(null);
    showSaved();
  };

  const updateObject = (id: string, changes: Partial<SceneObject>) => {
    setObjects((current) => current.map((object) => object.id === id ? { ...object, ...changes } : object));
    showSaved();
  };

  const deleteSelected = () => {
    if (!selected) return;
    setObjects((current) => current.filter((object) => object.id !== selected.id));
    setSelectedId(null);
    showSaved();
  };

  const recordPlatformChange = (previous: LevelPlatform[], next: LevelPlatform[]) => {
    setPlatformPast((current) => [...current, previous]);
    setPlatformFuture([]);
    platformsRef.current = next;
    setPlatforms(next);
    showSaved();
  };

  const commitPlatforms = (next: LevelPlatform[]) => {
    recordPlatformChange(platforms, next);
  };

  const addPlatformAt = (x: number, y: number) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    const width = 180;
    const height = 24;
    const nextPlatform = newPlatform(
      Math.max(8, Math.min((bounds?.width ?? 700) - width - 8, x)),
      Math.max(8, Math.min((bounds?.height ?? 500) - height - 8, y)),
    );
    commitPlatforms([...platforms, nextPlatform]);
    setSelectedPlatformId(nextPlatform.id);
    setSelectedId(null);
    setContextMenu(null);
  };

  const duplicateSelectedPlatform = () => {
    if (!selectedPlatform) return;
    const copy = {
      ...selectedPlatform,
      id: `platform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: selectedPlatform.x + 18,
      y: selectedPlatform.y + 18,
    };
    commitPlatforms([...platforms, copy]);
    setSelectedPlatformId(copy.id);
    setContextMenu(null);
  };

  const deleteSelectedPlatform = () => {
    if (!selectedPlatform) return;
    commitPlatforms(platforms.filter((platform) => platform.id !== selectedPlatform.id));
    setSelectedPlatformId(null);
    setContextMenu(null);
  };

  const updatePlatform = (id: string, changes: Partial<LevelPlatform>) => {
    commitPlatforms(platforms.map((platform) => platform.id === id ? { ...platform, ...changes } : platform));
  };

  const undoPlatforms = () => {
    const previous = platformPast[platformPast.length - 1];
    if (!previous) return;
    setPlatformPast((current) => current.slice(0, -1));
    setPlatformFuture((current) => [...current, platforms]);
    platformsRef.current = previous;
    setPlatforms(previous);
    setSelectedPlatformId(null);
    setContextMenu(null);
    showSaved();
  };

  const redoPlatforms = () => {
    const next = platformFuture[platformFuture.length - 1];
    if (!next) return;
    setPlatformFuture((current) => current.slice(0, -1));
    setPlatformPast((current) => [...current, platforms]);
    platformsRef.current = next;
    setPlatforms(next);
    setSelectedPlatformId(null);
    setContextMenu(null);
    showSaved();
  };

  const clearScene = () => {
    setObjects([]);
    if (platforms.length) commitPlatforms([]);
    setSelectedId(null);
    setSelectedPlatformId(null);
    setContextMenu(null);
    showSaved();
  };

  const handleSpriteUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => updateObject(selected.id, { sprite: String(reader.result) });
    reader.readAsDataURL(file);
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, object: SceneObject) => {
    if (event.button !== 0) return;
    if (!canvasRef.current) return;
    event.stopPropagation();
    setSelectedPlatformId(null);
    setContextMenu(null);
    const bounds = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      id: object.id,
      offsetX: event.clientX - bounds.left - object.x,
      offsetY: event.clientY - bounds.top - object.y,
    };
    setSelectedId(object.id);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginPlatformDrag = (
    event: ReactPointerEvent<HTMLElement>,
    platform: LevelPlatform,
    mode: 'move' | 'resize' = 'move',
  ) => {
    if (event.button !== 0 || !canvasRef.current) return;
    event.stopPropagation();
    const bounds = canvasRef.current.getBoundingClientRect();
    platformDragRef.current = {
      id: platform.id,
      mode,
      offsetX: mode === 'move' ? event.clientX - bounds.left - platform.x : 0,
      offsetY: mode === 'move' ? event.clientY - bounds.top - platform.y : 0,
      startX: platform.x,
      startY: platform.y,
      startWidth: platform.width,
      startHeight: platform.height,
      startPlatforms: platformsRef.current.map((item) => ({ ...item })),
    };
    setSelectedPlatformId(platform.id);
    setSelectedId(null);
    setContextMenu(null);
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (platformDragRef.current && canvasRef.current) {
      const drag = platformDragRef.current;
      const bounds = canvasRef.current.getBoundingClientRect();
      const current = platformsRef.current.find((platform) => platform.id === drag.id);
      if (!current) return;
      const next = drag.mode === 'move'
        ? {
          ...current,
          x: Math.max(8, Math.min(bounds.width - current.width - 8, event.clientX - bounds.left - drag.offsetX)),
          y: Math.max(8, Math.min(bounds.height - current.height - 8, event.clientY - bounds.top - drag.offsetY)),
        }
        : {
          ...current,
          width: Math.max(72, Math.min(bounds.width - current.x - 8, event.clientX - bounds.left - current.x)),
          height: Math.max(16, Math.min(120, event.clientY - bounds.top - current.y)),
        };
      const nextPlatforms = platformsRef.current.map((platform) => platform.id === drag.id ? next : platform);
      platformsRef.current = nextPlatforms;
      setPlatforms(nextPlatforms);
      return;
    }
    if (!dragRef.current || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const nextX = Math.max(8, Math.min(bounds.width - 118, event.clientX - bounds.left - dragRef.current.offsetX));
    const nextY = Math.max(8, Math.min(bounds.height - 112, event.clientY - bounds.top - dragRef.current.offsetY));
    setObjects((current) => current.map((object) => {
      if (object.id !== dragRef.current?.id) return object;
      return object.kind === 'player'
        ? { ...object, x: nextX, y: nextY, startingX: nextX, startingY: nextY }
        : { ...object, x: nextX, y: nextY };
    }));
  };

  const endDrag = () => {
    if (platformDragRef.current) {
      const drag = platformDragRef.current;
      const next = platformsRef.current;
      platformDragRef.current = null;
      setDragging(false);
      if (JSON.stringify(drag.startPlatforms) !== JSON.stringify(next)) {
        setPlatformPast((current) => [...current, drag.startPlatforms]);
        setPlatformFuture([]);
        showSaved();
      }
      return;
    }
    if (dragRef.current) showSaved();
    dragRef.current = null;
    setDragging(false);
  };

  const enterPlay = () => {
    setPlayMode(true);
  };

  const handleCanvasContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    setContextMenu({
      x: Math.max(8, Math.min(bounds.width - 178, localX)),
      y: Math.max(8, Math.min(bounds.height - 142, localY)),
      worldX: localX - 90,
      worldY: localY - 12,
    });
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setSelectedId(null);
    setSelectedPlatformId(null);
    setContextMenu(null);
  };

  if (playMode) {
    return <PlayMode objects={objects} platforms={platforms} player={player} onExit={() => setPlayMode(false)} />;
  }

  return (
    <main className="bb-app">
      <header className="bb-topbar">
        <div className="bb-brand">
          <LogoMark />
          <div>
            <div className="bb-brand-title">blankbox</div>
            <div className="bb-brand-caption">make a little game</div>
          </div>
        </div>
        <div className="bb-top-actions">
          <div className="bb-save-state"><span className="bb-save-dot" />{saveLabel}</div>
          <button className="bb-top-btn" onClick={clearScene} data-testid="button-clear-scene"><RotateCcw /> Clear scene</button>
          <button className="bb-top-btn" onClick={() => setSaveLabel('All changes saved')} data-testid="button-save-scene"><Save /> Save</button>
          <button className="bb-play-btn" onClick={enterPlay} data-testid="button-play-scene"><Play fill="currentColor" /> Play</button>
        </div>
      </header>
      <div className="bb-editor">
        <CreationSidebar onAdd={addObject} />
        <section className="bb-workspace" aria-label="Game workspace">
          <div className="bb-workspace-toolbar">
            <div className="bb-scene-label">
              <div><div className="bb-scene-name">Tiny Adventure</div><div className="bb-scene-status" data-testid="text-scene-status">{objects.length === 0 && platforms.length === 0 ? 'A brand new blank box' : `${objects.length} ${objects.length === 1 ? 'object' : 'objects'} · ${platforms.length} ${platforms.length === 1 ? 'platform' : 'platforms'}`}</div></div>
            </div>
           <div className="bb-workspace-tools">
              <button className="bb-mini-btn" onClick={undoPlatforms} disabled={!platformPast.length} title="Undo platform change" data-testid="button-undo"><Undo2 /></button>
              <button className="bb-mini-btn" onClick={redoPlatforms} disabled={!platformFuture.length} title="Redo platform change" data-testid="button-redo"><Redo2 /></button>
              <button className="bb-mini-btn" title="Select and move objects" data-testid="button-select-tool"><MousePointer2 /></button>
              <button className="bb-mini-btn" title="Help" data-testid="button-workspace-help"><CircleHelp /></button>
            </div>
          </div>
          <div
            ref={canvasRef}
            className={`bb-canvas ${dragging ? 'is-dragging' : ''}`}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
             onPointerDown={handleCanvasPointerDown}
             onContextMenu={handleCanvasContextMenu}
            data-testid="game-workspace"
          >
             {objects.length === 0 && platforms.length === 0 && <EmptyWorkspace />}
             {platforms.map((platform) => (
               <PlatformView
                 key={platform.id}
                 platform={platform}
                 selected={platform.id === selectedPlatformId}
                 onPointerDown={beginPlatformDrag}
               />
             ))}
            {objects.map((object) => (
              <SceneObjectView
                key={object.id}
                object={object}
                selected={selectedId === object.id}
                onPointerDown={beginDrag}
                onSelect={setSelectedId}
              />
            ))}
             {contextMenu && (
               <div className="bb-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()} data-testid="level-context-menu">
                 <div className="bb-context-title">Build here</div>
                 <button onClick={() => addPlatformAt(contextMenu.worldX, contextMenu.worldY)} data-testid="menu-add-platform">Add Platform</button>
                 <button onClick={duplicateSelectedPlatform} disabled={!selectedPlatform} data-testid="menu-duplicate-platform">Duplicate</button>
                 <button onClick={deleteSelectedPlatform} disabled={!selectedPlatform} className="danger" data-testid="menu-delete-platform">Delete</button>
               </div>
             )}
          </div>
          <div className="bb-canvas-footer">
             <span><MousePointer2 /> Drag objects · Right-click to add platforms</span>
             <span>{objects.length || platforms.length ? `${objects.length + platforms.length} things in your scene` : 'Start with a Player or platform'}</span>
          </div>
        </section>
        <Inspector
          object={selected}
           platform={selectedPlatform}
          onChange={updateObject}
           onPlatformChange={updatePlatform}
          onDelete={deleteSelected}
           onDeletePlatform={deleteSelectedPlatform}
          onClear={() => setSelectedId(null)}
           onClearPlatform={() => setSelectedPlatformId(null)}
          onUpload={handleSpriteUpload}
        />
      </div>
    </main>
  );
}

function CreationSidebar({ onAdd }: { onAdd: (kind: ObjectKind) => void }) {
  const kinds: ObjectKind[] = ['player', 'enemy', 'weapon', 'npc', 'item'];
  return (
    <aside className="bb-sidebar">
      <div className="bb-eyebrow">Build your world</div>
      <h1 className="bb-side-heading">Fill in the blanks</h1>
      <p className="bb-side-copy">Pick a thing to add, then give it a few details. You can always change your mind.</p>
      <div className="bb-add-list">
        {kinds.map((kind) => {
          const meta = objectMeta[kind];
          return (
            <button className="bb-add-btn" onClick={() => onAdd(kind)} key={kind} data-testid={`button-add-${kind}`}>
              <span className="bb-add-icon" style={{ background: meta.color }}><meta.icon /></span>
              <span><span className="bb-add-text">+ {meta.label}</span><span className="bb-add-hint">{meta.hint}</span></span>
            </button>
          );
        })}
      </div>
      <div className="bb-side-bottom">
        <div className="bb-tip"><strong><Sparkles size={14} /> Small steps, big games</strong>Start with one Player. Add a goal, then press Play whenever you want to try it.</div>
      </div>
    </aside>
  );
}

function EmptyWorkspace() {
  return (
    <div className="bb-canvas-empty" data-testid="empty-workspace">
      <div className="bb-empty-inner">
        <div className="bb-empty-art"><Crosshair /></div>
        <div className="bb-empty-title">Your game starts here</div>
        <div className="bb-empty-copy">Choose something from the left to place it in your world.</div>
      </div>
    </div>
  );
}

function PlatformView({
  platform,
  selected,
  onPointerDown,
}: {
  platform: LevelPlatform;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, platform: LevelPlatform, mode?: 'move' | 'resize') => void;
}) {
  return (
    <div
      className={`bb-platform ${selected ? 'selected' : ''}`}
      style={{ left: platform.x, top: platform.y, width: platform.width, height: platform.height }}
      onPointerDown={(event) => onPointerDown(event, platform)}
      data-testid={`level-platform-${platform.id}`}
      title="Drag to move platform"
    >
      <span>platform</span>
      {selected && (
        <button
          className="bb-platform-resize"
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDown(event, platform, 'resize');
          }}
          aria-label="Resize platform"
          data-testid={`resize-platform-${platform.id}`}
        />
      )}
    </div>
  );
}

function SceneObjectView({
  object,
  selected,
  onPointerDown,
  onSelect,
}: {
  object: SceneObject;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, object: SceneObject) => void;
  onSelect: (id: string) => void;
}) {
  const style = { left: `${object.x}px`, top: `${object.y}px` };
  return (
    <div
      className={`bb-object ${object.kind} ${selected ? 'selected' : ''}`}
      style={style}
      onPointerDown={(event) => onPointerDown(event, object)}
      onClick={(event) => { event.stopPropagation(); onSelect(object.id); }}
      data-testid={`scene-object-${object.id}`}
      title={`Select ${object.name}`}
    >
      <div className="bb-object-visual" style={spriteBackground(object)}>
        {object.sprite ? <img src={object.sprite} alt={`${object.name} sprite`} /> : <IconForObject kind={object.kind} />}
      </div>
      <div className="bb-object-name">{object.name}</div>
      <div className="bb-object-type">{objectMeta[object.kind].label}</div>
    </div>
  );
}

function Inspector({
  object,
  platform,
  onChange,
  onPlatformChange,
  onDelete,
  onDeletePlatform,
  onClear,
  onClearPlatform,
  onUpload,
}: {
  object: SceneObject | null;
  platform: LevelPlatform | null;
  onChange: (id: string, changes: Partial<SceneObject>) => void;
  onPlatformChange: (id: string, changes: Partial<LevelPlatform>) => void;
  onDelete: () => void;
  onDeletePlatform: () => void;
  onClear: () => void;
  onClearPlatform: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!object && platform) {
    return (
      <aside className="bb-inspector">
        <div className="bb-inspector-header">
          <div><div className="bb-inspector-title">Edit Platform</div><div className="bb-inspector-sub">Shape your level</div></div>
          <button className="bb-clear-btn" onClick={onClearPlatform} title="Close platform properties" data-testid="button-close-platform-properties"><ChevronRight /></button>
        </div>
        <div className="bb-form" data-testid={`properties-${platform.id}`}>
          <div className="bb-platform-note">Drag the platform to move it. Use the corner handle to resize it.</div>
          <div className="bb-number-row">
            <NumberField label="Width" value={platform.width} onChange={(value) => onPlatformChange(platform.id, { width: Math.max(72, value) })} suffix="pixels" testId={`input-platform-width-${platform.id}`} />
            <NumberField label="Height" value={platform.height} onChange={(value) => onPlatformChange(platform.id, { height: Math.max(16, value) })} suffix="pixels" testId={`input-platform-height-${platform.id}`} />
          </div>
          <div className="bb-number-row">
            <NumberField label="Position X" value={platform.x} onChange={(value) => onPlatformChange(platform.id, { x: Math.max(8, value) })} suffix="pixels" testId={`input-platform-x-${platform.id}`} />
            <NumberField label="Position Y" value={platform.y} onChange={(value) => onPlatformChange(platform.id, { y: Math.max(8, value) })} suffix="pixels" testId={`input-platform-y-${platform.id}`} />
          </div>
          <button className="bb-delete-btn" onClick={onDeletePlatform} data-testid={`button-delete-platform-${platform.id}`}><Trash2 size={14} /> Remove platform</button>
        </div>
      </aside>
    );
  }
  if (!object) {
    return (
      <aside className="bb-inspector">
        <div className="bb-inspector-header"><div><div className="bb-inspector-title">Properties</div><div className="bb-inspector-sub">Choose an object to edit it</div></div></div>
        <div className="bb-no-selection" data-testid="empty-properties">
          <div><div className="bb-no-selection-icon"><Pencil /></div><h3>Nothing selected yet</h3><p>Add a character or click something in the workspace to see its blanks here.</p></div>
        </div>
      </aside>
    );
  }
  return (
    <aside className="bb-inspector">
      <div className="bb-inspector-header">
        <div><div className="bb-inspector-title">Edit {objectMeta[object.kind].label}</div><div className="bb-inspector-sub">Make this object yours</div></div>
        <button className="bb-clear-btn" onClick={onClear} title="Close properties" data-testid="button-close-properties"><ChevronRight /></button>
      </div>
      <div className="bb-form" data-testid={`properties-${object.id}`}>
        <Field label="Name" note="shown in your game">
          <input className="bb-input" value={object.name} onChange={(event) => onChange(object.id, { name: event.target.value })} data-testid={`input-name-${object.id}`} />
        </Field>
        <SpriteField object={object} onChange={onChange} onUpload={onUpload} />
        <div className="bb-divider" />
        {object.kind === 'player' && <PlayerFields object={object} onChange={onChange} />}
        {object.kind === 'enemy' && <EnemyFields object={object} onChange={onChange} />}
        {object.kind === 'weapon' && <WeaponFields object={object} onChange={onChange} />}
        {object.kind === 'npc' && <NpcFields object={object} onChange={onChange} />}
        {object.kind === 'item' && <ItemFields object={object} onChange={onChange} />}
        <button className="bb-delete-btn" onClick={onDelete} data-testid={`button-delete-${object.id}`}><Trash2 size={14} /> Remove from scene</button>
      </div>
    </aside>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return <label className="bb-field"><span className="bb-label">{label}{note && <span className="bb-label-note">{note}</span>}</span>{children}</label>;
}

function NumberField({ label, value, onChange, suffix, testId }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; testId: string }) {
  return <Field label={label} note={suffix}><input className="bb-input" type="number" value={value} min={0} step="any" onChange={(event) => onChange(Number(event.target.value))} data-testid={testId} /></Field>;
}

function SpriteField({ object, onChange, onUpload }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <Field label="Sprite" note="upload or pick one">
      <div className="bb-sprite-picker">
        <div className="bb-sprite-preview" style={spriteBackground(object)}>{object.sprite ? <img src={object.sprite} alt="Uploaded sprite preview" /> : <IconForObject kind={object.kind} />}</div>
        <label className="bb-upload"><Upload /><span>{object.sprite ? 'Replace image' : 'Upload image'}</span><input type="file" accept="image/*" onChange={onUpload} data-testid={`input-sprite-${object.id}`} /></label>
      </div>
      <select className="bb-select" value={object.spriteVariant} onChange={(event) => onChange(object.id, { spriteVariant: event.target.value as SpriteVariant })} data-testid={`select-sprite-${object.id}`}>
        <option value="default">Built-in: Classic</option>
        <option value="sunset">Built-in: Sunset</option>
        <option value="mint">Built-in: Mint</option>
        <option value="night">Built-in: Night</option>
      </select>
    </Field>
  );
}

function PlayerFields({ object, onChange }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void }) {
  const setStartingX = (value: number) => onChange(object.id, { startingX: value, x: value });
  const setStartingY = (value: number) => onChange(object.id, { startingY: value, y: value });
  return <>
    <div className="bb-number-row">
      <NumberField label="Health" value={object.health ?? 100} onChange={(value) => onChange(object.id, { health: value })} suffix="HP" testId={`input-health-${object.id}`} />
      <NumberField label="Movement speed" value={object.speed ?? 5} onChange={(value) => onChange(object.id, { speed: value })} suffix="tiles / sec" testId={`input-speed-${object.id}`} />
    </div>
    <NumberField label="Fist damage" value={object.fistDamage ?? 8} onChange={(value) => onChange(object.id, { fistDamage: value })} suffix="per hit" testId={`input-fist-damage-${object.id}`} />
    <div className="bb-number-row">
      <NumberField label="Jump power" value={object.jumpPower ?? 8} onChange={(value) => onChange(object.id, { jumpPower: value })} suffix="strength" testId={`input-jump-${object.id}`} />
      <NumberField label="Gravity" value={object.gravity ?? 18} onChange={(value) => onChange(object.id, { gravity: value })} suffix="pull" testId={`input-gravity-${object.id}`} />
    </div>
    <label className="bb-checkbox-field">
      <input
        type="checkbox"
        checked={object.canDoubleJump ?? false}
        onChange={(event) => onChange(object.id, { canDoubleJump: event.target.checked })}
        data-testid={`input-double-jump-${object.id}`}
      />
      <span><strong>Can double jump</strong><small>Jump again before landing</small></span>
    </label>
    <div className="bb-number-row">
      <NumberField label="Starting X" value={object.startingX ?? object.x} onChange={setStartingX} suffix="pixels" testId={`input-starting-x-${object.id}`} />
      <NumberField label="Starting Y" value={object.startingY ?? object.y} onChange={setStartingY} suffix="pixels" testId={`input-starting-y-${object.id}`} />
    </div>
  </>;
}

function EnemyFields({ object, onChange }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void }) {
  return <>
    <div className="bb-number-row">
      <NumberField label="Health" value={object.health ?? 45} onChange={(value) => onChange(object.id, { health: value })} suffix="HP" testId={`input-health-${object.id}`} />
      <NumberField label="Damage" value={object.damage ?? 8} onChange={(value) => onChange(object.id, { damage: value })} suffix="per hit" testId={`input-damage-${object.id}`} />
    </div>
      <Field label="Enemy type"><select className="bb-select" value={object.enemyType} onChange={(event) => onChange(object.id, { enemyType: event.target.value as SceneObject['enemyType'] })} data-testid={`select-enemy-type-${object.id}`}><option>Melee</option><option>Ranged</option><option>Patrol</option><option>Stationary</option></select></Field>
    <div className="bb-number-row">
      <NumberField label="Movement speed" value={object.speed ?? 2} onChange={(value) => onChange(object.id, { speed: value })} suffix="tiles / sec" testId={`input-speed-${object.id}`} />
      <NumberField label="Attack cooldown" value={object.attackCooldown ?? 1.2} onChange={(value) => onChange(object.id, { attackCooldown: value })} suffix="seconds" testId={`input-cooldown-${object.id}`} />
    </div>
  </>;
}

function WeaponFields({ object, onChange }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void }) {
  const isRanged = object.ranged ?? object.weaponType === 'Ranged';
  const uses = object.uses ?? 'Unlimited';
  return <>
    <Field label="Weapon type">
      <select
        className="bb-select"
        value={object.weaponType ?? (isRanged ? 'Ranged' : 'Melee')}
        onChange={(event) => {
          const weaponType = event.target.value as SceneObject['weaponType'];
          onChange(object.id, { weaponType, ranged: weaponType === 'Ranged' ? true : weaponType === 'Melee' ? false : object.ranged ?? false });
        }}
        data-testid={`select-weapon-type-${object.id}`}
      >
        <option>Melee</option>
        <option>Ranged</option>
        <option>Magic</option>
        <option>Tool</option>
      </select>
    </Field>
    <div className="bb-number-row">
      <NumberField label="Damage" value={object.damage ?? 12} onChange={(value) => onChange(object.id, { damage: value })} suffix="per hit" testId={`input-damage-${object.id}`} />
      <NumberField label="Attack cooldown" value={object.cooldown ?? 0.6} onChange={(value) => onChange(object.id, { cooldown: value })} suffix="seconds" testId={`input-cooldown-${object.id}`} />
    </div>
    <Field label="Uses" note="how many attacks">
      <select className="bb-select" value={uses} onChange={(event) => onChange(object.id, { uses: event.target.value as SceneObject['uses'] })} data-testid={`select-weapon-uses-${object.id}`}>
        <option>Unlimited</option>
        <option value="1">1 use</option>
        <option value="2">2 uses</option>
        <option value="3">3 uses</option>
        <option>Custom</option>
      </select>
    </Field>
    {uses === 'Custom' && <NumberField label="Custom uses" value={object.customUses ?? 5} onChange={(value) => onChange(object.id, { customUses: Math.max(1, value) })} suffix="uses" testId={`input-custom-uses-${object.id}`} />}
    <Field label="Can be dropped?">
      <select className="bb-select" value={object.canDrop === false ? 'No' : 'Yes'} onChange={(event) => onChange(object.id, { canDrop: event.target.value === 'Yes' })} data-testid={`select-weapon-drop-${object.id}`}>
        <option>Yes</option>
        <option>No</option>
      </select>
    </Field>
    <Field label="Ranged?">
      <select className="bb-select" value={isRanged ? 'Yes' : 'No'} onChange={(event) => onChange(object.id, { ranged: event.target.value === 'Yes' })} data-testid={`select-weapon-ranged-${object.id}`}>
        <option>Yes</option>
        <option>No</option>
      </select>
    </Field>
    {isRanged ? <>
      <Field label="Projectile">
        <select className="bb-select" value={object.projectile ?? 'Orb'} onChange={(event) => onChange(object.id, { projectile: event.target.value })} data-testid={`select-projectile-${object.id}`}>
          <option>Orb</option>
          <option>Arrow</option>
          <option>Bolt</option>
          <option>Magic shot</option>
        </select>
      </Field>
      <div className="bb-number-row">
        <NumberField label="Range" value={object.range ?? 180} onChange={(value) => onChange(object.id, { range: value })} suffix="pixels" testId={`input-range-${object.id}`} />
        <NumberField label="Projectile speed" value={object.projectileSpeed ?? 260} onChange={(value) => onChange(object.id, { projectileSpeed: value })} suffix="pixels / sec" testId={`input-projectile-speed-${object.id}`} />
      </div>
    </> : (
      <NumberField label="Melee range" value={object.meleeRange ?? object.range ?? 90} onChange={(value) => onChange(object.id, { meleeRange: value, range: value })} suffix="pixels" testId={`input-melee-range-${object.id}`} />
    )}
  </>;
}

function NpcFields({ object, onChange }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void }) {
  return <>
    <Field label="Dialogue" note="what they say"><input className="bb-input" value={object.dialogue ?? ''} onChange={(event) => onChange(object.id, { dialogue: event.target.value })} data-testid={`input-dialogue-${object.id}`} /></Field>
    <NumberField label="Wander speed" value={object.npcSpeed ?? 0} onChange={(value) => onChange(object.id, { npcSpeed: value })} suffix="tiles / sec" testId={`input-npc-speed-${object.id}`} />
  </>;
}

function ItemFields({ object, onChange }: { object: SceneObject; onChange: (id: string, changes: Partial<SceneObject>) => void }) {
  return <>
    <Field label="Item type"><select className="bb-select" value={object.itemType} onChange={(event) => onChange(object.id, { itemType: event.target.value as SceneObject['itemType'] })} data-testid={`select-item-type-${object.id}`}><option>Coin</option><option>Potion</option><option>Key</option><option>Power-up</option></select></Field>
    <NumberField label="Value" value={object.value ?? 10} onChange={(value) => onChange(object.id, { value })} suffix="points" testId={`input-value-${object.id}`} />
    <Field label="Pickup hint" note="optional"><input className="bb-input" value={object.pickupHint ?? ''} onChange={(event) => onChange(object.id, { pickupHint: event.target.value })} data-testid={`input-pickup-hint-${object.id}`} /></Field>
  </>;
}

type PlayEnemyState = {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  attackTimer: number;
  direction: number;
  alive: boolean;
};

type PlayWeaponState = {
  id: string;
  x: number;
  y: number;
  remainingUses: number | null;
  carried: boolean;
  active: boolean;
};

type PlayProjectileState = {
  id: string;
  x: number;
  y: number;
  direction: number;
  distance: number;
  damage: number;
  speed: number;
  range: number;
};

type PlayState = {
  playerX: number;
  playerY: number;
  playerDirection: number;
  velocityY: number;
  jumpsUsed: number;
  playerHealth: number;
  playerDamageFlash: number;
  attackFlash: number;
  attackTimer: number;
  equippedWeaponId: string | null;
  weapons: PlayWeaponState[];
  projectiles: PlayProjectileState[];
  enemies: PlayEnemyState[];
  items : PlayItemState[];
  gameOver: boolean;
};

const clampPlay = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const playX = (value: number) => clampPlay(value / 7, 3, 90);
const playY = (value: number) => clampPlay(value / 5, 10, 72);

 function PlayMode({ objects, platforms, player, onExit }: { objects: SceneObject[]; platforms: LevelPlatform[]; player: SceneObject | undefined; onExit: () => void }) {
  const keysRef = useRef(new Set<string>());
  const jumpRequestedRef = useRef(false);
  const attackRequestedRef = useRef(false);
  const dropRequestedRef = useRef(false);

  const weaponUses = (weapon: SceneObject): number | null => {
    if ((weapon.uses ?? 'Unlimited') === 'Unlimited') return null;
    if (weapon.uses === 'Custom') return Math.max(1, Math.floor(weapon.customUses ?? 5));
    return Number(weapon.uses ?? 1);
  };

  const weaponIsRanged = (weapon: SceneObject) => weapon.ranged ?? weapon.weaponType === 'Ranged';

  const getInitialState = (): PlayState => ({
    playerX: player ? playX(player.startingX ?? player.x) : 10,
    playerY: player ? playY(player.startingY ?? player.y) : 66,
    playerDirection: 1,
    velocityY: 0,
    jumpsUsed: 0,
    playerHealth: Math.max(0, player?.health ?? 100),
    playerDamageFlash: 0,
    attackFlash: 0,
    attackTimer: 0,
    equippedWeaponId: null,
    weapons: objects.filter((object) => object.kind === 'weapon').map((object) => ({
      id: object.id,
      x: playX(object.x),
      y: playY(object.y),
      remainingUses: weaponUses(object),
      carried: false,
      active: true,
    })),
    projectiles: [],
    enemies: objects.filter((object) => object.kind === 'enemy').map((object) => {
      const maxHealth = Math.max(0, object.health ?? 45);
      return {
        id: object.id,
        x: playX(object.x),
        y: playY(object.y),
        health: maxHealth,
        maxHealth,
        attackTimer: 0,
        direction: 1,
        alive: maxHealth > 0,
      };
    }),
    gameOver: Boolean(player && (player.health ?? 100) <= 0),
  });

  const [playState, setPlayState] = useState<PlayState>(() => getInitialState());
  const playStateRef = useRef(playState);

  useEffect(() => {
    playStateRef.current = playState;
  }, [playState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) attackRequestedRef.current = true;
        return;
      }
      if (key === 'q') {
        event.preventDefault();
        if (!event.repeat) dropRequestedRef.current = true;
        return;
      }
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's'].includes(key)) return;
      event.preventDefault();
      if (!event.repeat && (key === 'arrowup' || key === 'w')) jumpRequestedRef.current = true;
      keysRef.current.add(key);
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let previousTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - previousTime) / 1000));
      previousTime = time;
      const current = playStateRef.current;

      if (!current.gameOver) {
        const keys = keysRef.current;
        const left = keys.has('arrowleft') || keys.has('a');
        const right = keys.has('arrowright') || keys.has('d');
        const down = keys.has('arrowdown') || keys.has('s');
        const movementSpeed = Math.max(0, player?.speed ?? 5) * 4.5;
        let playerX = clampPlay(current.playerX + (right ? movementSpeed : 0) * delta - (left ? movementSpeed : 0) * delta, 3, 90);
        let playerY = current.playerY;
        let playerDirection = current.playerDirection;
        let velocityY = current.velocityY;
        let jumpsUsed = current.jumpsUsed;
        const floorY = 72;
        const playerWidth = 6;
        const playerHeight = 8;
        const gravity = Math.max(0, player?.gravity ?? 18);
        const jumpPower = Math.max(0, player?.jumpPower ?? 8);
        if (right && !left) playerDirection = 1;
        if (left && !right) playerDirection = -1;

        if (jumpRequestedRef.current) {
          if (playerY >= floorY - 0.4) {
            velocityY = -jumpPower * 1.35;
            jumpsUsed = 1;
          } else if (player?.canDoubleJump && jumpsUsed < 2) {
            velocityY = -jumpPower * 1.35;
            jumpsUsed = 2;
          }
          jumpRequestedRef.current = false;
        }

        if (down && playerY >= floorY - 0.4) playerY = clampPlay(playerY + movementSpeed * 0.35 * delta, 10, floorY);
        velocityY += gravity * delta;
        const previousY = playerY;
        const nextY = playerY + velocityY * delta;
        const playerLeft = playerX;
        const playerRight = playerX + playerWidth;
        const landingPlatform = velocityY >= 0
          ? platforms
            .map((platform) => ({
              top: clampPlay(platform.y / 5, 8, floorY),
              left: clampPlay(platform.x / 7, 0, 94),
              right: clampPlay((platform.x + platform.width) / 7, 6, 100),
            }))
            .sort((a, b) => a.top - b.top)
            .find((platform) =>
              previousY + playerHeight <= platform.top + 0.5
              && nextY + playerHeight >= platform.top
              && playerRight > platform.left
              && playerLeft < platform.right
            )
          : undefined;

        if (landingPlatform) {
          playerY = landingPlatform.top - playerHeight;
          velocityY = 0;
          jumpsUsed = 0;
        } else {
          playerY = nextY;
        }
        if (!landingPlatform && playerY >= floorY) {
          playerY = floorY;
          velocityY = 0;
          jumpsUsed = 0;
        }

        let attackFlash = Math.max(0, current.attackFlash - delta);
        let attackTimer = Math.max(0, current.attackTimer - delta);
        let enemies = current.enemies;
        let weapons = current.weapons;
        let projectiles = current.projectiles;
        let equippedWeaponId = current.equippedWeaponId;
        let justDropped = false;

        if (dropRequestedRef.current) {
          dropRequestedRef.current = false;
          const equipped = equippedWeaponId ? objects.find((object) => object.id === equippedWeaponId) : undefined;
          if (equipped && equipped.canDrop !== false) {
            weapons = weapons.map((weapon) => weapon.id === equipped.id
              ? { ...weapon, x: playerX, y: playerY, carried: false }
              : weapon);
            equippedWeaponId = null;
            justDropped = true;
          }
        }

        if (!equippedWeaponId && !justDropped) {
          const pickup = weapons.find((weapon) =>
            weapon.active
            && !weapon.carried
            && Math.abs(weapon.x - playerX) < 8
            && Math.abs(weapon.y - playerY) < 11,
          );
          if (pickup) {
            equippedWeaponId = pickup.id;
            weapons = weapons.map((weapon) => weapon.id === pickup.id ? { ...weapon, carried: true } : weapon);
          }
        }

        const equippedWeapon = equippedWeaponId ? objects.find((object) => object.id === equippedWeaponId) : undefined;
        if (attackRequestedRef.current) {
          attackRequestedRef.current = false;
          if (attackTimer <= 0) {
            const ranged = Boolean(equippedWeapon && weaponIsRanged(equippedWeapon));
            const damage = Math.max(0, equippedWeapon?.damage ?? player?.fistDamage ?? 8);
            const cooldown = Math.max(0.05, equippedWeapon?.cooldown ?? 0.45);
            attackTimer = cooldown;
            attackFlash = 0.18;

            if (ranged && equippedWeapon) {
              projectiles = [
                ...projectiles,
                {
                  id: `projectile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  x: clampPlay(playerX + playerDirection * 4, 3, 94),
                  y: playerY + 3,
                  direction: playerDirection,
                  distance: 0,
                  damage,
                  speed: Math.max(20, (equippedWeapon.projectileSpeed ?? 260) / 7),
                  range: Math.max(12, (equippedWeapon.range ?? 180) / 7),
                },
              ];
            } else {
              const attackRange = Math.max(4, (equippedWeapon?.meleeRange ?? equippedWeapon?.range ?? 36) / 7);
              enemies = enemies.map((enemy) => {
                const relativeX = (enemy.x - playerX) * playerDirection;
                const inAttackArea = enemy.alive
                  && relativeX > -2
                  && relativeX <= attackRange
                  && Math.abs(enemy.y - playerY) < 12;
                if (!inAttackArea) return enemy;
                const health = Math.max(0, enemy.health - damage);
                return { ...enemy, health, alive: health > 0 };
              });
            }

            if (equippedWeapon) {
              const used = weapons.find((weapon) => weapon.id === equippedWeapon.id);
              if (used?.remainingUses !== null && used?.remainingUses !== undefined) {
                const remainingUses = Math.max(0, used.remainingUses - 1);
                weapons = weapons.map((weapon) => weapon.id === equippedWeapon.id ? { ...weapon, remainingUses, active: remainingUses > 0 } : weapon);
                if (remainingUses === 0) equippedWeaponId = null;
              }
            }
          }
        }

        let playerHealth = current.playerHealth;
        let playerDamageFlash = Math.max(0, current.playerDamageFlash - delta);
        enemies = enemies.map((enemy) => {
          if (!enemy.alive) return enemy;
          let nextX = enemy.x;
          let nextY = enemy.y;
          let direction = enemy.direction;
          const enemySpeed = Math.max(0, objects.find((object) => object.id === enemy.id)?.speed ?? 2) * 2.2;
          const source = objects.find((object) => object.id === enemy.id);
          const enemyType = source?.enemyType ?? 'Patrol';

          if (enemyType === 'Melee') {
            nextX = clampPlay(nextX + Math.sign(playerX - nextX) * enemySpeed * delta, 3, 90);
            nextY = clampPlay(nextY + Math.sign(playerY - nextY) * enemySpeed * 0.45 * delta, 10, floorY);
          } else if (enemyType === 'Patrol') {
            nextX += direction * enemySpeed * delta;
            if (nextX > 86 || nextX < 8) {
              direction *= -1;
              nextX = clampPlay(nextX, 8, 86);
            }
          }

          const distance = Math.hypot(nextX - playerX, nextY - playerY);
          const touchingPlayer = Math.abs(nextX - playerX) < 8 && Math.abs(nextY - playerY) < 10;
          const canAttack = enemyType === 'Ranged' ? distance < 34 : touchingPlayer;
          let attackTimer = Math.max(0, enemy.attackTimer - delta);
          if (canAttack && attackTimer <= 0) {
            const damage = Math.max(0, source?.damage ?? 8);
            playerHealth = Math.max(0, playerHealth - damage);
            playerDamageFlash = 0.28;
            attackTimer = Math.max(0.1, source?.attackCooldown ?? 1.2);
          }
          return { ...enemy, x: nextX, y: nextY, direction, attackTimer };
        });

        const nextProjectiles: PlayProjectileState[] = [];
        projectiles.forEach((projectile) => {
          const distanceMoved = projectile.speed * delta;
          const nextX = projectile.x + projectile.direction * distanceMoved;
          const nextDistance = projectile.distance + distanceMoved;
          if (nextDistance >= projectile.range) return;
          const hitEnemy = enemies.find((enemy) =>
            enemy.alive
            && Math.abs(enemy.x - nextX) < 5
            && Math.abs(enemy.y - projectile.y) < 10,
          );
          if (hitEnemy) {
            enemies = enemies.map((enemy) => {
              if (enemy.id !== hitEnemy.id) return enemy;
              const health = Math.max(0, enemy.health - projectile.damage);
              return { ...enemy, health, alive: health > 0 };
            });
            return;
          }
          nextProjectiles.push({ ...projectile, x: nextX, distance: nextDistance });
        });

        const nextState: PlayState = {
          ...current,
          playerX,
          playerY,
          playerDirection,
          velocityY,
          jumpsUsed,
          playerHealth,
          playerDamageFlash,
          attackFlash,
          attackTimer,
          equippedWeaponId,
          weapons,
          projectiles: nextProjectiles,
          enemies,
          gameOver: Boolean(player && playerHealth <= 0),
        };
        playStateRef.current = nextState;
        setPlayState(nextState);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keysRef.current.clear();
    };
  }, [objects, platforms, player]);

  const restart = () => {
    const next = getInitialState();
    playStateRef.current = next;
    setPlayState(next);
  };
  const playerMaxHealth = Math.max(1, player?.health ?? 100);
  const equippedWeapon = playState.equippedWeaponId ? objects.find((object) => object.id === playState.equippedWeaponId) : undefined;
  const equippedWeaponState = playState.equippedWeaponId ? playState.weapons.find((weapon) => weapon.id === playState.equippedWeaponId) : undefined;

  return (
    <main className="bb-play-shell">
      <header className="bb-play-top">
        <div className="bb-play-brand"><LogoMark /> BlankBox <span style={{ opacity: .48, fontWeight: 500 }}>/ playtest</span></div>
        <div className="bb-play-header-actions">
          <div className="bb-play-weapon-hud" data-testid="play-equipped-weapon">
            <Swords size={13} />
            <strong>{equippedWeapon?.name ?? 'Fists'}</strong>
            {equippedWeaponState?.remainingUses !== null && equippedWeaponState?.remainingUses !== undefined && <span>{equippedWeaponState.remainingUses} uses</span>}
          </div>
          <div className="bb-play-hud-health" aria-label={`Player health ${Math.ceil(playState.playerHealth)} of ${playerMaxHealth}`}>
            <span>HP</span>
            <div className="bb-play-health-track"><span style={{ width: `${clampPlay((playState.playerHealth / playerMaxHealth) * 100, 0, 100)}%` }} /></div>
            <strong>{Math.ceil(playState.playerHealth)} / {playerMaxHealth}</strong>
          </div>
          <button className="bb-exit-btn" onClick={onExit} data-testid="button-exit-play"><DoorOpen /> Back to editor</button>
        </div>
      </header>
      <div className="bb-play-main">
        <div className="bb-play-stage" data-testid="play-stage" tabIndex={0}>
          <div className="bb-play-title">Tiny Adventure</div>
          <div className="bb-play-controls"><span><Keyboard size={12} /> Move</span><span><kbd>Space</kbd> Attack</span><span><kbd>W</kbd> Jump</span><span><kbd>Q</kbd> Drop</span></div>
          <div className="bb-play-floor" />
          {platforms.map((platform) => (
            <div
              className="bb-play-platform"
              key={platform.id}
              style={{
                left: `${clampPlay(platform.x / 7, 0, 94)}%`,
                top: `${clampPlay(platform.y / 5, 8, 72)}%`,
                width: `${clampPlay(platform.width / 7, 10, 96)}%`,
                height: `${clampPlay(platform.height / 5, 3, 14)}%`,
              }}
              data-testid={`play-platform-${platform.id}`}
            />
          ))}
          {player && (
            <div className={`bb-play-object bb-play-player ${playState.playerDamageFlash > 0 ? 'is-hit' : ''} ${playState.attackFlash > 0 ? 'is-attacking' : ''}`} style={{ left: `${playState.playerX}%`, top: `${playState.playerY}%` }} data-testid={`play-object-${player.id}`}>
              <div className="bb-object-visual" style={{ ...spriteBackground(player), color: '#424760' }}>{player.sprite ? <img src={player.sprite} alt="" /> : <IconForObject kind="player" />}</div>
              <div className="bb-object-name">{player.name}</div>
              <div className="bb-object-type">player</div>
            </div>
          )}
          {playState.enemies.map((enemy) => {
            const source = objects.find((object) => object.id === enemy.id);
            if (!source || !enemy.alive) return null;
            return (
              <div className="bb-play-object bb-play-enemy" key={enemy.id} style={{ left: `${enemy.x}%`, top: `${enemy.y}%` }} data-testid={`play-object-${enemy.id}`}>
                <div className="bb-play-healthbar"><span style={{ width: `${clampPlay((enemy.health / Math.max(1, enemy.maxHealth)) * 100, 0, 100)}%` }} /></div>
                <div className="bb-object-visual" style={{ ...spriteBackground(source), color: '#424760' }}>{source.sprite ? <img src={source.sprite} alt="" /> : <IconForObject kind="enemy" />}</div>
                <div className="bb-object-name">{source.name}</div>
                <div className="bb-object-type">{source.enemyType}</div>
              </div>
            );
          })}
          {playState.projectiles.map((projectile) => (
            <div
              className="bb-play-projectile"
              key={projectile.id}
              style={{ left: `${projectile.x}%`, top: `${projectile.y}%` }}
              data-testid={`play-projectile-${projectile.id}`}
            />
          ))}
          {playState.weapons.filter((weapon) => weapon.active && !weapon.carried).map((weapon) => {
            const source = objects.find((object) => object.id === weapon.id);
            if (!source) return null;
            return (
              <div className="bb-play-object bb-play-weapon" key={weapon.id} style={{ left: `${weapon.x}%`, top: `${weapon.y}%` }} data-testid={`play-weapon-${weapon.id}`}>
                <div className="bb-object-visual" style={{ ...spriteBackground(source), color: '#424760' }}>{source.sprite ? <img src={source.sprite} alt="" /> : <IconForObject kind="weapon" />}</div>
                <div className="bb-object-name">{source.name}</div>
                <div className="bb-object-type">walk over to equip</div>
              </div>
            );
          })}
          {objects.filter((object) => object.kind !== 'player' && object.kind !== 'enemy' && object.kind !== 'weapon').map((object) => (
            <div className="bb-play-object" key={object.id} style={{ left: `${playX(object.x)}%`, top: `${playY(object.y)}%` }} data-testid={`play-object-${object.id}`}>
              <div className="bb-object-visual" style={{ ...spriteBackground(object), color: '#424760' }}>{object.sprite ? <img src={object.sprite} alt="" /> : <IconForObject kind={object.kind} />}</div>
              <div className="bb-object-name">{object.name}</div>
              <div className="bb-object-type">{object.kind}</div>
            </div>
          ))}
          {!player && <div className="bb-play-empty">Add a Player in the editor to control your character.</div>}
          {playState.gameOver && (
            <div className="bb-play-overlay">
              <div className="bb-play-overlay-card">
                <div className="bb-play-overlay-kicker">Your hero needs a reset</div>
                <h2>Game over</h2>
                <p>The enemies dealt enough damage to bring your health to zero.</p>
                <button className="bb-play-retry" onClick={restart}><RotateCcw size={14} /> Try again</button>
              </div>
            </div>
          )}
          <div className="bb-play-help"><Keyboard size={12} /> Move with W A S D · Space attacks with {equippedWeapon?.name ?? 'fists'} · walk over weapons to equip · Q drops</div>
        </div>
      </div>
    </main>
  );
}

export default App;
