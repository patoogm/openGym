import { api } from './api.js'

// Student side: the routines this user's coach has assigned. Never throws —
// an offline or non-student user simply has none this session.
export async function fetchAssigned() {
  try { return (await api('/api/coaching/assigned')).routines || [] }
  catch { return [] }
}

// Coach side.
export const listStudents = () => api('/api/coaching/students')
export const getStudent = id => api('/api/coaching/student?id=' + encodeURIComponent(id))
export const assignRoutine = (studentId, routineId) =>
  api('/api/coaching/assign', { method: 'POST', body: JSON.stringify({ studentId, routineId }) })
export const unassignRoutine = assignmentId =>
  api('/api/coaching/unassign', { method: 'POST', body: JSON.stringify({ assignmentId }) })
export const resolveRequest = id =>
  api('/api/coaching/change-request/resolve', { method: 'POST', body: JSON.stringify({ id }) })
export const requestAdjustment = (assignmentId, note) =>
  api('/api/coaching/change-request', { method: 'POST', body: JSON.stringify({ assignmentId, note }) })
