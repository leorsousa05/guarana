import { useMemo } from 'react';
import { Marked } from 'marked';

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Internal spec-relative link target (e.g. features/guarana/plan.md, features/cli/cli.md).
export const isSpecPath = (href) =>
  /\.md$/i.test(String(href)) && !/^(https?:|mailto:|#|\/|data:)/i.test(String(href));

const md = new Marked();
md.use({
  renderer: {
    // Escape raw HTML in the markdown source so it renders literally (no injection).
    html({ text }) {
      return escapeHtml(text);
    },
    image({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const spec = isSpecPath(href);
      const attrs = spec
        ? ` href="#" data-specfile="${escapeHtml(href)}"`
        : ` href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}`;
      return `<a${attrs}>${label}</a>`;
    },
  },
});

export function Markdown({ text, onOpenFile, canOpen }) {
  const html = useMemo(() => md.parse(String(text || '')), [text]);
  const handleClick =
    onOpenFile && canOpen
      ? (e) => {
          const el = e.target.closest('[data-specfile]');
          if (el && canOpen(el.dataset.specfile)) {
            e.preventDefault();
            onOpenFile(el.dataset.specfile);
          }
        }
      : undefined;
  return <div className="md" onClick={handleClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Render a markdown link "[label](href)" as a clickable spec link when it
// points at a .specs file that the Documents view can open; otherwise render
// the label as plain text.
export function MdLink({ text, onOpenFile, canOpen }) {
  const m = String(text || '').match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!m) return <>{text}</>;
  const [, label, target] = m;
  if (isSpecPath(target) && onOpenFile && canOpen && canOpen(target)) {
    return (
      <button type="button" className="md-link" onClick={() => onOpenFile(target)}>
        {label}
      </button>
    );
  }
  return <>{label}</>;
}
