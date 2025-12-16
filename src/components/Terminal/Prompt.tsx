import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface PromptProps {
  value: string;
  path: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onHistory: (direction: 'up' | 'down') => void;
  onTabComplete?: () => void;
  onToggleCheatSheet?: () => void;
  showPlaceholder?: boolean;
  ghostSuffix?: string;
  suggestions?: Array<{ label: string; kind?: 'command' | 'dir' | 'file' }>;
}

export const Prompt = forwardRef<HTMLInputElement, PromptProps>(
  ({ value, path, onChange, onSubmit, onHistory, onTabComplete, onToggleCheatSheet, showPlaceholder, ghostSuffix, suggestions }, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current!);

  useEffect(() => {
    // Auto-focus on mount (Desktop only ideally, but simple first)
    if (window.innerWidth > 768) {
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSubmit();
    } else if (e.key === '?' && value.trim() === '') {
      e.preventDefault();
      onToggleCheatSheet?.();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onTabComplete?.();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onHistory('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onHistory('down');
    }
  };

  return (
    <div className="prompt-root" onClick={() => inputRef.current?.focus()}>
      <div className="terminal-prompt">
        <span className="prompt-label">
          <span className="prompt-path">~{path}</span>
          <span className="prompt-char">$</span>
        </span>
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            className="sr-only-input"
            aria-label="Terminal Input"
          />
          {/* Visual Input Rendering (Block Cursor) */}
          <span className="visual-input">
            {value}
            {value !== '' && ghostSuffix && ghostSuffix.length > 0 && (
              <span className="ghost-suffix">{ghostSuffix}</span>
            )}
            <span className="cursor">█</span>
            {value === '' && showPlaceholder && (
              <span className="placeholder">
                Sift through the lush gardens of this Agora, or type 'help' if you find yourself lost...
              </span>
            )}
          </span>

          {value !== '' && suggestions && suggestions.length > 0 && (
            <div className="suggestions" aria-label="Suggestions">
              {suggestions.slice(0, 6).map((s, idx) => (
                <div key={`${s.label}-${idx}`} className={`suggestion ${idx === 0 ? 'is-active' : ''}`}>
                  <span className={`kind kind-${s.kind || 'command'}`}>{s.kind === 'dir' ? 'DIR' : s.kind === 'file' ? 'FILE' : 'CMD'}</span>
                  <span className="label">{s.label}</span>
                </div>
              ))}
              <div className="hint">Press Tab to autocomplete</div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .prompt-root {
          display: flex;
          flex-direction: column;
          margin-top: 0.25rem;
          cursor: text;
        }
        .terminal-prompt {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .prompt-label {
          color: var(--color-prompt, #a5b4fc);
          font-weight: bold;
        }
        .prompt-path {
          color: var(--color-path, #B08D57); 
        }
        .prompt-char {
          margin-left: 0.25rem;
          color: var(--color-char, #818cf8);
        }
        .input-wrapper {
          position: relative;
          flex: 1;
        }
        .sr-only-input {
          position: absolute;
          opacity: 0;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          cursor: text;
        }
        .visual-input {
          display: flex;
          align-items: center;
          white-space: pre;
          word-break: normal;
          color: var(--color-input, #E6E0D2);
          height: 100%;
        }
        .ghost-suffix {
          color: #B7B0A2;
          opacity: 0.35;
        }
        .cursor {
          display: inline-block;
          animation: blink 1s step-end infinite;
          color: var(--color-cursor, #a5b4fc);
          margin-left: 1px;
          line-height: 1;
        }
        .placeholder {
            color: #B7B0A2;
            opacity: 0.7;
            margin-left: 1ch;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .suggestions {
          margin-top: 0.35rem;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.85rem;
          color: #B7B0A2;
          opacity: 0.9;
        }
        .suggestion {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .suggestion.is-active .label {
          color: #E6E0D2;
        }
        .kind {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3.25rem;
          font-size: 0.65rem;
          letter-spacing: 0.06em;
          color: rgba(230, 224, 210, 0.45);
        }
        .kind-dir { color: rgba(176, 141, 87, 0.75); }
        .kind-file { color: rgba(230, 224, 210, 0.55); }
        .kind-command { color: rgba(230, 224, 210, 0.55); }
        .hint {
          margin-top: 0.1rem;
          font-size: 0.75rem;
          opacity: 0.55;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
  }
);
