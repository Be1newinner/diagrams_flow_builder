import { NextResponse } from 'next/server';
import { resolveAuthUserId } from '@/lib/auth';
import { DiagramCategory, Node, Edge } from '@/types/diagram';

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to use the AI flow builder.' },
        { status: 401 }
      );
    }

    const apiKey = process.env.GEMINI_API || process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        {
          error:
            'Gemini API key is not configured. Please set the GEMINI_API variable in your .env.local file or environment.',
          needsKey: true,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, prompt, category = 'system-design', currentDiagram } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return NextResponse.json({ error: 'Please provide a prompt describing your flow.' }, { status: 400 });
    }

    let systemInstruction = '';
    let userContent = '';

    if (action === 'modify') {
      systemInstruction = `You are FlowCraft's AI Architecture and Diagram Engineer.
The user has an existing visual diagram in FlowCraft and wants to modify, expand, or reorganize it according to their instructions.

FlowCraft Node Types:
1. "systemNode":
   data: {
     title: string,
     subtitle?: string,
     icon: string (e.g. 'server', 'database', 'shield', 'cpu', 'layers', 'globe', 'smartphone', 'lock', 'mail', 'hard-drive', 'arrow-left-right', 'activity'),
     category?: string (e.g. 'Security', 'Compute', 'Database', 'Network', 'Queue', 'Storage'),
     status?: string (e.g. 'Healthy', 'Active', 'Port 8080', 'Active Clients'),
     themeColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'slate'
   }
2. "flowchartNode":
   data: {
     label: string,
     description?: string,
     shape: 'start-end' | 'process' | 'decision' | 'input-output' | 'document' | 'delay',
     themeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'cyan'
   }
3. "erTableNode":
   data: {
     tableName: string,
     columns: Array<{ id: string, name: string, type: string, isPrimary?: boolean, isForeign?: boolean, isNullable?: boolean }>,
     headerColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate'
   }
4. "stickyNode":
   data: { title?: string, text: string, color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple' }

Edge format:
{
  id: string,
  source: string,
  target: string,
  label?: string,
  animated?: boolean,
  type: 'customEdge' | 'smoothstep',
  style?: { stroke?: string, strokeWidth?: number, strokeDasharray?: string }
}

Coordinate & Layout Guidelines:
- Keep existing node IDs whenever possible so connections remain valid.
- For new nodes, place them logically relative to existing nodes (with at least 220px horizontal or 140px vertical spacing to prevent overlapping).
- Connect new nodes with meaningful edges, labels, and styles.

Return ONLY a JSON object with this exact structure:
{
  "title": string,
  "description": string,
  "category": "system-design" | "flowchart" | "er-diagram" | "general",
  "tags": string[],
  "nodes": array of nodes,
  "edges": array of edges,
  "changesSummary": string (brief summary of what was added or modified)
}`;

      userContent = `Existing Diagram:
Category: ${currentDiagram?.category || category}
Title: ${currentDiagram?.title || 'Diagram'}
Current Nodes: ${JSON.stringify(currentDiagram?.nodes || [], null, 2)}
Current Edges: ${JSON.stringify(currentDiagram?.edges || [], null, 2)}

User Modification Instruction:
"${prompt}"

Apply the changes, add or adjust nodes and edges, and return the complete updated diagram as valid JSON.`;
    } else {
      // action === 'create'
      systemInstruction = `You are FlowCraft's AI Architecture and Diagram Engineer.
Your job is to generate complete, beautiful, production-grade visual diagrams (System Design, Flowcharts, or Database ER Diagrams) from natural language prompts.

FlowCraft Node Types:
1. "systemNode": (For cloud architectures, microservices, backend infra)
   data: {
     title: string,
     subtitle: string,
     icon: string (e.g. 'smartphone', 'globe', 'shield', 'server', 'database', 'cpu', 'layers', 'lock', 'hard-drive', 'arrow-left-right', 'activity', 'mail'),
     category: string (e.g. 'Client', 'Security', 'Compute', 'Database', 'Queue', 'Cache', 'Storage'),
     status: string (e.g. 'Active', 'Port 8080', 'DDoS Protected', 'Replica 2x', 'Active Clients'),
     themeColor: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan' | 'slate'
   }
2. "flowchartNode": (For business processes, decision trees, user journeys)
   data: {
     label: string,
     description: string,
     shape: 'start-end' | 'process' | 'decision' | 'input-output' | 'document' | 'delay',
     themeColor: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate' | 'cyan'
   }
3. "erTableNode": (For SQL relational databases, schemas)
   data: {
     tableName: string,
     columns: Array<{ id: string, name: string, type: string, isPrimary?: boolean, isForeign?: boolean, isNullable?: boolean }>,
     headerColor: 'blue' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'slate'
   }
4. "stickyNode": (For architecture notes, callouts)
   data: { title: string, text: string, color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple' }

Edge format:
{
  id: string,
  source: string,
  target: string,
  label?: string,
  animated?: boolean,
  type: 'customEdge' | 'smoothstep',
  style?: { stroke?: string, strokeWidth?: number, strokeDasharray?: string }
}

Layout & Spacing Rules:
- Layout from left to right (X: 50 to 1200+ with 260px-320px steps) or hierarchical layers (Tiers: Client -> Edge/Gateway -> Services -> Queues/Storage/DB).
- Ensure no two nodes overlap! Give ample spacing (X spacing >= 240px, Y spacing >= 140px).
- Connect all elements logically with meaningful labels on edges (e.g. "HTTPS / REST", "Produce Event", "SQL Query", "Yes", "No", "Cache Lookup").
- Assign coherent themeColors (e.g. blue/cyan for clients/networking, indigo for microservices, emerald/amber for database/cache, purple for event streams).

Return ONLY a JSON object with this exact structure:
{
  "title": string,
  "description": string,
  "category": "system-design" | "flowchart" | "er-diagram" | "general",
  "tags": string[],
  "nodes": array of nodes,
  "edges": array of edges
}`;

      userContent = `Requested Category: ${category}
User Prompt:
"${prompt}"

Generate a complete, rich, production-grade diagram with 5 to 12 well-connected nodes matching the prompt.`;
    }

    // Call Google Gemini API
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let geminiResponse: any = null;
    let lastError: any = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userContent }],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          lastError = new Error(`Model ${model} returned HTTP ${res.status}: ${errBody}`);
          continue;
        }

        const data = await res.json();
        const rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          geminiResponse = JSON.parse(rawJsonText);
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!geminiResponse) {
      throw new Error(
        lastError?.message || 'Failed to generate diagram response from Gemini API. Please check your API key.'
      );
    }

    // Format & validate returned nodes and edges
    const formattedNodes = (geminiResponse.nodes || []).map((node: any, index: number) => ({
      id: node.id || `node-${index + 1}-${Date.now()}`,
      type: node.type || (category === 'flowchart' ? 'flowchartNode' : category === 'er-diagram' ? 'erTableNode' : 'systemNode'),
      position: {
        x: typeof node.position?.x === 'number' ? node.position.x : 100 + (index % 4) * 260,
        y: typeof node.position?.y === 'number' ? node.position.y : 100 + Math.floor(index / 4) * 160,
      },
      data: node.data || {},
    }));

    const formattedEdges = (geminiResponse.edges || []).map((edge: any, index: number) => ({
      id: edge.id || `edge-${index + 1}-${Date.now()}`,
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
      animated: edge.animated ?? true,
      type: 'customEdge',
      data: {
        label: edge.label || '',
        animated: edge.animated ?? true,
        edgeType: 'smoothstep',
      },
    }));

    return NextResponse.json({
      title: geminiResponse.title || 'AI Generated Flow',
      description: geminiResponse.description || prompt,
      category: geminiResponse.category || category,
      tags: geminiResponse.tags || ['AI Generated', category],
      nodes: formattedNodes,
      edges: formattedEdges,
      changesSummary: geminiResponse.changesSummary,
    });
  } catch (error: any) {
    console.error('[Gemini AI Flow Error]:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while communicating with Gemini API.' },
      { status: 500 }
    );
  }
}
