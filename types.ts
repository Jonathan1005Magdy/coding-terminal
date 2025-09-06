
export enum NodeType {
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY',
}

export interface FileNode {
  type: NodeType.FILE;
  name: string;
  content: string;
}

export interface DirectoryNode {
  type: NodeType.DIRECTORY;
  name: string;
  children: { [key: string]: FileSystemNode };
}

export type FileSystemNode = FileNode | DirectoryNode;

export interface FileSystem {
  [key: string]: FileSystemNode;
}

export interface HistoryEntry {
  command: string;
  output: React.ReactNode;
  path: string;
}

export interface EditorState {
  isOpen: boolean;
  filePath: string | null;
  fileContent: string;
}
