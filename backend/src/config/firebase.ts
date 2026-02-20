import * as admin from 'firebase-admin';
import { getEnv } from './env';
import { logger } from '../utils/logger';

let _db: FirebaseFirestore.Firestore | null = null;

export function initFirebase(): FirebaseFirestore.Firestore {
  if (_db) return _db;

  const env = getEnv();

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
    });
    logger.info({ projectId: env.FIREBASE_PROJECT_ID }, 'Firebase Admin initialized');
  }

  _db = admin.firestore();
  return _db;
}

export function getDb(): FirebaseFirestore.Firestore {
  if (!_db) return initFirebase();
  return _db;
}
