'use strict';

const { onRequest }    = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin            = require('firebase-admin');

// ── Twilio secrets (set via: firebase functions:secrets:set TWILIO_ACCOUNT_SID)
const twilioSid   = defineSecret('TWILIO_ACCOUNT_SID');
const twilioToken = defineSecret('TWILIO_AUTH_TOKEN');
const twilioFrom  = defineSecret('TWILIO_FROM_NUMBER');
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

/** Normalise a US phone to E.164, or return null if invalid */
const normalizePhone = (raw) => {
  const d = (raw || '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
};

/** Fire-and-forget Twilio SMS. Returns { sid } or { skipped:true } */
const sendSms = async (to, body) => {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { skipped: true };
  // eslint-disable-next-line global-require
  const client = require('twilio')(sid, token);
  const msg = await client.messages.create({ body, from, to });
  return { sid: msg.sid };
};

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
    // Soft-delete filter: never expose logically-deleted records
    res.json(snap.docs.filter(d => !d.data().deleted).map(docToObj));
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
      deleted:            false,
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

    // Auto-send SMS confirmation if phone is present and Twilio is configured
    const phone = normalizePhone(body.phoneNumber);
    if (phone) {
      const smsBody = [
        `Hi ${body.firstName}! Your trail ride at Macdonald's Ranch is confirmed ✅`,
        `Confirmation: ${confNum}`,
        `Date: ${body.reservationDate}  Time: ${body.startTime}`,
        `Riders: ${data.totalRiders}`,
        `Reply STOP to opt out.`,
      ].join('\n');
      sendSms(phone, smsBody)
        .then(r => { if (!r.skipped) ref.update({ textConfirmationStatus: 'Sent', textConfirmationSentAt: nowIso() }); })
        .catch(() => {});
    }

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
    if (d.deleted) return res.status(409).json({ detail: 'Already cancelled' });
    // Soft delete — record is never physically removed
    await ref.update({ deleted: true, deletedAt: nowIso(), deletedBy: req.user.uid });
    await log(
      'Reservation cancelled',
      `${d.confirmationNumber || req.params.id} — ${d.firstName || ''} ${d.lastName || ''}`,
      req.user.email,
    );
    res.json({ status: 'cancelled' });
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
    res.json(snap.docs.filter(d => !d.data().deleted).map(docToObj));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/api/appointments', verifyToken, requireStaff, async (req, res) => {
  try {
    const body = req.body;
    const data = { ...body, deleted: false, createdAt: nowIso(), createdBy: req.user.uid };
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

    const d = snap.data();
    if (d.deleted) return res.status(409).json({ detail: 'Already removed' });
    // Soft delete
    await ref.update({ deleted: true, deletedAt: nowIso(), deletedBy: req.user.uid });
    await log('Appointment removed', d.title || req.params.id, req.user.email);
    res.json({ status: 'removed' });
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

app.post('/api/users/set-password', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { uid, password } = req.body;
    if (!uid || !password) return res.status(400).json({ detail: 'uid and password required' });
    if (password.length < 6) return res.status(400).json({ detail: 'Password must be at least 6 characters' });
    await auth.updateUser(uid, { password });
    const userRecord = await auth.getUser(uid);
    await log('Password updated', userRecord.email, req.user.email);
    res.json({ status: 'updated' });
  } catch (e) {
    res.status(400).json({ detail: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SMS / MESSAGING  (staff + admin)
// ══════════════════════════════════════════════════════════════════════════════

/** Replace {token} placeholders in a message with reservation field values */
const resolveTemplate = (message, res) => {
  const fields = ['firstName','lastName','phoneNumber','confirmationNumber','rideType',
    'reservationDate','startTime','durationMinutes','adultCount','childCount',
    'totalRiders','specialRequests','guideCount'];
  return fields.reduce(
    (s, k) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), res[k] != null ? String(res[k]) : ''),
    message
  );
};

/**
 * POST /api/sms/send
 * Body selectors (pick one):
 *   { to, message }                              — specific phone number
 *   { reservation_id, message }                  — single reservation (resolves phone)
 *   { date, message }                            — all on a date
 *   { date, time, message }                      — all on a date at a time
 *   { date, time_from, time_to, message }        — all on a date in a time range
 *   { date_from, date_to, message }              — all in a date range
 */
app.post('/api/sms/send', verifyToken, requireStaff, async (req, res) => {
  try {
    const { to, reservation_id, date, time, time_from, time_to, date_from, date_to, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ detail: 'message is required' });
    }

    // Build list of { phone, resData } targets
    const targets = []; // { phone: string, resData: object|null }

    if (to) {
      // Specific phone — no reservation context for template resolution
      const phone = normalizePhone(to);
      if (!phone) return res.status(400).json({ detail: 'Invalid phone number' });
      targets.push({ phone, resData: null });

    } else if (reservation_id) {
      const snap = await db.collection('reservations').doc(reservation_id).get();
      if (!snap.exists) return res.status(404).json({ detail: 'Reservation not found' });
      const data = snap.data();
      const phone = normalizePhone(data.phoneNumber);
      if (!phone) return res.status(400).json({ detail: 'Reservation has no valid phone number' });
      targets.push({ phone, resData: { id: snap.id, ...data } });

    } else {
      // Query-based — collect matching reservations
      let query = db.collection('reservations');

      if (date && !date_from) {
        query = query.where('reservationDate', '==', date);
      } else if (date_from && date_to) {
        query = query.where('reservationDate', '>=', date_from).where('reservationDate', '<=', date_to);
      } else if (date_from) {
        query = query.where('reservationDate', '>=', date_from);
      } else {
        return res.status(400).json({ detail: 'Provide to, reservation_id, date, or date range' });
      }

      const snap = await query.get();
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.deleted || data.status === 'cancelled') continue;
        // Apply time filters
        if (time && data.startTime !== time) continue;
        if (time_from && time_to && !(time_from <= (data.startTime || '') && (data.startTime || '') <= time_to)) continue;
        const phone = normalizePhone(data.phoneNumber);
        if (phone) targets.push({ phone, resData: { id: doc.id, ...data } });
      }
    }

    if (!targets.length) {
      return res.json({ sent: 0, failed: 0, skipped: 0, detail: 'No reachable recipients found' });
    }

    // De-duplicate by phone (keep last seen reservation context)
    const seen = new Map();
    for (const t of targets) seen.set(t.phone, t);
    const skipped = targets.length - seen.size;

    let sent = 0, failed = 0;
    for (const { phone, resData } of seen.values()) {
      const text = resData ? resolveTemplate(message.trim(), resData) : message.trim();
      const r = await sendSms(phone, text);
      if (r.skipped) { /* Twilio not configured — dry run */ sent++; }
      else if (r.sid) { await db.collection('reservations').doc(resData?.id || '_').update({ lastSmsAt: nowIso() }).catch(() => {}); sent++; }
      else failed++;
    }

    await log('SMS sent', `${sent} sent · "${message.trim().slice(0, 60)}"`, req.user.email);
    res.json({ sent, failed, skipped });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// ── Export as Cloud Function ──────────────────────────────────────────────────
exports.api = onRequest({ secrets: [twilioSid, twilioToken, twilioFrom] }, app);
