import Link from 'next/link';
import Image from 'next/image';
import {
  Network,
  GitFork,
  Database,
  Sparkles,
  Users,
  Terminal,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { FlowCraftLogo } from '@/components/brand/FlowCraftLogo';

// Server-rendered marketing homepage — real HTML/headings for search
// engines, not the client-only dashboard shell (that now lives at
// /dashboard, which is noindex'd since it's signed-in app surface, not
// content). Kept as a plain server component with no client state so the
// whole thing streams as static HTML.

const FEATURES = [
  {
    icon: Network,
    title: 'System Design Diagrams',
    description:
      'Map out microservices, gateways, databases, and queues with pre-built system nodes, theme colors, and status pills.',
  },
  {
    icon: GitFork,
    title: 'Flowchart Maker',
    description:
      'Build process flows and decision trees with start/end, process, decision, input/output, document, and delay shapes.',
  },
  {
    icon: Database,
    title: 'ER Diagram Tool',
    description:
      'Design database schemas visually — typed columns, primary/foreign keys, and nullable flags on every table node.',
  },
  {
    icon: Sparkles,
    title: 'AI Diagram Generator',
    description:
      'Describe your architecture in plain English and let the built-in AI assistant lay out nodes and connections for you.',
  },
  {
    icon: Users,
    title: 'Real-Time Collaboration',
    description:
      'Share a diagram, comment with @mentions, and see edits sync live across every collaborator’s canvas.',
  },
  {
    icon: Terminal,
    title: 'MCP Server for Claude & Cursor',
    description:
      'Connect FlowCraft over the Model Context Protocol so Claude Desktop, Claude Code, or Cursor can create and edit diagrams for you.',
  },
];

const USE_CASES = [
  'System architecture & cloud infrastructure diagrams',
  'Software flowcharts & business process maps',
  'Database entity-relationship (ER) diagrams',
  'API and microservice interaction maps',
  'Onboarding docs & technical wikis',
  'AI-assisted diagramming via Claude or Cursor (MCP)',
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Nav */}
      <header className="border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlowCraftLogo size="sm" />
            <span className="font-bold text-lg tracking-tight">FlowCraft</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
            <Link href="/mcp-config" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">MCP for AI</Link>
          </nav>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            Open Dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          Free online diagram editor
        </span>
        <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
          Draw system design, flowcharts &amp; ER diagrams
          <span className="block text-blue-600 dark:text-blue-400">in your browser</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-400">
          FlowCraft is a free online diagram maker for architecture diagrams, database schemas, and process
          flows &mdash; with real-time collaboration, an AI diagram generator, and an MCP server so Claude
          and Cursor can build diagrams for you.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
          >
            Start Diagramming Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/mcp-config"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Terminal className="w-4 h-4" />
            Connect Claude / Cursor
          </Link>
        </div>

        <div className="mt-14 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          <Image
            src="/dashboard_with_ai_diagram.png"
            alt="FlowCraft system design diagram editor with AI-generated architecture diagram"
            width={1920}
            height={871}
            priority
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            One diagram tool for design, flow, and data
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Everything you need to visualize systems, processes, and schemas &mdash; without switching apps.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
                <f.icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshot: editor */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            A canvas built for architecture &amp; database diagrams
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Drag in system nodes, flowchart shapes, or ER tables, connect them with styled edges and
            arrowheads, and let the auto-layout engine tidy everything into a clean hierarchy.
          </p>
          <ul className="mt-5 space-y-2.5">
            {USE_CASES.map((u) => (
              <li key={u} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
          <Image
            src="/editor_screenshot.png"
            alt="FlowCraft flowchart and ER diagram editor canvas"
            width={1920}
            height={871}
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* MCP callout */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-10 items-center">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden lg:order-2">
          <Image
            src="/mcp_streaming_pipeline.png"
            alt="FlowCraft MCP server connecting Claude and Cursor to a live diagram"
            width={1920}
            height={871}
            className="w-full h-auto"
          />
        </div>
        <div className="lg:order-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
            <Terminal className="w-3.5 h-3.5" />
            Model Context Protocol
          </span>
          <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
            Let Claude or Cursor build your diagrams
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            FlowCraft ships an MCP server so any AI assistant that speaks the Model Context Protocol can
            create diagrams, add nodes and edges, and auto-layout an entire system design or ER schema
            from a single prompt.
          </p>
          <Link
            href="/mcp-config"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            See MCP setup for Claude &amp; Cursor
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Start your first diagram in seconds
        </h2>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          No install required &mdash; sign up free and start designing.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
        >
          Open FlowCraft
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-500">
          <span>&copy; {new Date().getFullYear()} FlowCraft. All rights reserved.</span>
          <span>
            A product built with love by{' '}
            <a
              href="https://www.shipsar.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Shipsar Developers
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
