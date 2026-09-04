'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  Cpu,
  Bot,
  Layers,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { FlowCraftLogo } from '@/components/brand/FlowCraftLogo';

export default function McpConfigPage() {
  const { user, openLoginModal } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'windsurf' | 'terminal'>('claude');
  const [activeOs, setActiveOs] = useState<'mac' | 'linux' | 'windows'>('linux');

  const liveAppUrl = 'https://diagrams-flow-builder.vercel.app';
  const liveApiUrl = `${liveAppUrl}/api/diagrams`;

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch('/api/auth/mcp-token');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.token) {
            setToken(data.token);
          }
        }
      } catch {
        // use fallback or null
      }
    }

    if (user) {
      fetchToken();
    } else {
      setToken(null);
    }
  }, [user]);

  const handleCopyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const getClaudeConfigPath = () => {
    switch (activeOs) {
      case 'mac':
        return '~/Library/Application Support/Claude/claude_desktop_config.json';
      case 'windows':
        return '%APPDATA%\\Claude\\claude_desktop_config.json';
      case 'linux':
      default:
        return '~/.config/Claude/claude_desktop_config.json';
    }
  };

  const getClaudeConfig = () => {
    return JSON.stringify(
      {
        mcpServers: {
          flowcraft: {
            command: 'node',
            args: ['/mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server/dist/index.js'],
            env: {
              FLOW_APP_URL: liveAppUrl,
              FLOW_API_URL: liveApiUrl,
              ...(token ? { FLOW_MCP_TOKEN: token } : {}),
            },
          },
        },
      },
      null,
      2
    );
  };

  const getCursorConfig = () => {
    return JSON.stringify(
      {
        mcpServers: {
          flowcraft: {
            command: 'node',
            args: ['/mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server/dist/index.js'],
            env: {
              FLOW_APP_URL: liveAppUrl,
              FLOW_API_URL: liveApiUrl,
              ...(token ? { FLOW_MCP_TOKEN: token } : {}),
            },
          },
        },
      },
      null,
      2
    );
  };

  const getWindsurfConfig = () => {
    return JSON.stringify(
      {
        mcpServers: {
          flowcraft: {
            command: 'node',
            args: ['/mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server/dist/index.js'],
            env: {
              FLOW_APP_URL: liveAppUrl,
              FLOW_API_URL: liveApiUrl,
              ...(token ? { FLOW_MCP_TOKEN: token } : {}),
            },
          },
        },
      },
      null,
      2
    );
  };

  const getTerminalCommand = () => {
    const tokenPart = token ? ` FLOW_MCP_TOKEN="${token}"` : ' FLOW_MCP_TOKEN="<sign in above to get your token>"';
    return `cd /mnt/Data/Projects/diagrams_flow_builder/flow-mcp-server\nFLOW_APP_URL="${liveAppUrl}" FLOW_API_URL="${liveApiUrl}"${tokenPart} node dist/index.js`;
  };

  const getActiveCode = () => {
    switch (activeTab) {
      case 'claude':
        return getClaudeConfig();
      case 'cursor':
        return getCursorConfig();
      case 'windsurf':
        return getWindsurfConfig();
      case 'terminal':
        return getTerminalCommand();
    }
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleCopyPrompt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(idx);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  const mcpTools = [
    { name: 'create_diagram', desc: 'Create a new diagram with optional starter templates (blank, microservices, etc.)', type: 'Create' },
    { name: 'list_diagrams', desc: 'List all diagrams with metadata and live URLs', type: 'Read' },
    { name: 'get_diagram', desc: 'Fetch full diagram structure, nodes, and connections', type: 'Read' },
    { name: 'add_node', desc: 'Add a system node, flowchart shape, or ER database table', type: 'Create' },
    { name: 'update_node', desc: 'Update coordinates, label, icons, status, or ER column schema', type: 'Update' },
    { name: 'delete_node', desc: 'Delete a node and automatically clean up attached edges', type: 'Delete' },
    { name: 'add_edge', desc: 'Connect two nodes with animated pulses, labels, and line curve styles', type: 'Create' },
    { name: 'batch_add_elements', desc: 'Insert entire architectures (nodes + connections) in a single atomic call', type: 'Batch' },
    { name: 'tidy_diagram', desc: 'Automatically align and lay out all nodes using hierarchical auto-arrangement', type: 'Layout' },
    { name: 'delete_diagram', desc: 'Permanently remove a diagram from cloud storage', type: 'Delete' },
  ];

  const examplePrompts = [
    'Create a high-scale microservices architecture on FlowCraft with API Gateway, Auth Service, Kafka queue, Redis cache, and PostgreSQL database.',
    'Add an S3 object storage node and connect it to the Video Transcoding Worker in diagram flow_123 with an animated smoothstep edge.',
    'Design an ER relational database schema for an e-commerce platform with users, products, orders, and order_items tables.',
    'Run tidy_diagram on my checkout workflow to auto-align all decision diamonds and process steps.',
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </Link>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2.5">
              <FlowCraftLogo size="sm" />
              <div>
                <h1 className="text-sm font-bold text-slate-900">MCP Configuration & API Token</h1>
                <p className="text-[11px] text-slate-500">Connect Claude Desktop, Cursor & AI agents to FlowCraft</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live: {liveAppUrl.replace('https://', '')}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Banner */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-blue-50 border border-white/20 mb-3 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Model Context Protocol (MCP)</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              Control your diagrams with AI
            </h2>
            <p className="text-sm text-blue-100 mt-2 leading-relaxed">
              Connect Claude Desktop, Cursor, or any MCP-compatible AI to create, modify, connect, and auto-align system design flows and database schemas directly through chat.
            </p>
          </div>

          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 hidden md:block">
            <Bot className="w-48 h-48" />
          </div>
        </div>

        {/* Section 1: MCP Authentication Token */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Personal MCP API Token</h3>
                <p className="text-xs text-slate-500">
                  {user
                    ? `Authenticated as ${user.name} (${user.email}) • Token valid for 1 Year`
                    : 'Sign in to generate a personal token that links AI creations to your account'}
                </p>
              </div>
            </div>

            {!user && (
              <button
                onClick={openLoginModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <span>Sign In to Get Token</span>
              </button>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  readOnly
                  value={
                    token
                      ? token
                      : user
                      ? 'Loading token...'
                      : 'Sign in to generate your secure 365-day MCP token'
                  }
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-800 select-all focus:outline-none"
                />
                {token && (
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {token && (
                <button
                  onClick={handleCopyToken}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Token</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                This token authenticates your MCP client requests against the live production Vercel API and MongoDB Atlas.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Copy-Paste Client Configurations */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Client Setup Configurations</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select your AI tool below to get the pre-configured JSON snippet.
            </p>

            {/* Client Tabs */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setActiveTab('claude')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'claude'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>Claude Desktop</span>
              </button>

              <button
                onClick={() => setActiveTab('cursor')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'cursor'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Cursor IDE</span>
              </button>

              <button
                onClick={() => setActiveTab('windsurf')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'windsurf'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Windsurf</span>
              </button>

              <button
                onClick={() => setActiveTab('terminal')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  activeTab === 'terminal'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Terminal / Stdio</span>
              </button>
            </div>

            {/* OS Selector (for Claude Desktop) */}
            {activeTab === 'claude' && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Your Operating System:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setActiveOs('linux')}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                        activeOs === 'linux' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Linux
                    </button>
                    <button
                      onClick={() => setActiveOs('mac')}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                        activeOs === 'mac' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      macOS
                    </button>
                    <button
                      onClick={() => setActiveOs('windows')}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                        activeOs === 'windows' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Windows
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 font-mono bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 max-w-full overflow-x-auto">
                  {getClaudeConfigPath()}
                </div>
              </div>
            )}
          </div>

          {/* Code Viewer */}
          <div className="relative bg-slate-950 text-slate-200 p-5 font-mono text-xs overflow-x-auto">
            <button
              onClick={handleCopyConfig}
              className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-sans transition-colors cursor-pointer border border-slate-700 shadow-xs"
            >
              {copiedConfig ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
            <pre className="pr-24">{getActiveCode()}</pre>
          </div>
        </div>

        {/* Section 3: Available MCP Tools */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Supported MCP Tools & Capabilities</h3>
              <p className="text-xs text-slate-500">
                14 high-level tools enabling complete programmatic CRUD over diagrams, nodes, and connections.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {mcpTools.map((tool) => (
              <div
                key={tool.name}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start gap-3"
              >
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 mt-0.5 ${
                    tool.type === 'Create'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tool.type === 'Read'
                      ? 'bg-blue-100 text-blue-800'
                      : tool.type === 'Update'
                      ? 'bg-amber-100 text-amber-800'
                      : tool.type === 'Delete'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {tool.type}
                </span>
                <div>
                  <h4 className="text-xs font-bold font-mono text-slate-900">{tool.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Sample Prompts */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Example Prompts to Try</h3>
              <p className="text-xs text-slate-500">
                Copy and paste these prompts directly into Claude Desktop or Cursor chat.
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {examplePrompts.map((prompt, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">&ldquo;{prompt}&rdquo;</p>
                </div>

                <button
                  onClick={() => handleCopyPrompt(prompt, idx)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0 cursor-pointer shadow-2xs"
                >
                  {copiedPrompt === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">FlowCraft</span>
            <span className="text-slate-300">•</span>
            <span>Model Context Protocol Studio</span>
          </div>

          <p className="flex items-center gap-1.5">
            <span>a product built with love by</span>
            <Link
              href="https://www.shipsar.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              Shipsar Developers
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
