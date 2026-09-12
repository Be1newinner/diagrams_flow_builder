import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: 'MCP Server Setup - Connect Claude & Cursor to FlowCraft',
  description:
    'Connect FlowCraft to Claude Desktop, Claude Code, or Cursor via the Model Context Protocol (MCP). Let an AI assistant create, edit, and auto-layout your system design, flowchart, and ER diagrams directly.',
  keywords: [
    'MCP server',
    'Model Context Protocol',
    'Claude MCP diagram',
    'Cursor MCP',
    'AI diagram generator',
    'FlowCraft MCP',
  ],
  alternates: {
    canonical: `${SITE_URL}/mcp-config`,
  },
  openGraph: {
    title: 'MCP Server Setup - Connect Claude & Cursor to FlowCraft',
    description:
      'Connect FlowCraft to Claude Desktop, Claude Code, or Cursor via the Model Context Protocol (MCP) and let an AI assistant build your diagrams.',
    url: `${SITE_URL}/mcp-config`,
    images: ['/mcp_streaming_pipeline.png'],
  },
};

export default function McpConfigLayout({ children }: { children: React.ReactNode }) {
  return children;
}
