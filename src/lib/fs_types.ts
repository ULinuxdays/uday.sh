export interface MetaInfo {
    title: string;
    date?: string;
    tags?: string[];
    description?: string;
}

export interface FileNode {
    type: 'file';
    name: string;
    slug: string; // The content slug
    meta: MetaInfo;
    content?: string;
}

export interface DirectoryNode {
    type: 'dir';
    name: string;
    children: Record<string, DirectoryNode | FileNode>;
    meta?: MetaInfo;
}

export type FSNode = DirectoryNode | FileNode;

export interface VirtualFS {
    root: DirectoryNode;
}
