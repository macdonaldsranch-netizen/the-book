'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const admin       = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const express     = require('express');
const cors        = require('cors');

admin.initializeApp();

const db   = getFirestore('thebook');
const auth = admin.auth();

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://the-book-mcd.web.app',
    'https://the-book-mcd.firebaseapp.com',
  ],
  credentials: true,
}));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();

const buildConfirmation = (reservationDate, count) => {
  const safeDate = (reservationDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  return `TB-${safeDate}-${String(count + 1).padStart(3, '0')}`;
};

const log = (action, detail, actor = '') =>
  db.collection('activity').add({ timestamp: nowIso(), action, detail, actor });

const docToObj = (doc) => ({ id: doc.id, ...doc.data() });

// ── Auth middleware ───────────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ detail: 'Missing Bearer token' });
    }
    const decoded = await auth.verifyIdToken(header.slice(7));
    req.user = { uid: decoded.uid, role: decoded.role || 'user', email: decoded.email || '' };
    next();
  } catch (e) {
    return res.status(401).json({ detail: `Invalid token: ${e.message}` });
  }
};

const requireStaff = (req, res, next) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ detail: 'Staff or admin access required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Admin access required' });
  }
  next();
};

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'the-book-mcd' });
});

// ══════════════════════════════════════════════════════════════════════════════
// RESERVATIONS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/reservations', verifyToken, requireStaff, async (req, res) => {
  try {
    const snap = await db.collection('reservations')
      .orderBy('reservationDate')
      .orderBy('startTime')
      .get();
    res.json(snap.docs.map(docToObj));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/reservations', verifyToken, requireStaff, async (req, res) => {
  try {
    const body    = req.body;
    const allDocs = await db.collection('reservations').get();
    const confNum = buildConfirmation(body.reservationDate, allDocs.size);
    const data    = {
      ...body,
      confirmationNumber: confNum,
      totalRiders:        (body.adultCount || 1) + (body.childCount || 0),
      createdAt:          nowIso(),
      updatedAt:          nowIso(),
      createdBy:          req.user.uid,
    };
    const ref = await db.collection('reservations').add(data);
    await log(
      'Reservation created',
      `${confNum} — ${body.firstName} ${body.lastName} on ${body.reservationDate} at ${body.startTime}`,
      req.user.email,
    );
    res.status(201).json({ id: ref.id, ...data });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.put('/api/reservations/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const ref  = db.collection('reservations').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ detail: 'Reservation not found' });

    const body = req.body;
    const data = {
      ...body,
      totalRiders: (body.adultCount || 1) + (body.childCount || 0),
      updatedAt:   nowIso(),
      updatedBy:   req.user.uid,
    };
    await ref.update(data);
    const existing = snap.data();
    await log(
      'Reservation updated',
      `${existing.confirmationNumber || req.params.id} — ${body.firstName} ${body.lastName} on ${body.reservationDate}`,
      req.user.email,
    );
    res.json({ status: 'updated', id: req.params.id });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.patch('/api/reservations/:id/attendance', verifyToken, requireStaff, async (req, res) => {
  try {
    const { attendanceStatus } = req.body;
    if (![null, undefined, 'checked-in', 'no-show'].includes(attendanceStatus)) {
      return res.status(400).json({ detail: 'Invalid attendanceStatus' });
    }
    const ref  = db.collection('reservations').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ detail: 'Reservation not found' });

    const d = snap.data();
    await ref.update({ attendanceStatus, updatedAt: nowIso(), updatedBy: req.user.uid });
    const guest = `${d.firstName || ''} ${d.lastName || ''}`.trim();
    await log(
      'Attendance updated',
      `${d.confirmationNumber || req.params.id} — ${guest} → ${attendanceStatus}`,
      req.user.email,
    );
    res.json({ status: 'updated', attendanceStatus });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.delete('/api/reservations/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const ref  = db.collection('reservations').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ detail: 'Reservation not found' });

    const d = snap.data();
    await ref.delete();
    await log(
      'Reservation deleted',
      `${d.confirmationNumber || req.params.id} — ${d.firstName || ''} ${d.lastName || ''}`,
      req.user.email,
    );
    res.json({ status: 'deleted' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// APPOINTMENTS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/appointments', verifyToken, requireStaff, async (req, res) => {
  try {
    const snap = await db.collection('appointments')
      .orderBy('appointmentDate')
      .orderBy('startTime')
      .get();
    res.json(snap.docs.map(docToObj));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/appointments', verifyToken, requireStaff, async (req, res) => {
  try {
    const body = req.body;
    const data = { ...body, createdAt: nowIso(), createdBy: req.user.uid };
    const ref  = await db.collection('appointments').add(data);
    await log(
      'Appointment added',
      `${body.title} — ${body.owner} at ${body.startTime} on ${body.appointmentDate}`,
      req.user.email,
    );
    res.status(201).json({ id: ref.id, ...data });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.put('/api/appointments/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const ref = db.collection('appointments').doc(req.params.id);
    if (!(await ref.get()).exists) {
      return res.status(404).json({ detail: 'Appointment not found' });
    }
    const body = req.body;
    await ref.update({ ...body, updatedAt: nowIso() });
    await log('Appointment updated', `${body.title} — ${body.owner} at ${body.startTime}`, req.user.email);
    res.json({ status: 'updated', id: req.params.id });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.delete('/api/appointments/:id', verifyToken, requireStaff, async (req, res) => {
  try {
    const ref  = db.collection('appointments').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ detail: 'Appointment not found' });

    const title = snap.data().title || req.params.id;
    await ref.delete();
    await log('Appointment deleted', title, req.user.email);
    res.json({ status: 'deleted' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/activity', verifyToken, requireStaff, async (req, res) => {
  try {
    const snap = await db.collection('activity')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    res.json(snap.docs.map(docToObj));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DAILY CAPACITY
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/capacity/:date', verifyToken, requireStaff, async (req, res) => {
  try {
    const snap = await db.collection('dailyCapacity').doc(req.params.date).get();
    if (snap.exists) return res.json(snap.data());

    const settings   = await db.collection('settings').doc('global').get();
    const defaultCap = settings.exists ? (settings.data().defaultCapacity || 20) : 20;
    res.json({ maxRiders: defaultCap, notes: '' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.put('/api/capacity/:date', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { maxRiders, notes = '' } = req.body;
    await db.collection('dailyCapacity').doc(req.params.date).set({ maxRiders, notes });
    await log('Capacity updated', `${req.params.date} → ${maxRiders} riders`, req.user.email);
    res.json({ status: 'updated', date: req.params.date, maxRiders, notes });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/settings', verifyToken, requireStaff, async (req, res) => {
  try {
    const snap = await db.collection('settings').doc('global').get();
    if (snap.exists) return res.json(snap.data());
    res.json({ defaultCapacity: 20, businessName: 'The Book', rideTypes: ['Group', 'Private', 'Kids'] });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.put('/api/settings', verifyToken, requireAdmin, async (req, res) => {
  try {
    await db.collection('settings').doc('global').set(req.body, { merge: true });
    await log('Settings updated', Object.keys(req.body).join(', '), req.user.email);
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (admin only)
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snap   = await db.collection('users').get();
    const result = await Promise.all(snap.docs.map(async (d) => {
      const row = docToObj(d);
      try {
        const rec  = await auth.getUser(d.id);
        row.disabled = rec.disabled;
      } catch {
        row.disabled = false;
      }
      return row;
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/users/invite', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { email, role = 'staff', password = 'ChangeMe123!' } = req.body;
    if (!email) return res.status(400).json({ detail: 'email required' });
    if (!['admin', 'staff', 'user'].includes(role)) {
      return res.status(400).json({ detail: 'Invalid role' });
    }
    const userRecord = await auth.createUser({ email, password });
    await auth.setCustomUserClaims(userRecord.uid, { role });
    await db.collection('users').doc(userRecord.uid).set({
      email, role, createdAt: nowIso(), createdBy: req.user.uid,
    });
    await log('User invited', `${email} as ${role}`, req.user.email);
    res.status(201).json({ status: 'created', uid: userRecord.uid, email, role });
  } catch (e) {
    res.status(400).json({ detail: e.message });
  }
});

app.post('/api/users/role', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { uid, role } = req.body;
    if (!['admin', 'staff', 'user'].includes(role)) {
      return res.status(400).json({ detail: 'role must be admin | staff | user' });
    }
    await auth.setCustomUserClaims(uid, { role });
    await db.collection('users').doc(uid).set({ role }, { merge: true });
    await log('Role updated', `${uid} → ${role}`, req.user.email);
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/users/disable', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    if (uid === req.user.uid) {
      return res.status(400).json({ detail: 'Cannot deactivate your own account' });
    }
    await auth.updateUser(uid, { disabled: true });
    await db.collection('users').doc(uid).set({ disabled: true }, { merge: true });
    await log('User deactivated', uid, req.user.email);
    res.json({ status: 'disabled' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/users/enable', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { uid } = req.body;
    await auth.updateUser(uid, { disabled: false });
    await db.collection('users').doc(uid).set({ disabled: false }, { merge: true });
    await log('User activated', uid, req.user.email);
    res.json({ status: 'enabled' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/users/reset-password', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { uid }    = req.body;
    const userRecord = await auth.getUser(uid);
    const link       = await auth.generatePasswordResetLink(userRecord.email);
    await log('Password reset link generated', userRecord.email, req.user.email);
    res.json({ link, email: userRecord.email });
  } catch (e) {
    res.status(404).json({ detail: e.message });
  }
});

app.post('/api/users/create', (req, res) => {
  res.status(410).json({ detail: 'Use /api/users/invite instead' });
});

// ── Export as Cloud Function ──────────────────────────────────────────────────
exports.api = onRequest(app);
