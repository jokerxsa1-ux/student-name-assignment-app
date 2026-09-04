import { useReducer } from 'react';
import { appConfig } from '../appConfig';
import { createInitialProject, type ProjectState } from './appState';

interface HistoryState {
  past: ProjectState[];
  present: ProjectState;
  future: ProjectState[];
}

type Action =
  | { type: 'commit'; update: (current: ProjectState) => ProjectState }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; project: ProjectState };

function reducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'commit') {
    const next = action.update(state.present);
    if (Object.is(next, state.present)) return state;
    return {
      past: [...state.past, state.present].slice(-appConfig.undoLimit),
      present: next,
      future: [],
    };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    return { past: [...state.past, state.present].slice(-appConfig.undoLimit), present: next, future: state.future.slice(1) };
  }
  return { past: [], present: action.project, future: [] };
}

export function useUndoableProject() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: createInitialProject(),
    future: [],
  }));

  return {
    project: state.present,
    updateProject: (update: (current: ProjectState) => ProjectState) => dispatch({ type: 'commit', update }),
    replaceProject: (project: ProjectState) => dispatch({ type: 'replace', project }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
