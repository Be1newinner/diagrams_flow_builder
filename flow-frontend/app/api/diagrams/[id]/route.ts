import { NextResponse } from 'next/server';
import { getServerDiagram, saveServerDiagram, deleteServerDiagram } from '@/lib/serverStorage';
import { resolveAuthUserId, resolveAuthContext } from '@/lib/auth';
import { Diagram } from '@/types/diagram';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  // No early auth-required bail-out here: a diagram shared via "everyone can
  // view" (isPublic) must be viewable by a fully anonymous visitor too.
  // getServerDiagram/withAccessCheck below still enforce every other rule —
  // an unauthenticated request only ever gets back a diagram that is a
  // template or explicitly isPublic; anything else falls through to null
  // exactly as before.
  const userId = await resolveAuthUserId(request);

  const diagram = await getServerDiagram(id, userId);
  if (!diagram) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }
  return NextResponse.json(diagram);
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const authContext = await resolveAuthContext(request);
  const userId = authContext?.userId ?? null;

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in to edit diagrams.' },
      { status: 401 }
    );
  }

  const existing = await getServerDiagram(id, userId);
  if (!existing) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }

  // Prevent modifying built-in sample templates
  if (existing.isTemplate || existing.id.startsWith('template-')) {
    return NextResponse.json(
      { error: 'Cannot modify built-in sample templates. Duplicate to your account to edit.' },
      { status: 403 }
    );
  }

  // ADMIN and EDITOR can both edit content; only ADMIN can delete (checked
  // separately below in DELETE).
  const canEdit =
    existing.userId === userId ||
    existing.users?.some(
      (u) => u.userId === userId && (u.accesstype === 'ADMIN' || u.accesstype === 'EDITOR')
    );

  try {
    const {
      baseVersion,
      checkpoint,
      ...body
    }: Partial<Diagram> & { baseVersion?: string; checkpoint?: boolean } = await request.json();

    // Comments are a lighter-weight permission than full editing (see the
    // `canComment` note in app/flow/[id]/page.tsx) — anyone who can at
    // least view this diagram (we already know that, `existing` is
    // non-null) can add/reply/resolve a comment. Recognize that case by
    // shape: a request touching only `comments` doesn't need canEdit.
    const bodyKeys = Object.keys(body);
    const isCommentOnlyEdit = bodyKeys.length > 0 && bodyKeys.every((k) => k === 'comments');

    if (!canEdit && !isCommentOnlyEdit) {
      return NextResponse.json(
        { error: 'Forbidden: Only the diagram ADMIN or an EDITOR can edit this diagram.' },
        { status: 403 }
      );
    }

    // Optimistic concurrency check. `baseVersion` is the updatedAt the
    // client last saw when it started this edit. If the diagram we just
    // fetched has since moved on (another tab, another user, or an MCP
    // tool call saved in between), reject instead of blindly overwriting
    // that other edit with `$set` — the previous unconditional last-write-
    // wins behavior is exactly what let concurrent editors silently stomp
    // each other. Older/legacy clients that don't send baseVersion skip
    // this check.
    if (baseVersion && baseVersion !== existing.updatedAt) {
      return NextResponse.json(
        {
          error: 'Conflict: this diagram was modified elsewhere since you loaded it.',
          conflict: true,
          latest: existing,
        },
        { status: 409 }
      );
    }

    const updated: Diagram = {
      ...existing,
      ...body,
      id,
      // A comment-only save from a VIEWER must not reassign ownership —
      // only stamp the acting user as owner on a real edit.
      userId: isCommentOnlyEdit ? existing.userId : userId,
      isTemplate: false,
    };
    // Pass `existing` through to avoid a second, slightly-later read that
    // would only widen the race window this check is meant to close.
    const saved = await saveServerDiagram(updated, userId, existing, {
      commentOnly: isCommentOnlyEdit,
      actorType: authContext?.source ?? 'human',
      // Only the browser's debounced autosave ever sends `checkpoint: false`.
      // Everything else (manual save, comment-only edits, MCP tool calls,
      // which don't know about this field at all) defaults to a checkpoint.
      checkpoint: checkpoint ?? true,
    });
    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update diagram' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const userId = await resolveAuthUserId(request);

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentication required. Sign in to delete diagrams.' },
      { status: 401 }
    );
  }

  // Prevent deleting system sample templates
  if (id.startsWith('template-')) {
    return NextResponse.json(
      { error: 'Cannot delete built-in sample templates.' },
      { status: 403 }
    );
  }

  const existing = await getServerDiagram(id, userId);
  if (!existing) {
    return NextResponse.json({ error: 'Diagram not found or access denied' }, { status: 404 });
  }

  if (existing.isTemplate) {
    return NextResponse.json(
      { error: 'Cannot delete built-in sample templates.' },
      { status: 403 }
    );
  }

  // Ensure user is ADMIN of this diagram
  const isAdmin =
    existing.userId === userId ||
    existing.users?.some((u) => u.userId === userId && u.accesstype === 'ADMIN');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Only the diagram ADMIN can delete this diagram.' },
      { status: 403 }
    );
  }

  const success = await deleteServerDiagram(id, userId);
  if (!success) {
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
  return NextResponse.json({ success: true, message: 'Diagram deleted' });
}
