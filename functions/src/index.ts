import * as admin from 'firebase-admin';

admin.initializeApp();

export { generateQuestions } from './generateQuestions';
export { reviewQuestion, setUserRole } from './reviewQuestions';
