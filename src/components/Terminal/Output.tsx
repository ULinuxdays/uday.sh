import React from 'react';

export interface HistoryItem {
    id: string;
    type: 'command' | 'output' | 'error' | 'banner';
    content: React.ReactNode;
    path?: string;
    timestamp?: string;
}

interface OutputProps {
    history: HistoryItem[];
}

export const Output: React.FC<OutputProps> = ({ history }) => {
    return (
        <div className="terminal-output" role="log" aria-live="polite">
            {history.map((item) => (
                <div key={item.id} className={`history-item item-${item.type}`}>
                    {item.type === 'command' ? (
                        <div className="command-echo">
                            <span className="prompt-label">
                                <span className="prompt-path">~{item.path}</span>
                                <span className="prompt-char">$</span>
                            </span>
                            <span className="command-text">{item.content}</span>
                        </div>
                    ) : (
                        <div className="output-content">{item.content}</div>
                    )}
                </div>
            ))}
      <style>{`
        .terminal-output {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          color: var(--color-text, #E6E0D2);
          line-height: 1.5;
        }
        .history-item {
           position: relative;
        }
        .item-command {
           margin-top: 0.5rem;
           margin-bottom: 0.1rem;
        }
        .command-echo {
          display: flex;
          gap: 0.5rem;
          font-weight: bold;
        }
        .prompt-path { color: var(--color-path, #B08D57); }
        .prompt-char { color: var(--color-char, #B08D57); margin-left: 0.25rem; }
        .command-text { color: var(--color-input, #E6E0D2); }
        
        .item-error { color: var(--color-error, #8A2E2B); }
        .item-output { 
           white-space: pre-wrap; 
           color: var(--color-text-dim, #B7B0A2);
        }

        .item-output .output-content,
        .item-error .output-content {
          opacity: 0;
          animation: terminalFadeIn 1200ms ease forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .item-output .output-content,
          .item-error .output-content {
            opacity: 1;
            animation: none;
          }
        }

        @keyframes terminalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
        </div>
    );
};
