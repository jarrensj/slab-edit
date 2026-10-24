import type { Box } from "@/lib/slab-image";

// Undo/redo for the boxes on a photo. Box arrays are replaced, never mutated,
// so an undo step is just the array from before the change.
export type BoxHistory = { present: Box[]; past: Box[][]; future: Box[][] };

export type BoxHistoryAction =
  // A new photo: its boxes, with nothing to undo.
  | { type: "reset"; boxes: Box[] }
  // A finished change (add, remove, a nudge): one undo step.
  | { type: "change"; boxes: Box[] }
  // Part of a change still in progress, like each move of a drag.
  | { type: "preview"; boxes: Box[] }
  // The in-progress change is done: one undo step back to `before`.
  | { type: "settle"; before: Box[] }
  | { type: "undo" }
  | { type: "redo" };

const MAX_STEPS = 100;

export const NO_HISTORY: BoxHistory = { present: [], past: [], future: [] };

function record(state: BoxHistory, before: Box[], present: Box[]): BoxHistory {
  if (before === present) return { ...state, present };
  return {
    present,
    past: [...state.past.slice(1 - MAX_STEPS), before],
    future: [],
  };
}

export function boxHistoryReducer(
  state: BoxHistory,
  action: BoxHistoryAction,
): BoxHistory {
  switch (action.type) {
    case "reset":
      return { present: action.boxes, past: [], future: [] };
    case "change":
      return record(state, state.present, action.boxes);
    case "preview":
      return { ...state, present: action.boxes };
    case "settle":
      return record(state, action.before, state.present);
    case "undo":
      if (!state.past.length) return state;
      return {
        present: state.past[state.past.length - 1],
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      };
    case "redo":
      if (!state.future.length) return state;
      return {
        present: state.future[0],
        past: [...state.past, state.present],
        future: state.future.slice(1),
      };
  }
}
