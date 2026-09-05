'use client';

import React, { useState } from 'react';
import {
  Network,
  GitFork,
  Database,
  Layers,
  Search,
  Server,
  Cloud,
  Globe,
  Cpu,
  Shield,
  Radio,
  Smartphone,
  Terminal,
  ArrowLeftRight,
  Lock,
  Boxes,
  Key,
  Hash,
  Table,
  StickyNote,
  ChevronRight,
  Plus,
  User,
  Image as ImageIcon,
} from 'lucide-react';
import { DiagramCategory } from '@/types/diagram';

// A minimal inline UML "actor" stick figure — no external asset dependency,
// works offline, and is small enough to embed as a data URI.
const ACTOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 100">
  <circle cx="32" cy="14" r="12" fill="none" stroke="#334155" stroke-width="4"/>
  <line x1="32" y1="26" x2="32" y2="64" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
  <line x1="8" y1="40" x2="56" y2="40" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
  <line x1="32" y1="64" x2="10" y2="96" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
  <line x1="32" y1="64" x2="54" y2="96" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
</svg>`;
const ACTOR_DATA_URI = `data:image/svg+xml,${encodeURIComponent(ACTOR_SVG)}`;

interface PaletteItem {
  id: string;
  name: string;
  subtitle: string;
  category: 'system-design' | 'flowchart' | 'er-diagram' | 'general';
  icon: React.ReactNode;
  nodeType: string;
  data: Record<string, any>;
}

const PALETTE_ITEMS: PaletteItem[] = [
  // System Design
  {
    id: 'sys-client',
    name: 'Client App',
    subtitle: 'Web / Mobile frontend',
    category: 'system-design',
    icon: <Smartphone className="w-4 h-4 text-blue-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'Web & Mobile App',
      subtitle: 'React / Next.js / Mobile',
      icon: 'smartphone',
      category: 'Client',
      status: 'Active Clients',
      themeColor: 'blue',
    },
  },
  {
    id: 'sys-cdn',
    name: 'Edge CDN / WAF',
    subtitle: 'Cloudflare / CloudFront',
    category: 'system-design',
    icon: <Shield className="w-4 h-4 text-cyan-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'Edge CDN & WAF',
      subtitle: 'Global Anycast Caching',
      icon: 'shield',
      category: 'Security',
      status: 'Protected',
      themeColor: 'cyan',
    },
  },
  {
    id: 'sys-gateway',
    name: 'API Gateway',
    subtitle: 'Reverse proxy & auth',
    category: 'system-design',
    icon: <ArrowLeftRight className="w-4 h-4 text-indigo-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'API Gateway',
      subtitle: 'Routing & Rate Limiting',
      icon: 'arrow-left-right',
      category: 'Network',
      status: 'Port 443',
      themeColor: 'indigo',
    },
  },
  {
    id: 'sys-microservice',
    name: 'Microservice',
    subtitle: 'Node.js / Go backend',
    category: 'system-design',
    icon: <Server className="w-4 h-4 text-emerald-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'Order Service',
      subtitle: 'Go / Node.js Engine',
      icon: 'server',
      category: 'Compute',
      status: 'Port 8080',
      themeColor: 'emerald',
    },
  },
  {
    id: 'sys-postgres',
    name: 'PostgreSQL DB',
    subtitle: 'Relational ACID store',
    category: 'system-design',
    icon: <Database className="w-4 h-4 text-blue-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'PostgreSQL DB',
      subtitle: 'Primary-Replica Cluster',
      icon: 'database',
      category: 'Database',
      status: 'Postgres 16',
      themeColor: 'blue',
    },
  },
  {
    id: 'sys-redis',
    name: 'Redis Cache',
    subtitle: 'In-memory key-value',
    category: 'system-design',
    icon: <Layers className="w-4 h-4 text-rose-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'Redis Cache',
      subtitle: 'In-Memory Sub-millisecond',
      icon: 'layers',
      category: 'Database',
      status: 'Cluster v7',
      themeColor: 'rose',
    },
  },
  {
    id: 'sys-kafka',
    name: 'Kafka Queue',
    subtitle: 'Event streaming bus',
    category: 'system-design',
    icon: <Radio className="w-4 h-4 text-purple-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'Kafka Broker',
      subtitle: 'Pub/Sub Event Log',
      icon: 'radio',
      category: 'Queue',
      status: '3 Partitions',
      themeColor: 'purple',
    },
  },
  {
    id: 'sys-s3',
    name: 'Object Storage (S3)',
    subtitle: 'Blob & Media Storage',
    category: 'system-design',
    icon: <Cloud className="w-4 h-4 text-amber-600" />,
    nodeType: 'systemNode',
    data: {
      title: 'AWS S3 Bucket',
      subtitle: 'Assets & Media Storage',
      icon: 'cloud',
      category: 'Storage',
      status: 'Encrypted',
      themeColor: 'amber',
    },
  },

  // Flowchart
  {
    id: 'fc-start-end',
    name: 'Start / End',
    subtitle: 'Terminal oval point',
    category: 'flowchart',
    icon: <div className="w-4 h-2.5 rounded-full border-2 border-blue-500 bg-blue-100" />,
    nodeType: 'flowchartNode',
    data: {
      label: 'Start / End',
      shape: 'start-end',
      themeColor: 'blue',
      description: 'Flow boundary',
    },
  },
  {
    id: 'fc-process',
    name: 'Process Step',
    subtitle: 'Action / Execution box',
    category: 'flowchart',
    icon: <div className="w-4 h-3 rounded-xs border-2 border-slate-500 bg-slate-100" />,
    nodeType: 'flowchartNode',
    data: {
      label: 'Process Step',
      shape: 'process',
      themeColor: 'slate',
      description: 'Perform action or computation',
    },
  },
  {
    id: 'fc-decision',
    name: 'Decision Diamond',
    subtitle: 'Condition & Branching',
    category: 'flowchart',
    icon: <div className="w-3.5 h-3.5 rotate-45 border-2 border-amber-500 bg-amber-100" />,
    nodeType: 'flowchartNode',
    data: {
      label: 'Condition?',
      shape: 'decision',
      themeColor: 'amber',
      description: 'Yes / No branching',
    },
  },
  {
    id: 'fc-io',
    name: 'Input / Output',
    subtitle: 'Data input / output step',
    category: 'flowchart',
    icon: <div className="w-4 h-3 -skew-x-12 border-2 border-cyan-500 bg-cyan-100" />,
    nodeType: 'flowchartNode',
    data: {
      label: 'Receive Data / Output',
      shape: 'input-output',
      themeColor: 'cyan',
      description: 'Read or write payload',
    },
  },

  // ER Diagram
  {
    id: 'er-table',
    name: 'Database Table',
    subtitle: 'Entity with columns & keys',
    category: 'er-diagram',
    icon: <Table className="w-4 h-4 text-blue-600" />,
    nodeType: 'erTableNode',
    data: {
      tableName: 'new_entity',
      headerColor: 'blue',
      columns: [
        { id: 'c-1', name: 'id', type: 'UUID', isPrimary: true },
        { id: 'c-2', name: 'name', type: 'VARCHAR(255)' },
        { id: 'c-3', name: 'created_at', type: 'TIMESTAMPTZ' },
      ],
    },
  },
  {
    id: 'er-junction',
    name: 'Join / Junction Table',
    subtitle: 'Many-to-many link',
    category: 'er-diagram',
    icon: <Table className="w-4 h-4 text-emerald-600" />,
    nodeType: 'erTableNode',
    data: {
      tableName: 'entity_rel',
      headerColor: 'emerald',
      columns: [
        { id: 'j-1', name: 'id', type: 'UUID', isPrimary: true },
        { id: 'j-2', name: 'entity_a_id', type: 'UUID', isForeign: true },
        { id: 'j-3', name: 'entity_b_id', type: 'UUID', isForeign: true },
        { id: 'j-4', name: 'created_at', type: 'TIMESTAMPTZ' },
      ],
    },
  },

  // Annotations & Grouping
  {
    id: 'gen-group',
    name: 'Container / Group',
    subtitle: 'VPC / Subnet boundary',
    category: 'general',
    icon: <Boxes className="w-4 h-4 text-slate-600" />,
    nodeType: 'groupNode',
    data: {
      label: 'Cloud VPC (10.0.0.0/16)',
      stylePreset: 'slate',
    },
  },
  {
    id: 'gen-sticky',
    name: 'Sticky Note',
    subtitle: 'Documentation & notes',
    category: 'general',
    icon: <StickyNote className="w-4 h-4 text-amber-500" />,
    nodeType: 'stickyNode',
    data: {
      title: 'Note',
      text: 'Add important architecture notes or specifications here...',
      color: 'yellow',
    },
  },
  {
    id: 'gen-actor',
    name: 'Actor',
    subtitle: 'UML actor / user role',
    category: 'general',
    icon: <User className="w-4 h-4 text-slate-600" />,
    nodeType: 'imageNode',
    data: {
      src: ACTOR_DATA_URI,
      alt: 'Actor',
      fit: 'contain',
    },
  },
  {
    id: 'gen-image',
    name: 'Image / SVG',
    subtitle: 'Paste any image URL, resizable',
    category: 'general',
    icon: <ImageIcon className="w-4 h-4 text-purple-500" />,
    nodeType: 'imageNode',
    data: {
      src: '',
      alt: '',
      fit: 'contain',
    },
  },
];

interface SidebarPaletteProps {
  onAddNode: (type: string, data: any) => void;
  defaultCategory?: DiagramCategory;
  readOnly?: boolean;
}

export function SidebarPalette({
  onAddNode,
  defaultCategory = 'system-design',
  readOnly = false,
}: SidebarPaletteProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const filteredItems = PALETTE_ITEMS.filter((item) => {
    const matchesTab = activeTab === 'all' || item.category === activeTab;
    const matchesSearch =
      search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const onDragStart = (e: React.DragEvent, item: PaletteItem) => {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: item.nodeType,
        data: item.data,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-full h-full bg-white border-r border-slate-200 flex flex-col select-none z-20 shadow-2xs">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shapes & nodes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-3 pt-2.5 pb-2 border-b border-slate-100 flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px]">
        {[
          { id: 'all', label: 'All' },
          { id: 'system-design', label: 'System' },
          { id: 'flowchart', label: 'Flow' },
          { id: 'er-diagram', label: 'ER' },
          { id: 'general', label: 'General' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Node Palette List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 px-1">
          {readOnly ? 'Viewer Mode (Read-Only)' : 'Drag to canvas or click to add'}
        </div>

        <div className="space-y-1.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              draggable={!readOnly}
              onDragStart={(e) => !readOnly && onDragStart(e, item)}
              onClick={() => !readOnly && onAddNode(item.nodeType, item.data)}
              className={`group p-2 rounded-xl border border-slate-200/80 bg-white transition-all flex items-center justify-between gap-2.5 ${
                readOnly
                  ? 'opacity-75 cursor-default'
                  : 'hover:border-blue-400 hover:bg-blue-50/20 hover:shadow-xs cursor-grab active:cursor-grabbing'
              }`}
              title={readOnly ? 'Viewer Mode: Editing disabled' : 'Drag onto canvas or click to add'}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0 group-hover:bg-white group-hover:scale-105 transition-all">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {!readOnly && (
                <button
                  type="button"
                  className="w-6 h-6 rounded-md bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  title="Add to canvas"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400 italic">
              No matching nodes found
            </div>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="truncate">
          {readOnly ? '🔒 Read-only view (Viewer access)' : '💡 Connect handles to link nodes'}
        </span>
      </div>
    </aside>
  );
}
