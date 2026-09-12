// Single source of truth for the app's public URL and SEO copy, so the
// domain only needs to change in one place (layout metadata, sitemap.xml,
// robots.txt, and the MCP-config/API routes that print a live editor link
// all read from here instead of hardcoding the domain separately).
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://flowcraft.shipsar.in';

export const SITE_NAME = 'FlowCraft';

export const SITE_DESCRIPTION =
  'FlowCraft is a free online diagram editor for system design, flowcharts, and ER diagrams. Draw architecture diagrams, database schemas, and process flows with real-time collaboration, an AI diagram generator, and an MCP server so Claude and Cursor can build diagrams for you.';

export const SITE_KEYWORDS = [
  'diagram maker',
  'online diagram tool',
  'system design tool',
  'system design diagram generator',
  'flowchart maker',
  'flowchart online',
  'ER diagram tool',
  'entity relationship diagram tool',
  'database schema designer',
  'architecture diagram tool',
  'AI diagram generator',
  'React Flow diagram builder',
  'MCP diagram server',
  'Model Context Protocol diagrams',
  'Claude diagram generator',
  'real-time collaborative diagramming',
  'free flowchart software',
  'draw.io alternative',
  'lucidchart alternative',
];
