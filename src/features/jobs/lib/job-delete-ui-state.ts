export type JobDeleteUiState = {
  confirmingJobId: string | null;
  deletingJobId: string | null;
  removedJobId: string | null;
  error: string | null;
};

export function idleDeleteUi(): JobDeleteUiState {
  return {
    confirmingJobId: null,
    deletingJobId: null,
    removedJobId: null,
    error: null,
  };
}

export function confirmDelete(state: JobDeleteUiState, jobId: string): JobDeleteUiState {
  if (state.deletingJobId || state.removedJobId === jobId) return state;
  return {
    ...state,
    confirmingJobId: jobId,
    error: null,
  };
}

export function cancelConfirm(state: JobDeleteUiState, jobId: string): JobDeleteUiState {
  if (state.deletingJobId === jobId) return state;
  return {
    ...state,
    confirmingJobId: state.confirmingJobId === jobId ? null : state.confirmingJobId,
    error: null,
  };
}

/** Returns null when a deletion is already in flight or this job was already removed. */
export function beginDelete(state: JobDeleteUiState, jobId: string): JobDeleteUiState | null {
  if (state.deletingJobId || state.removedJobId === jobId) return null;
  return {
    confirmingJobId: jobId,
    deletingJobId: jobId,
    removedJobId: null,
    error: null,
  };
}

export function deleteSucceeded(state: JobDeleteUiState, jobId: string): JobDeleteUiState {
  return {
    confirmingJobId: state.confirmingJobId === jobId ? null : state.confirmingJobId,
    deletingJobId: state.deletingJobId === jobId ? null : state.deletingJobId,
    removedJobId: jobId,
    error: null,
  };
}

export function deleteFailed(
  state: JobDeleteUiState,
  jobId: string,
  message: string,
): JobDeleteUiState {
  return {
    confirmingJobId: jobId,
    deletingJobId: state.deletingJobId === jobId ? null : state.deletingJobId,
    removedJobId: state.removedJobId === jobId ? null : state.removedJobId,
    error: message,
  };
}

/** Drop pending UI that belongs to a different job so a reused row cannot stay stuck. */
export function selectJob(state: JobDeleteUiState, jobId: string): JobDeleteUiState {
  const sameJob =
    state.confirmingJobId === jobId ||
    state.deletingJobId === jobId ||
    state.removedJobId === jobId;

  if (!sameJob && (state.confirmingJobId || state.deletingJobId || state.removedJobId || state.error)) {
    return idleDeleteUi();
  }

  return state;
}
