import { createContext, useContext } from 'react';

export const BlockWorkspaceContext = createContext({ nodes: [], boardId: '', selection: null });
export const useBlockWorkspace = () => useContext(BlockWorkspaceContext);
