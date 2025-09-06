
import React, { useState, useEffect } from 'react';
import type { EditorState } from '../types';

interface EditorProps {
  editorState: EditorState;
  onSave: (filePath: string, content: string) => void;
  onClose: () => void;
}

const Editor: React.FC<EditorProps> = ({ editorState, onSave, onClose }) => {
  const [content, setContent] = useState(editorState.fileContent);

  useEffect(() => {
    setContent(editorState.fileContent);
  }, [editorState.fileContent]);

  if (!editorState.isOpen || !editorState.filePath) {
    return null;
  }

  const handleSave = () => {
    onSave(editorState.filePath!, content);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      // Move cursor after the inserted tab
      setTimeout(() => {
        e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
      }, 0);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-lg w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        <div className="bg-gray-900 text-white p-3 flex justify-between items-center rounded-t-lg">
          <h2 className="font-mono text-sm">Editing: {editorState.filePath}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-grow bg-gray-900 text-gray-200 p-4 font-mono w-full focus:outline-none resize-none text-sm"
          spellCheck="false"
        />
        <div className="bg-gray-900 p-3 flex justify-end space-x-4 rounded-b-lg border-t border-gray-700">
          <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm">
            Save & Exit
          </button>
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm">
            Discard & Exit
          </button>
        </div>
      </div>
    </div>
  );
};

export default Editor;
