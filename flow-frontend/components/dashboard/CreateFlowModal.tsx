'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Network,
  GitFork,
  Database,
  Layers,
  FilePlus,
  Check,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { DiagramCategory } from '@/types/diagram';
import { STARTER_TEMPLATES } from '@/lib/templates';

interface CreateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (params: {
    title: string;
    description: string;
    category: DiagramCategory;
    tags: string[];
    templateId?: string;
    gridType?: 'dots' | 'lines' | 'cross' | 'none';
    defaultEdgeType?: 'smoothstep' | 'bezier' | 'straight';
  }) => void;
}

const SAMPLE_NAMES = [
  'Kubernetes Ingress & Mesh Architecture',
  'User Registration & Auth State Machine',
  'Multi-Tenant Enterprise ER Diagram',
  'High-Throughput Payment Pipeline',
  'Real-Time Chat Webhook Event Flow',
  'Global CDN & Edge Compute Network',
];

export function CreateFlowModal({ isOpen, onClose, onCreate }: CreateFlowModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DiagramCategory>('system-design');
  const [templateId, setTemplateId] = useState<string>('template-microservices');
  const [tagsInput, setTagsInput] = useState('');
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'cross' | 'none'>('dots');
  const [defaultEdgeType, setDefaultEdgeType] = useState<'smoothstep' | 'bezier' | 'straight'>('smoothstep');

  if (!isOpen) return null;

  const handleRandomizeTitle = () => {
    const randomName = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    setTitle(randomName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || 'Untitled Diagram';
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    onCreate({
      title: finalTitle,
      description,
      category,
      tags,
      templateId,
      gridType,
      defaultEdgeType,
    });
  };

  const templatesList = [
    {
      id: 'blank',
      title: 'Blank Canvas',
      description: 'Start with a clean slate and build your own nodes from scratch.',
      category: 'general' as DiagramCategory,
      badge: 'Empty',
    },
    ...STARTER_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      badge: t.category === 'system-design' ? 'Microservices' : t.category === 'flowchart' ? 'Logic Flow' : 'Relational ER',
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create New Diagram Flow</h2>
              <p className="text-xs text-slate-500">
                Choose a diagram type, start with a template or blank canvas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Diagram Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Diagram Name</label>
              <button
                type="button"
                onClick={handleRandomizeTitle}
                className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Suggest Name</span>
              </button>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Payment Gateway & Kafka Broker"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder-slate-400"
              autoFocus
            />
          </div>

          {/* Diagram Category Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">Diagram Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'system-design', label: 'System Design', icon: <Network className="w-4 h-4 text-indigo-600" /> },
                { id: 'flowchart', label: 'Flowchart', icon: <GitFork className="w-4 h-4 text-amber-600" /> },
                { id: 'er-diagram', label: 'ER Diagram', icon: <Database className="w-4 h-4 text-emerald-600" /> },
                { id: 'general', label: 'General Canvas', icon: <Layers className="w-4 h-4 text-slate-600" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id as DiagramCategory)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    category === item.id
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    {item.icon}
                    {category === item.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Starter Template Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Starter Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {templatesList.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    templateId === tpl.id
                      ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {tpl.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                      {tpl.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Background Grid */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Background Style
              </label>
              <select
                value={gridType}
                onChange={(e) => setGridType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
              >
                <option value="dots">Dots Grid (Default)</option>
                <option value="lines">Lines / Blueprint Grid</option>
                <option value="cross">Cross Pattern</option>
                <option value="none">Plain White (Clean)</option>
              </select>
            </div>

            {/* Edge Style */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Default Connection Line
              </label>
              <select
                value={defaultEdgeType}
                onChange={(e) => setDefaultEdgeType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800"
              >
                <option value="smoothstep">SmoothStep (Orthogonal angles)</option>
                <option value="bezier">Curved (Bezier)</option>
                <option value="straight">Straight line</option>
              </select>
            </div>
          </div>

          {/* Description & Tags */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary of this diagram..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. Production, AWS, Microservices"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm shadow-blue-500/20"
            >
              <span>Create Flow & Edit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
