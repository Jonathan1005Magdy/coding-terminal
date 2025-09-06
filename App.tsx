import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileSystem,
  FileSystemNode,
  NodeType,
  DirectoryNode,
  HistoryEntry,
  EditorState,
} from './types';
import { INITIAL_FILESYSTEM } from './constants';
import { runPythonCode, askAIQuestion } from './services/geminiService';
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
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
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
        </ul>
    </div>
);

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

    const resolvePath = (path: string): { parent: DirectoryNode | null, node: FileSystemNode | null, name: string, fullPath: string[] } => {
        const pathSegments = path.replace(/\/$/, '').split('/').filter(p => p);
        let startNode: DirectoryNode = { type: NodeType.DIRECTORY, name: 'root', children: fileSystem };
        let resolvedPath: string[];

        if (path.startsWith('/')) {
            resolvedPath = [];
        } else {
            resolvedPath = [...currentPath];
        }

        let currentNode: FileSystemNode = startNode;
        for (const segment of resolvedPath) {
            if (currentNode.type === NodeType.DIRECTORY && currentNode.children[segment]) {
                currentNode = currentNode.children[segment];
            }
        }

        let parent: DirectoryNode | null = currentNode as DirectoryNode;
        
        for (let i = 0; i < pathSegments.length; i++) {
            const segment = pathSegments[i];
            if (segment === '.') continue;
            if (segment === '..') {
                if (resolvedPath.length > 0) {
                    resolvedPath.pop();
                }
                continue;
            }
            if (parent && parent.type === NodeType.DIRECTORY && parent.children[segment]) {
                const nextNode = parent.children[segment];
                if (i < pathSegments.length - 1) { // It's a directory in the middle of the path
                    if (nextNode.type === NodeType.DIRECTORY) {
                         parent = nextNode;
                    } else {
                        return { parent: null, node: null, name: '', fullPath: [] }; // Invalid path
                    }
                } else { // This is the final segment
                    return { parent, node: nextNode, name: segment, fullPath: [...resolvedPath, segment] };
                }
            } else {
                 if (i === pathSegments.length - 1) { // Target doesn't exist, but path to parent is valid
                    return { parent, node: null, name: segment, fullPath: [...resolvedPath, segment] };
                }
                return { parent: null, node: null, name: '', fullPath: [] };
            }
        }
        return { parent: null, node: parent, name: parent.name, fullPath: resolvedPath };
    };

    const getPathString = (pathArray: string[] = currentPath) => `/${pathArray.join('/')}`;

    const handleCommand = useCallback(async (cmd: string) => {
        const [action, ...args] = cmd.trim().split(' ');
        let output: React.ReactNode = '';
        const newHistoryEntry: HistoryEntry = { command: cmd, output: '', path: getPathString().replace('/home/user', '~') };
        
        setHistory(prev => [...prev, newHistoryEntry]);
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
            case 'ls': {
                const { node: lsNode } = resolvePath(args[0] || '.');
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
                } else {
                    output = `ls: cannot access '${args[0] || '.'}': No such file or directory`;
                }
                break;
            }
            case 'cd': {
                const path = args[0] || '/home/user';
                const { node: cdNode, fullPath: newFullPath } = resolvePath(path);
                if (cdNode && cdNode.type === NodeType.DIRECTORY) {
                     setCurrentPath(newFullPath);
                } else {
                    output = `cd: ${path}: No such file or directory`;
                }
                break;
            }
            case 'cat': {
                if (!args[0]) {
                    output = 'cat: missing file operand';
                    break;
                }
                const { node: catNode } = resolvePath(args[0]);
                if (catNode && catNode.type === NodeType.FILE) {
                    output = <pre className="whitespace-pre-wrap">{catNode.content}</pre>;
                } else if (catNode && catNode.type === NodeType.DIRECTORY) {
                    output = `cat: ${args[0]}: Is a directory`;
                } else {
                    output = `cat: ${args[0]}: No such file or directory`;
                }
                break;
            }
            case 'mkdir':
            case 'touch':
            case 'edit': {
                const targetName = args[0];
                if (!targetName) {
                    output = `${action}: missing operand`;
                    break;
                }
                const { parent: targetParent, node: existingNode } = resolvePath(targetName);
                if (existingNode) {
                    output = `${action}: cannot create ${action === 'mkdir' ? 'directory' : 'file'} '${targetName}': File exists`;
                     if (action === 'edit' && existingNode.type === NodeType.FILE) {
                        setEditorState({ isOpen: true, filePath: getPathString([...currentPath, targetName]), fileContent: existingNode.content });
                        output = '';
                    } else if (action === 'edit') {
                        output = `edit: ${targetName}: Is a directory`;
                    }
                } else if (targetParent) {
                     const newFS = { ...fileSystem }; // Deep copy would be better for robustness
                     let currentLevel = newFS;
                     currentPath.forEach(p => {
                        currentLevel = (currentLevel[p] as DirectoryNode).children;
                     });
                     
                     if (action === 'mkdir') {
                        currentLevel[targetName] = { type: NodeType.DIRECTORY, name: targetName, children: {} };
                     } else {
                        const content = action === 'edit' ? '' : '';
                        currentLevel[targetName] = { type: NodeType.FILE, name: targetName, content };
                        if (action === 'edit') {
                            setEditorState({ isOpen: true, filePath: getPathString([...currentPath, targetName]), fileContent: '' });
                        }
                     }
                     setFileSystem(newFS);
                } else {
                    output = `${action}: cannot create ${action === 'mkdir' ? 'directory' : 'file'} '${targetName}': No such file or directory`;
                }
                break;
            }
            case 'echo': {
                const contentIndex = cmd.indexOf('>') > -1 ? cmd.indexOf('>') : cmd.length;
                const content = cmd.substring(5, contentIndex).trim();
                const fileName = cmd.substring(contentIndex + 1).trim();
                if (!fileName) {
                    output = 'echo: missing output file';
                    break;
                }
                const { parent: echoParent, node: echoNode } = resolvePath(fileName);
                if (echoParent) {
                     const newFS = { ...fileSystem };
                     let currentLevel = newFS;
                     currentPath.forEach(p => {
                        currentLevel = (currentLevel[p] as DirectoryNode).children;
                     });
                     currentLevel[fileName] = { type: NodeType.FILE, name: fileName, content: content.replace(/^['"]|['"]$/g, '') }; // remove quotes
                     setFileSystem(newFS);
                } else {
                    output = `echo: cannot write to '${fileName}': Invalid path`;
                }
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
    }, [currentPath, fileSystem]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleCommand(command);
        setCommand('');
    };
    
    const handleSaveFile = (filePath: string, content: string) => {
        const { parent, name } = resolvePath(filePath.substring(1)); // remove leading '/'
        if (parent) {
            const newFS = { ...fileSystem };
            let currentLevel: any = newFS;
            filePath.substring(1).split('/').slice(0, -1).forEach(p => {
                currentLevel = currentLevel[p].children;
            });

            if (currentLevel[name] && currentLevel[name].type === NodeType.FILE) {
                currentLevel[name].content = content;
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