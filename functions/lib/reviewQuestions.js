"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserRole = exports.reviewQuestion = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
async function assertIsAdmin(uid) {
    const db = admin.firestore();
    const callerDoc = await db.doc(`users/${uid}`).get();
    if (callerDoc.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Bu işlem için yönetici yetkisi gerekiyor.');
    }
}
/**
 * Admin-only: approve or reject a single AI-generated (or manual) draft
 * question. Only approved questions are ever served to students - see
 * FirestoreService.questionsForCategory() and firestore.rules.
 */
exports.reviewQuestion = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }
    await assertIsAdmin(request.auth.uid);
    const { questionId, decision } = request.data;
    if (!questionId || !['approved', 'rejected'].includes(decision)) {
        throw new https_1.HttpsError('invalid-argument', 'questionId ve geçerli bir decision gerekli.');
    }
    await admin.firestore().doc(`questions/${questionId}`).update({ reviewStatus: decision });
    return { ok: true };
});
/**
 * One-time/admin-invoked: grants the 'admin' role to a target user by email.
 * Guarded so it can only be called by an existing admin - the very first
 * admin must instead be set directly in the Firestore console or via a
 * one-off script run with the Admin SDK, since there is no admin yet to
 * call this function.
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Giriş yapmanız gerekiyor.');
    }
    await assertIsAdmin(request.auth.uid);
    const { targetUid, role } = request.data;
    if (!targetUid || !['user', 'admin'].includes(role)) {
        throw new https_1.HttpsError('invalid-argument', 'targetUid ve geçerli bir role gerekli.');
    }
    await admin.firestore().doc(`users/${targetUid}`).update({ role });
    return { ok: true };
});
