import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  /** Plain-English explanation shown in the tooltip. */
  text: string;
  /** Optional bold title line shown above the text. */
  title?: string;
  /** Icon size in pixels. Defaults to 14 (w-3.5 h-3.5). */
  size?: number;
  /** Icon color classes. Defaults to a muted slate for light backgrounds. */
  className?: string;
}

/**
 * A small "?" icon that shows a plain-English explanation on hover/focus/click.
 * Rendered into document.body via a portal so it's never clipped by a card's
 * overflow. Same interaction pattern as SegmentCard's tooltip.
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  title,
  size = 14,
  className = 'text-slate-400 hover:text-slate-600',
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipWidth = 260;
      let left = rect.left;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      setPos({ top: rect.bottom + 8, left });
    }
    setOpen(true);
  }

  function hide() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function cancelHide() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    show();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`inline-flex items-center justify-center shrink-0 rounded-full transition-colors ${className}`}
        style={{ width: size + 6, height: size + 6 }}
        onClick={toggle}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        aria-label={title ? `What is ${title}?` : 'More information'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Info style={{ width: size, height: size }} />
      </button>

      {open && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 260 }}
          className="rounded-xl bg-white text-slate-800 shadow-2xl p-3.5 text-xs border border-slate-100"
          role="tooltip"
          onMouseEnter={cancelHide}
          onMouseLeave={hide}
        >
          {title && <p className="font-semibold text-sm text-slate-900 mb-1">{title}</p>}
          <p className="text-slate-600 leading-relaxed">{text}</p>
        </div>,
        document.body
      )}
    </>
  );
};
