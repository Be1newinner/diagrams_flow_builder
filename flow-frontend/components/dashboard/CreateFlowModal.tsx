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
  Loader2,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { DiagramCategory, Node, Edge } from '@/types/diagram';
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
    nodes?: Node[];
    edges?: Edge[];
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

const AI_PRESET_PROMPTS = [
  {
    label: '🛍️ E-Commerce Microservices',
    category: 'system-design' as DiagramCategory,
    prompt:
      'High-scale e-commerce system with Next.js web client, Cloudflare WAF, Kong API Gateway, Auth Service, Order Service, Stripe Payment Worker, Kafka Event Stream, Redis Cache, and PostgreSQL DB.',
  },
  {
    label: '📋 User KYC & Onboarding',
    category: 'flowchart' as DiagramCategory,
    prompt:
      'Step-by-step user onboarding and identity KYC flowchart with document submission, automated fraud check decision diamond, manual compliance review branch, and approved/rejected terminal states.',
  },
  {
    label: '🗄️ Multi-Tenant SaaS ER Schema',
    category: 'er-diagram' as DiagramCategory,
    prompt:
      'Relational database schema for a multi-tenant B2B SaaS platform with workspaces, users, subscriptions, roles_permissions, and audit_logs tables with foreign keys.',
  },
  {
    label: '⚡ Event Pipeline & Workers',
    category: 'system-design' as DiagramCategory,
    prompt:
      'Event-driven video transcoding pipeline with S3 raw upload bucket, SQS job queue, ECS Fargate transcoding workers, Redis job progress tracker, and DynamoDB video metadata store.',
  },
];

export function CreateFlowModal({ isOpen, onClose, onCreate }: CreateFlowModalProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

  // Manual Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DiagramCategory>('system-design');
  const [templateId, setTemplateId] = useState<string>('template-microservices');
  const [tagsInput, setTagsInput] = useState('');
  const [gridType, setGridType] = useState<'dots' | 'lines' | 'cross' | 'none'>('dots');
  const [defaultEdgeType, setDefaultEdgeType] = useState<'smoothstep' | 'bezier' | 'straight'>('smoothstep');

  // AI Builder State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState<DiagramCategory>('system-design');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRandomizeTitle = () => {
    const randomName = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    setTitle(randomName);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
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

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          prompt: aiPrompt.trim(),
          category: aiCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate diagram with AI.');
      }

      onCreate({
        title: data.title || 'AI Generated Flow',
        description: data.description || aiPrompt,
        category: data.category || aiCategory,
        tags: data.tags || ['AI Generated', aiCategory],
        gridType: 'dots',
        defaultEdgeType: 'smoothstep',
        nodes: data.nodes || [],
        edges: data.edges || [],
      });
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setAiError(err.message || 'An error occurred while generating flow.');
    } finally {
      setIsGenerating(false);
    }
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create New Diagram Flow</h2>
              <p className="text-xs text-slate-500">
                Build with Gemini AI or start from templates and scratch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 pb-1 border-b border-slate-100 bg-slate-50/30">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>✨ Build with Gemini AI</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FilePlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Manual Setup & Templates</span>
            </button>
          </div>
        </div>

        {/* Tab 1: AI Flow Builder */}
        {activeTab === 'ai' && (
          <form onSubmit={handleAiSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">AI Generation Failed</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">{aiError}</p>
                </div>
              </div>
            )}

            {/* Prompt Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Describe the architecture or workflow you want to build
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. Build an e-commerce microservices architecture with Next.js web app, API Gateway, Auth service, Stripe payments, Kafka queue, Redis cache, and PostgreSQL database..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400 leading-relaxed"
                autoFocus
              />
            </div>

            {/* Quick Inspiration Chips */}
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                Quick Inspiration Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AI_PRESET_PROMPTS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPrompt(preset.prompt);
                      setAiCategory(preset.category);
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-all group cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">
                      {preset.label}
                    </span>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {preset.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Category Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Target Architecture Domain
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'system-design', label: 'System Design', icon: <Network className="w-3.5 h-3.5 text-indigo-600" /> },
                  { id: 'flowchart', label: 'Flowchart', icon: <GitFork className="w-3.5 h-3.5 text-amber-600" /> },
                  { id: 'er-diagram', label: 'ER Diagram', icon: <Database className="w-3.5 h-3.5 text-emerald-600" /> },
                  { id: 'general', label: 'General', icon: <Layers className="w-3.5 h-3.5 text-slate-600" /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAiCategory(item.id as DiagramCategory)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      aiCategory === item.id
                        ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {item.icon}
                      <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                    </div>
                    {aiCategory === item.id && <Check className="w-3 h-3 text-indigo-600" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Powered by Google Gemini 2.5 Flash
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-500/20 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gemini Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Flow with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Manual Setup & Templates */}
        {activeTab === 'manual' && (
          <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Diagram Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">Diagram Name</label>
                <button
                  type="button"
                  onClick={handleRandomizeTitle}
                  className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium cursor-pointer"
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
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder-slate-400"
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
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
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
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
              >
                <span>Create Flow & Edit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
