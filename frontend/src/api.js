/**
 * api.js — thin wrapper around fetch that automatically attaches the
 * Firebase ID token as `Authorization: Bearer <token>` on every request.
 *
 * The FastAPI backend verifies this token on every endpoint.
 */

import { firebaseAuth } from './firebase';

const BASE = '/api';   // proxied to localhost:8081 in dev; rewritten to Cloud Function in prod

async function _getToken() {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Not authenticated');
  // getIdToken(true) forces a refresh if the token is close to expiry
  return user.getIdToken(false);
}

async function request(method, path, body) {
  const token = await _getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Reservations ──────────────────────────────────────────────────────────────
export const getReservations     = ()              => request('GET',    '/reservations');
export const createReservation   = (body)          => request('POST',   '/reservations', body);
export const updateReservation   = (id, body)      => request('PUT',    `/reservations/${id}`, body);
export const deleteReservation   = (id)            => request('DELETE', `/reservations/${id}`);
export const patchAttendance     = (id, status)    => request('PATCH',  `/reservations/${id}/attendance`, { attendanceStatus: status });

// ── Appointments ──────────────────────────────────────────────────────────────
export const getAppointments     = ()              => request('GET',    '/appointments');
export const createAppointment   = (body)          => request('POST',   '/appointments', body);
export const updateAppointment   = (id, body)      => request('PUT',    `/appointments/${id}`, body);
export const deleteAppointment   = (id)            => request('DELETE', `/appointments/${id}`);

// ── Activity log ──────────────────────────────────────────────────────────────
export const getActivity         = ()              => request('GET',    '/activity');

// ── Daily capacity ────────────────────────────────────────────────────────────
export const getCapacity         = (dateStr)       => request('GET',    `/capacity/${dateStr}`);
export const setCapacity         = (dateStr, body) => request('PUT',    `/capacity/${dateStr}`, body);

// ── Settings ──────────────────────────────────────────────────────────────────
export const getSettings         = ()              => request('GET',    '/settings');
export const updateSettings      = (body)          => request('PUT',    '/settings', body);

// ── User management (admin only) ──────────────────────────────────────────────
export const listUsers           = ()              => request('GET',    '/users');
export const inviteUser          = (body)          => request('POST',   '/users/invite', body);
export const setUserRole         = (uid, role)     => request('POST',   '/users/role', { uid, role });
export const disableUser         = (uid)           => request('POST',   '/users/disable', { uid });
export const enableUser          = (uid)           => request('POST',   '/users/enable', { uid });
export const resetUserPassword   = (uid)           => request('POST',   '/users/reset-password', { uid });
