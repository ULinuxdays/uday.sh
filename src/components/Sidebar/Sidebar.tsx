import React, { useEffect, useState } from 'react';
import type { VirtualFS, DirectoryNode, FileNode } from '../../lib/fs_types';

const INDENT_REM = 1.2;
const CONNECTOR_REM = 0.6;

interface SidebarProps {
    fs: VirtualFS;
    currentPath?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ fs }) => {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [highlightedDirectoryPath, setHighlightedDirectoryPath] = useState<string | null>(null);
    const [highlightedFilePath, setHighlightedFilePath] = useState<string | null>(null);

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ directoryPath?: string; filePath?: string }>).detail;
            if (detail?.directoryPath) setHighlightedDirectoryPath(detail.directoryPath);
            if (detail?.filePath !== undefined) setHighlightedFilePath(detail.filePath ?? null);
        };

        window.addEventListener('udaysh:sidebar:highlight', handler);
        return () => window.removeEventListener('udaysh:sidebar:highlight', handler);
    }, []);

    const toggleExpand = (path: string) => {
        setExpanded(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const renderNode = (node: DirectoryNode | FileNode, name: string, path: string, depth: number = 0) => {
        const isHighlightedDir = highlightedDirectoryPath === path;
        const isHighlightedFile = highlightedFilePath === path;
        const indent = depth * INDENT_REM;
        const isExpanded = expanded[path] !== false; // Default to expanded

        if (node.type === 'dir') {
            const hasChildren = Object.keys(node.children).length > 0;
            const childEntries = Object.entries(node.children).sort(([, a], [, b]) => {
                const titleA = a.meta?.title || '';
                const titleB = b.meta?.title || '';
                return titleA.localeCompare(titleB);
            });

            return (
                <div key={path}>
	                    <div
	                        style={{
	                            display: 'flex',
	                            alignItems: 'center',
	                            marginLeft: `${indent}rem`,
	                            marginBottom: '0.15rem',
	                            paddingTop: '2px',
	                            paddingBottom: '2px',
	                            cursor: hasChildren ? 'pointer' : 'default',
	                            userSelect: 'none',
	                            backgroundColor: 'transparent',
	                            borderRadius: '0',
	                            boxSizing: 'border-box',
	                            borderLeft: isHighlightedDir ? '2px solid rgba(176, 141, 87, 0.8)' : '2px solid transparent',
	                        }}
	                        onClick={() => hasChildren && toggleExpand(path)}
	                    >
                        {/* Expand/Collapse Icon */}
                        <span style={{
                            width: '16px',
                            height: '16px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '4px',
                            color: '#B7B0A2',
                            fontSize: '12px',
                            fontWeight: 'bold',
                        }}>
                            {hasChildren ? (isExpanded ? '−' : '+') : ' '}
                        </span>

                        {/* Folder Icon */}
                        <span style={{
                            marginRight: '6px',
                            fontSize: '14px',
                        }}>
                            {isExpanded ? '📂' : '📁'}
                        </span>

                        {/* Folder Name */}
                        <span style={{
                            color: '#B08D57',
                            fontSize: '0.85rem',
                            fontFamily: "'Courier New', Courier, monospace",
                        }}>
                            {node.meta?.title || name}
                        </span>
                    </div>

                    {/* Children */}
                    {hasChildren && isExpanded && (
                        <div style={{ position: 'relative' }}>
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${Math.max(0, (depth + 1) * INDENT_REM - CONNECTOR_REM)}rem`,
                                    top: 0,
                                    bottom: 0,
                                    width: '1px',
                                    backgroundColor: 'rgba(230, 224, 210, 0.08)',
                                    pointerEvents: 'none',
                                }}
                            />
                            <div>
                                {childEntries.map(([childName, childNode]) => {
                                    const childPath = path === '/' ? `/${childName}` : `${path}/${childName}`;
                                    return renderNode(childNode, childName, childPath, depth + 1);
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        } else {
            // File node
	            return (
	                <div
	                    key={path}
	                    style={{
	                        display: 'flex',
	                        alignItems: 'center',
	                        marginLeft: `${indent}rem`,
	                        marginBottom: '0.15rem',
	                        paddingTop: '2px',
	                        paddingBottom: '2px',
	                        borderRadius: '0',
	                        boxSizing: 'border-box',
	                        borderLeft: isHighlightedFile ? '2px solid rgba(230, 224, 210, 0.7)' : '2px solid transparent',
	                        position: 'relative',
	                    }}
	                >
	                    <span
	                        aria-hidden="true"
	                        style={{
	                            position: 'absolute',
	                            left: `-${CONNECTOR_REM}rem`,
	                            top: '50%',
	                            width: `${CONNECTOR_REM}rem`,
	                            height: '1px',
	                            backgroundColor: 'rgba(230, 224, 210, 0.08)',
	                            transform: 'translateY(-50%)',
	                            pointerEvents: 'none',
	                        }}
	                    />
	                    {/* Spacer for alignment */}
	                    <span style={{
	                        width: '16px',
	                        marginRight: '4px',
	                    }}></span>

                    {/* File Icon */}
                    <span style={{
                        marginRight: '6px',
                        fontSize: '14px',
                    }}>
                        📄
                    </span>

                    {/* File Name */}
	                    <span style={{
	                        color: isHighlightedFile ? '#E6E0D2' : '#B7B0A2',
	                        fontWeight: isHighlightedFile ? 600 : 400,
	                        fontSize: '0.85rem',
	                        fontFamily: "'Courier New', Courier, monospace",
	                    }}>
	                        {node.meta?.title || name}
	                    </span>
                </div>
            );
        }
    };

    // Filter to only show actual book content
    const getBookNodes = () => {
        const nodes: Array<[string, DirectoryNode | FileNode, string]> = [];

        Object.entries(fs.root.children).forEach(([name, node]) => {
            if (name === 'books' && node.type === 'dir') {
                Object.entries(node.children).forEach(([bookName, bookNode]) => {
                    nodes.push([bookName, bookNode, `/books/${bookName}`]);
                });
            } else if (name !== 'about' && node.type === 'dir') {
                nodes.push([name, node, `/${name}`]);
            }
        });

        return nodes;
    };

    return (
        <div style={{
            overflowY: 'auto',
            height: '100%',
            paddingRight: '0.5rem',
        }}>
            <h2 style={{
                color: '#B08D57',
                margin: '0 0 1rem 0',
                fontSize: '0.95rem',
                fontWeight: '600',
                letterSpacing: '0.5px',
                borderBottom: '1px solid #2A2D2E',
                paddingBottom: '0.6rem',
                fontFamily: "'Courier New', Courier, monospace",
            }}>
                LIBRARY
            </h2>
            {getBookNodes().map(([name, node, path]) => {
                return renderNode(node, name, path, 0);
            })}
        </div>
    );
};
