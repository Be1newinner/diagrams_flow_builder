'use client';

import React from 'react';
import { useViewport } from '@xyflow/react';
import { MessageCircle, Check } from 'lucide-react';
import { DiagramComment } from '@/types/diagram';
import { colorForId } from './CollaboratorCursors';

interface CommentPinsProps {
  comments: DiagramComment[];
  selectedCommentId: string | null;
  onSelect: (comment: DiagramComment) => void;
}

// Comment pins live entirely outside the node/edge graph — a separate
// absolutely-positioned overlay (same flow-to-screen transform technique as
// CollaboratorCursors/CollaboratorSelections) rather than a React Flow node,
// so they're never counted in node/edge CRUD, never draggable-as-a-node,
// and never show up in the Layers list.
export function CommentPins({ comments, selectedCommentId, onSelect }: CommentPinsProps) {
  const { x: viewX, y: viewY, zoom } = useViewport();

  if (comments.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      {comments.map((comment) => {
        const screenX = comment.x * zoom + viewX;
        const screenY = comment.y * zoom + viewY;
        const color = comment.resolved ? '#94a3b8' : colorForId(comment.authorId);
        const isSelected = comment.id === selectedCommentId;
        const replyCount = comment.replies?.length || 0;
        return (
          <button
            key={comment.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(comment);
            }}
            className={`absolute pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full rounded-bl-sm shadow-md transition-transform cursor-pointer ${
              isSelected ? 'ring-2 ring-offset-2 ring-blue-400' : ''
            } ${comment.resolved ? 'opacity-60' : ''}`}
            style={{
              // The pin's anchor point (its bottom-left corner, like a map
              // pin) needs to land exactly on the comment's flow position —
              // combined into one inline transform rather than mixed with a
              // Tailwind translate/scale class, since an inline `style`
              // always wins over a class and would otherwise silently
              // discard whichever one lost.
              transform: `translate(${screenX}px, ${screenY}px) translate(-50%, -100%) ${isSelected ? 'scale(1.25)' : ''}`,
              backgroundColor: color,
            }}
            title={`${comment.authorName}${comment.resolved ? ' (resolved)' : ''}${comment.text ? ': ' + comment.text : ' (empty comment)'}`}
          >
            {comment.resolved ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <MessageCircle className="w-4 h-4 text-white" fill={color} />
            )}
            {replyCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white text-slate-700 text-[8px] font-bold flex items-center justify-center shadow border border-slate-200">
                {replyCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
