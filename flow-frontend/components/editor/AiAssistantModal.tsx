'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  Check,
  Send,
  Zap,
  Layers,
  Database,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Diagram, Node, Edge } from '@/types/diagram';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: Diagram;
  nodes: Node[];
  edges: Edge[];
  onApplyChanges: (newNodes: Node[], newEdges: Edge[], summary?: string) => void;
}

const QUICK_ACTIONS = [
  {
    label: '+ Add Redis Cache Layer',
    prompt: 'Add a high-performance Redis cache layer between the gateway and backend compute services with cache-aside read/write connections.',
    icon: <Zap className="w-3.5 h-3.5 text-amber-500" />,
  },
  {
    label: '+ Add Kafka Event Bus',
    prompt: 'Add an Apache Kafka / RabbitMQ distributed event message bus with producer and consumer topic connections.',
    icon: <Layers className="w-3.5 h-3.5 text-purple-500" />,
  },
  {
    label: '+ Add DB Read Replica',
    prompt: 'Add a read-replica database node attached to the primary database with asynchronous master-replica replication.',
    icon: <Database className="w-3.5 h-3.5 text-emerald-500" />,
  },
  {
    label: '+ Add WAF & Rate Limiting',
    prompt: 'Add Cloudflare / AWS WAF with DDoS protection and rate limiting in front of the API Gateway.',
    icon: <Shield className="w-3.5 h-3.5 text-cyan-500" />,
  },
  {
    label: '⚡ Auto-Align & Clean Edges',
    prompt: 'Clean up the layout: organize nodes into clear horizontal tiers (Clients -> Gateway -> Services -> Storage) with non-overlapping coordinates and clean connections.',
    icon: <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />,
  },
];

export function AiAssistantModal({
  isOpen,
  onClose,
  diagram,
  nodes,
  edges,
  onApplyChanges,
}: AiAssistantModalProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ai/flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'modify',
          prompt: prompt.trim(),
          category: diagram.category,
          currentDiagram: {
            title: diagram.title,
            category: diagram.category,
            nodes,
            edges,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to modify diagram with AI.');
      }

      onApplyChanges(data.nodes || nodes, data.edges || edges, data.changesSummary);
      onClose();
    } catch (err: any) {
      console.error('AI Assistant Error:', err);
      setErrorMessage(err.message || 'Failed to communicate with AI Assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (quickPrompt: string) => {
    setPrompt(quickPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-indigo-50/50 to-purple-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">FlowCraft AI Assistant</h2>
              <p className="text-xs text-slate-500">
                Ask Gemini to add components, modify flows, or enhance architecture
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">AI Assistant Error</p>
                <p className="text-[11px] text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Prompt Textarea */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              What would you like to modify or add?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Add a Redis cache between API Gateway and Order Service, and connect an analytics worker to Kafka..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder-slate-400 leading-relaxed"
              autoFocus
            />
          </div>

          {/* Quick Actions */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
              Quick Architecture Actions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickAction(action.prompt)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 text-xs font-medium text-slate-700 transition-all cursor-pointer"
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current Diagram Stats */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>Nodes: <strong className="text-slate-800">{nodes.length}</strong></span>
              <span>•</span>
              <span>Edges: <strong className="text-slate-800">{edges.length}</strong></span>
              <span>•</span>
              <span className="capitalize">Domain: <strong className="text-slate-800">{diagram.category}</strong></span>
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full">
              Gemini 2.5 Flash
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-indigo-500/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini Updating Flow...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply AI Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
