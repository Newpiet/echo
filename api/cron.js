const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@echo.example';
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

async function fetchUsers() {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
}

async function getTodayTodoCount(uid) {
  const todayStr = new Date().toDateString();
  const sparksSnap = await db.collection('users').doc(uid).collection('sparks').get();
  let count = 0;
  sparksSnap.forEach((d) => {
    const s = d.data();
    if (s && s.status !== 'done' && s.createdAt && new Date(s.createdAt).toDateString() === todayStr) {
      count += 1;
    }
  });
  return count;
}

async function sendReminder(to, count) {
  if (!SENDGRID_API_KEY) {
    console.log('SENDGRID_API_KEY not set, skip send');
    return;
  }
  const msg = {
    to,
    from: FROM_EMAIL,
    subject: `回声提醒：今日有 ${count} 个待学习项目`,
    text: `您今天有 ${count} 个待学习项目，打开回声继续推进吧。`,
  };
  await sgMail.send(msg);
}

module.exports = async (req, res) => {
  if (req.headers['x-vercel-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const users = await fetchUsers();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const u of users) {
      try {
        const settings = (u.data && u.data.settings) || {};
        const enabled = !!settings.reminderEnabled;
        const email = settings.reminderEmail;
        const time = settings.reminderTime;
        if (!enabled || !email || !time) continue;
        if (time !== hhmm) continue;

        const todoCount = await getTodayTodoCount(u.id);
        if (todoCount > 0) {
          await sendReminder(email, todoCount);
          console.log(`Sent reminder to ${email} count=${todoCount}`);
        }
      } catch (err) {
        console.error('Reminder loop error for user', u.id, err);
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Cron job failed', error);
    res.status(500).send('Internal Server Error');
  }
};
