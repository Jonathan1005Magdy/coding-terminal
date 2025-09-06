
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileSystem,
  FileSystemNode,
  NodeType,
  DirectoryNode,
  FileNode,
  HistoryEntry,
  EditorState,
} from './types';
import { INITIAL_FILESYSTEM } from './constants';
import { runPythonCode, askAIQuestion, getManPage } from './services/geminiService';
import Editor from './components/Editor';

const WELCOME_MESSAGE = (
  <div>
    <p>Welcome to React AI Terminal!</p>
    <p>This is a simulated Linux environment with AI capabilities.</p>
    <p>Type <span className="text-green-400">'help'</span> to see a list of available commands.</p>
    <br/>
  </div>
);

const HELP_MESSAGE = (
    <div className="text-gray-300">
        <p className="font-bold text-green-400 mb-2">Available Commands:</p>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-1">
            <li><span className="font-bold text-cyan-400 w-28 inline-block">ls</span> - List directory contents</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">cd [dir]</span> - Change directory</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">cat [file]</span> - Display file content</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">mkdir [dir]</span> - Create a directory</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">touch [file]</span> - Create an empty file</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">echo [text] &gt; [file]</span> - Write text to a file</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">edit [file]</span> - Open a file in the editor</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">python [file]</span> - 'Execute' a Python file using AI</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">askai [question]</span> - Ask the AI a question</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">clear</span> - Clear the terminal screen</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">help</span> - Display this help message</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">whoami</span> - Display current user</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">date</span> - Display current date</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">pwd</span> - Print working directory</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">history</span> - Show command history</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">rm [-r] [path]</span> - Remove file or directory</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">mv [src] [dest]</span> - Move or rename file</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">cp [src] [dest]</span> - Copy file</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">man [cmd]</span> - Show manual for command</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">grep [patt] [file]</span> - Find pattern in file</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">head [file]</span> - Show first 10 lines</li>
            <li><span className="font-bold text-cyan-400 w-28 inline-block">tail [file]</span> - Show last 10 lines</li>
        </ul>
    </div>
);

// Helper to get a node from a path in a given file system
const getNodeFromPath = (fs: FileSystem, path: string[]) => {
    let current: DirectoryNode | FileSystemNode = { type: NodeType.DIRECTORY, name: 'root', children: fs };
    for (const segment of path) {
        if (current.type === NodeType.DIRECTORY && current.children[segment]) {
            current = current.children[segment];
        } else {
            return null;
        }
    }
    return current;
};

const App: React.FC = () => {
    const [history, setHistory] = useState<HistoryEntry[]>([{ command: '', output: WELCOME_MESSAGE, path: '~' }]);
    const [command, setCommand] = useState('');
    const [fileSystem, setFileSystem] = useState<FileSystem>(INITIAL_FILESYSTEM);
    const [currentPath, setCurrentPath] = useState<string[]>(['home', 'user']);
    const [editorState, setEditorState] = useState<EditorState>({ isOpen: false, filePath: null, fileContent: '' });
    const [isLoading, setIsLoading] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isLoading]);

    const resolvePath = (path: string, base: string[] = currentPath): { parent: DirectoryNode | null, node: FileSystemNode | null, name: string, fullPath: string[] } => {
        if (!path) {
            const parentPath = base.slice(0, -1);
            const parent = getNodeFromPath(fileSystem, parentPath) as DirectoryNode | null;
            const node = getNodeFromPath(fileSystem, base) as DirectoryNode | null;
            return { parent, node, name: base[base.length - 1] || '', fullPath: base };
        }
        
        const isAbsolutePath = path.startsWith('/');
        const pathSegments = path.replace(/\/$/, '').split('/').filter(p => p && p !== '.');
        
        let resolutionPath = isAbsolutePath ? [] : [...base];
        
        for (const segment of pathSegments) {
            if (segment === '..') {
                if (resolutionPath.length > 0) {
                    resolutionPath.pop();
                }
            } else {
                resolutionPath.push(segment);
            }
        }

        const node = getNodeFromPath(fileSystem, resolutionPath);
        const parentPath = resolutionPath.slice(0, -1);
        const parent = getNodeFromPath(fileSystem, parentPath) as DirectoryNode | null;
        const name = resolutionPath[resolutionPath.length - 1] || '';

        // Handle case where path is valid up to parent, but target node doesn't exist
        if (!node) {
            const potentialParentPath = path.split('/').slice(0, -1).join('/');
            const {node: potentialParent} = resolvePath(potentialParentPath || (isAbsolutePath ? '/' : '.'), base);
            if (potentialParent && potentialParent.type === NodeType.DIRECTORY) {
                 return { parent: potentialParent as DirectoryNode, node: null, name: path.split('/').pop() || '', fullPath: resolutionPath };
            }
        }
        
        return { parent, node, name, fullPath: resolutionPath };
    };

    const getPathString = (pathArray: string[] = currentPath) => `/${pathArray.join('/')}`;

    const handleCommand = useCallback(async (cmd: string) => {
        const [action, ...args] = cmd.trim().split(' ');
        let output: React.ReactNode = '';
        const newHistoryEntry: HistoryEntry = { command: cmd, output: '', path: getPathString().replace('/home/user', '~') };
        
        setHistory(prev => [...prev.filter(h => h.command !== ''), newHistoryEntry]);
        setIsLoading(true);

        const updateOutput = (newOutput: React.ReactNode) => {
            setHistory(prev => {
                const updatedHistory = [...prev];
                updatedHistory[updatedHistory.length - 1] = { ...newHistoryEntry, output: newOutput };
                return updatedHistory;
            });
        };

        switch (action) {
            case 'help':
                output = HELP_MESSAGE;
                break;
            case 'clear':
                setHistory([]);
                setIsLoading(false);
                return;
            case 'whoami':
                output = 'user';
                break;
            case 'date':
                output = new Date().toString();
                break;
            case 'pwd':
                output = getPathString();
                break;
            case 'history':
                output = (
                    <ol>
                        {history.filter(h => h.command).map((h, i) => (
                           <li key={i}><span className="w-8 inline-block text-right pr-2">{i+1}</span>{h.command}</li>
                        ))}
                    </ol>
                );
                break;
            case 'ls': {
                const targetPath = args[0] || '.';
                const { node: lsNode } = resolvePath(targetPath);
                if (lsNode && lsNode.type === NodeType.DIRECTORY) {
                    output = (
                        <div className="flex flex-wrap gap-x-4">
                            {Object.values(lsNode.children).map(child => (
                                <span key={child.name} className={child.type === NodeType.DIRECTORY ? 'text-blue-400' : 'text-gray-300'}>
                                    {child.name}
                                </span>
                            ))}
                        </div>
                    );
                } else if(lsNode && lsNode.type === NodeType.FILE) {
                     output = lsNode.name;
                }
                else {
                    output = `ls: cannot access '${targetPath}': No such file or directory`;
                }
                break;
            }
            case 'cd': {
                const path = args[0] || '/home/user';
                const { node: cdNode, fullPath: newFullPath } = resolvePath(path === '~' ? '/home/user' : path);
                if (cdNode && cdNode.type === NodeType.DIRECTORY) {
                     setCurrentPath(newFullPath);
                } else {
                    output = `cd: ${path}: No such file or directory`;
                }
                break;
            }
            case 'cat':
            case 'head':
            case 'tail': {
                if (!args[0]) {
                    output = `${action}: missing file operand`;
                    break;
                }
                const { node } = resolvePath(args[0]);
                if (node && node.type === NodeType.FILE) {
                    const lines = node.content.split('\n');
                    let contentToShow: string;
                    if (action === 'head') {
                        contentToShow = lines.slice(0, 10).join('\n');
                    } else if (action === 'tail') {
                        contentToShow = lines.slice(-10).join('\n');
                    } else {
                        contentToShow = node.content;
                    }
                    output = <pre className="whitespace-pre-wrap">{contentToShow}</pre>;
                } else if (node && node.type === NodeType.DIRECTORY) {
                    output = `${action}: ${args[0]}: Is a directory`;
                } else {
                    output = `${action}: ${args[0]}: No such file or directory`;
                }
                break;
            }
            case 'mkdir':
            case 'touch': {
                const targetName = args[0];
                if (!targetName) {
                    output = `${action}: missing operand`;
                    break;
                }
                const { parent, node: existingNode, name, fullPath } = resolvePath(targetName);

                if (existingNode) {
                    output = `${action}: cannot create ${action === 'mkdir' ? 'directory' : 'file'} '${targetName}': File exists`;
                } else if (parent) {
                    const newFS = JSON.parse(JSON.stringify(fileSystem));
                    const newParent = getNodeFromPath(newFS, fullPath.slice(0, -1)) as DirectoryNode;
                    
                    if (action === 'mkdir') {
                        newParent.children[name] = { type: NodeType.DIRECTORY, name, children: {} };
                    } else {
                        newParent.children[name] = { type: NodeType.FILE, name, content: '' };
                    }
                    setFileSystem(newFS);
                } else {
                    output = `${action}: cannot create ${action === 'mkdir' ? 'directory' : 'file'} '${targetName}': No such file or directory`;
                }
                break;
            }
            case 'edit': {
                 const targetName = args[0];
                if (!targetName) {
                    output = `edit: missing operand`;
                    break;
                }
                const { parent, node: existingNode, name, fullPath } = resolvePath(targetName);
                if (existingNode) {
                    if (existingNode.type === NodeType.FILE) {
                        setEditorState({ isOpen: true, filePath: getPathString(fullPath), fileContent: existingNode.content });
                    } else {
                        output = `edit: ${targetName}: Is a directory`;
                    }
                } else if (parent) {
                     const newFS = JSON.parse(JSON.stringify(fileSystem));
                     const newParent = getNodeFromPath(newFS, fullPath.slice(0, -1)) as DirectoryNode;
                     newParent.children[name] = { type: NodeType.FILE, name, content: '' };
                     setFileSystem(newFS);
                     setEditorState({ isOpen: true, filePath: getPathString(fullPath), fileContent: '' });
                } else {
                     output = `edit: cannot create file '${targetName}': No such file or directory`;
                }
                break;
            }
            case 'echo': {
                const echoCmd = cmd.substring(5);
                const redirectIndex = echoCmd.lastIndexOf('>');
                if (redirectIndex === -1) {
                    output = echoCmd;
                    break;
                }
                
                const content = echoCmd.substring(0, redirectIndex).trim().replace(/^['"]|['"]$/g, '');
                const fileName = echoCmd.substring(redirectIndex + 1).trim();
                
                if (!fileName) {
                    output = 'echo: missing output file';
                    break;
                }
                
                const { parent, node, name, fullPath } = resolvePath(fileName);
                if (parent) {
                     const newFS = JSON.parse(JSON.stringify(fileSystem));
                     const newParent = getNodeFromPath(newFS, fullPath.slice(0, -1)) as DirectoryNode;
                     newParent.children[name] = { type: NodeType.FILE, name, content };
                     setFileSystem(newFS);
                } else {
                    output = `echo: cannot write to '${fileName}': Invalid path`;
                }
                break;
            }
             case 'rm': {
                const isRecursive = args[0] === '-r';
                const targetPath = isRecursive ? args[1] : args[0];

                if (!targetPath) {
                    output = 'rm: missing operand';
                    break;
                }

                const { node: rmNode, fullPath: rmFullPath } = resolvePath(targetPath);

                if (!rmNode) {
                    output = `rm: cannot remove '${targetPath}': No such file or directory`;
                    break;
                }
                if (rmNode.type === NodeType.DIRECTORY && Object.keys(rmNode.children).length > 0 && !isRecursive) {
                    output = `rm: cannot remove '${targetPath}': Is a directory`;
                    break;
                }

                const newFS = JSON.parse(JSON.stringify(fileSystem));
                const parentPath = rmFullPath.slice(0, -1);
                const parentInNewFS = getNodeFromPath(newFS, parentPath) as DirectoryNode;
                
                delete parentInNewFS.children[rmNode.name];
                setFileSystem(newFS);
                break;
            }
            case 'mv':
            case 'cp': {
                const [sourcePath, destPath] = args;
                if (!sourcePath || !destPath) {
                    output = `${action}: missing operand`;
                    break;
                }
                
                const { node: sourceNode, fullPath: sourceFullPath } = resolvePath(sourcePath);
                if (!sourceNode) {
                    output = `${action}: cannot stat '${sourcePath}': No such file or directory`;
                    break;
                }

                let { node: destNode, name: destName, fullPath: destFullPath } = resolvePath(destPath);
                
                const newFS = JSON.parse(JSON.stringify(fileSystem));
                const newSourceNode = JSON.parse(JSON.stringify(sourceNode));

                let finalDestParentPath = destFullPath.slice(0, -1);
                let finalDestName = destName;

                if (destNode && destNode.type === NodeType.DIRECTORY) {
                    finalDestParentPath = destFullPath;
                    finalDestName = sourceNode.name;
                }
                newSourceNode.name = finalDestName;

                const destParent = getNodeFromPath(newFS, finalDestParentPath) as DirectoryNode;
                if (!destParent || destParent.type !== NodeType.DIRECTORY) {
                     output = `${action}: cannot move to '${destPath}': No such file or directory`;
                     break;
                }
                destParent.children[finalDestName] = newSourceNode;
                
                if (action === 'mv') {
                    const sourceParent = getNodeFromPath(newFS, sourceFullPath.slice(0, -1)) as DirectoryNode;
                    delete sourceParent.children[sourceNode.name];
                }

                setFileSystem(newFS);
                break;
            }
             case 'grep': {
                const [pattern, filePath] = args;
                if (!pattern || !filePath) {
                    output = `usage: grep [pattern] [file]`;
                    break;
                }
                const { node } = resolvePath(filePath);
                if (node && node.type === NodeType.FILE) {
                    const matches = node.content.split('\n').filter(line => line.includes(pattern));
                    output = (
                        <div>
                            {matches.map((line, i) => {
                                const parts = line.split(new RegExp(`(${pattern})`, 'gi'));
                                return (
                                    <pre key={i} className="whitespace-pre-wrap">
                                        {parts.map((part, j) => 
                                            part.toLowerCase() === pattern.toLowerCase() 
                                            ? <span key={j} className="bg-yellow-500 text-black">{part}</span> 
                                            : <span key={j}>{part}</span>
                                        )}
                                    </pre>
                                );
                            })}
                        </div>
                    );
                } else {
                    output = `grep: ${filePath}: No such file or directory`;
                }
                break;
            }
            case 'man': {
                const commandName = args[0];
                if (!commandName) {
                    output = 'man: what manual page do you want?';
                    break;
                }
                updateOutput(<div className="text-yellow-400">Fetching manual page...</div>);
                const manPage = await getManPage(commandName);
                output = <pre className="whitespace-pre-wrap">{manPage}</pre>;
                break;
            }
            case 'python': {
                if (!args[0]) {
                    output = 'python: missing file operand';
                    break;
                }
                const { node: pyNode } = resolvePath(args[0]);
                if (pyNode && pyNode.type === NodeType.FILE) {
                    updateOutput(<div className="text-yellow-400">Executing with AI...</div>);
                    const result = await runPythonCode(pyNode.content);
                    output = <pre className="whitespace-pre-wrap">{result}</pre>;
                } else {
                    output = `python: can't open file '${args[0]}': [Errno 2] No such file or directory`;
                }
                break;
            }
            case 'askai': {
                const question = args.join(' ');
                if (!question) {
                    output = 'askai: please provide a question.';
                    break;
                }
                updateOutput(<div className="text-yellow-400">Thinking...</div>);
                const answer = await askAIQuestion(question);
                output = <pre className="whitespace-pre-wrap">{answer}</pre>;
                break;
            }
            case '':
                break; // Do nothing for empty command
            default:
                output = `command not found: ${action}`;
        }

        updateOutput(output);
        setIsLoading(false);
    }, [currentPath, fileSystem, history]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleCommand(command);
        setCommand('');
    };
    
    const handleSaveFile = (filePath: string, content: string) => {
        const { fullPath } = resolvePath(filePath.substring(1)); // remove leading '/'
        if (fullPath.length > 0) {
            const newFS = JSON.parse(JSON.stringify(fileSystem));
            const fileToSave = getNodeFromPath(newFS, fullPath) as FileNode;
            if (fileToSave && fileToSave.type === NodeType.FILE) {
                 fileToSave.content = content;
                 setFileSystem(newFS);
            }
        }
    };

    const pathDisplay = getPathString().replace('/home/user', '~');

    return (
        <div 
          className="bg-gray-900 text-gray-200 font-mono h-screen w-screen p-4 flex flex-col"
          onClick={() => inputRef.current?.focus()}
        >
            <div className="flex-grow overflow-y-auto pr-2">
                {history.map((entry, index) => (
                    <div key={index} className="mb-2">
                        {entry.command && (
                             <div className="flex items-center">
                                <span className="text-green-400">user@react-os:</span>
                                <span className="text-blue-400">{entry.path}</span>
                                <span className="text-gray-200 mr-2">$</span>
                                <p className="flex-1 whitespace-pre-wrap">{entry.command}</p>
                            </div>
                        )}
                        <div>{entry.output}</div>
                    </div>
                ))}
                 {isLoading && <div className="text-gray-400">Loading...</div>}
                <div ref={terminalEndRef} />
            </div>

            <form onSubmit={handleFormSubmit} className="flex items-center mt-2">
                 <span className="text-green-400">user@react-os:</span>
                 <span className="text-blue-400">{pathDisplay}</span>
                 <span className="text-gray-200 mr-2">$</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="bg-transparent text-gray-200 focus:outline-none w-full"
                    disabled={isLoading}
                    autoFocus
                />
            </form>
            <Editor editorState={editorState} onClose={() => setEditorState({ ...editorState, isOpen: false })} onSave={handleSaveFile} />
        </div>
    );
};

export default App;
