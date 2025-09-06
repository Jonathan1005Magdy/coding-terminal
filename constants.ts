import { FileSystem, NodeType } from './types';

export const INITIAL_FILESYSTEM: FileSystem = {
  'home': {
    type: NodeType.DIRECTORY,
    name: 'home',
    children: {
      'user': {
        type: NodeType.DIRECTORY,
        name: 'user',
        children: {
          'README.md': {
            type: NodeType.FILE,
            name: 'README.md',
            content: 'Hello! This is a README file. You can edit it using the `edit` command.',
          },
          'example.py': {
            type: NodeType.FILE,
            name: 'example.py',
            content: 'def factorial(n):\n    if n == 0:\n        return 1\n    else:\n        return n * factorial(n-1)\n\nprint(f"The factorial of 5 is {factorial(5)}")\n',
          },
        },
      },
    },
  },
};
