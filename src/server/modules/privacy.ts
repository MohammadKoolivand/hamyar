import type { FastifyInstance } from "fastify";
import type { ClientSession } from "mongodb";
import type { Context } from "../context";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { consentAuditKey, consentTextFingerprint, makeConsentEvent, validateConsentHistory, requiresFreshConsent } from "../../../scripts/consent-version-policy.mjs";
import { CONSENT_SCOPE, consentPolicyVersion, isValidGuardianConsent, studentConsentRequired, consentProcessingSuspended } from "../security/privacy-policy";

const uuid = z.uuid();
const reference = z.string().trim().min(8).max(160).regex(/^[a-zA-Z0-9._:/-]+$/);

export function registerPrivacy(app: FastifyInstance, ctx: Context) {
  const { c, user, fail, now, id } = ctx;
  async function appendConsentEvent(session: ClientSession, values: {
    guardianId: string; studentId: string; consentType: string; textVersion: string;
    textSha256: string | null; status: "granted" | "revoked"; method: string;
    relationshipId: string; actorId: string; reason: string;
  }) {
    const consentId = `${values.studentId}:${values.guardianId}:${values.consentType}`;
    const previous = await c("guardianConsentEvents").find({ consentId }, { session }).sort({ sequence: -1 }).limit(1).next();
    // Legacy records may lack history; do not invent or backdate legacy events.
    const sequence = previous ? Number(previous.sequence) + 1 : 1;
    const event = makeConsentEvent({ consentId, sequence, ...values, recordedAt: now(), previousHash: previous?.integrityHash ?? null }, consentAuditKey());
    await c("guardianConsentEvents").insertOne({ _id: `${consentId}:${sequence}`, ...event }, { session });
    return event;
  }

  async function verifiedGuardian(studentId: string, parentId: string) {
    const link = await c("parentLinks").findOne({ studentId, parentId, status: "verified", verifiedAt: { $type: "string" } });
    if (!link) fail(403, "رابطه سرپرستی قانونی تأیید نشده است");
    return link!;
  }

  // An invitation alone is not evidence of lawful guardianship. A reviewer must
  // examine evidence OUTSIDE this endpoint; store a reference, never raw IDs/images.
  app.post("/api/privacy/guardian-links/:linkId/review", async (r) => {
    const admin = await user(r, "super_admin");
    const { linkId } = z.object({ linkId: uuid }).parse(r.params);
    const b = z.object({ decision: z.enum(["verified", "rejected"]), evidenceReference: reference, legalBasisReference: reference }).strict().parse(r.body);
    const link = await c("parentLinks").findOne({ _id: linkId });
    if (!link) fail(404, "درخواست رابطه یافت نشد");
    return ctx.transaction(async (session) => {
      const updated = await c("parentLinks").updateOne({ _id: linkId }, { $set: {
        status: b.decision, verification: "independent_review", verifiedAt: b.decision === "verified" ? now() : null,
        verifiedBy: admin._id, evidenceReference: b.evidenceReference, legalBasisReference: b.legalBasisReference,
      } }, { session });
      if (!updated.matchedCount) fail(409, "رابطه تغییر کرده است");
      // Revocation/rejection invalidates earlier consent (also gate checks link).
      if (b.decision === "rejected") {
        const active = await c("guardianConsents").find({ guardianId: link!.parentId, studentId: link!.studentId, status: "granted" }, { session }).toArray();
        for (const consent of active) {
          const event = await appendConsentEvent(session, { guardianId: consent.guardianId, studentId: consent.studentId,
            consentType: consent.scope, textVersion: consent.policyVersion, textSha256: consent.textSha256 ?? null,
            status: "revoked", method: "independent_guardian_review", relationshipId: linkId,
            actorId: admin._id, reason: "guardian_relationship_rejected" });
          await c("guardianConsents").updateOne({ _id: consent._id, status: "granted" },
            { $set: { status: "revoked", revokedAt: event.recordedAt, latestEventId: `${event.consentId}:${event.sequence}`, legacyHistoryIncomplete: consent.legacyHistoryIncomplete === true || !consent.latestEventId } }, { session });
        }
      }
      if (b.decision === "rejected") {
        await c("users").updateOne({ _id: link!.studentId, role: "student" }, { $set: {
          consentProcessingSuspended: true, consentProcessingChangedAt: now(),
        } }, { session });
      }
      await c("auditLogs").insertOne({ _id: id(), actorId: admin._id, action: "guardian_relationship_reviewed", resourceId: linkId, createdAt: now() }, { session });
      return { status: b.decision };
    });
  });

  app.post("/api/privacy/children/:studentId/consent", async (r) => {
    const parent = await user(r, "parent");
    const { studentId } = z.object({ studentId: uuid }).parse(r.params);
    const b = z.object({ decision: z.enum(["grant", "revoke"]), policyVersion: z.string().max(64), scope: z.literal(CONSENT_SCOPE) }).strict().parse(r.body);
    const version = consentPolicyVersion();
    if (b.decision === "grant" && b.policyVersion !== version) fail(409, "نسخه سند رضایت تغییر کرده است");
    await verifiedGuardian(studentId, parent._id);
    const student = await c("users").findOne({ _id: studentId, role: "student", disabledAt: { $exists: false } });
    if (!student) fail(404, "دانش‌آموز یافت نشد");
    const key = `${studentId}:${parent._id}:${CONSENT_SCOPE}`;
    const textSha256 = consentTextFingerprint();
    return ctx.transaction(async (session) => {
      const link = await c("parentLinks").findOne({ studentId, parentId: parent._id, status: "verified", verifiedAt: { $type: "string" } }, { session });
      if (!link) fail(403, "رابطه معتبر نیست");
      const previous = await c("guardianConsents").findOne({ _id: key }, { session });
      // Existing legacy consent has no reconstructable historic trail.
      const legacyHistoryIncomplete = previous?.legacyHistoryIncomplete === true || Boolean(previous && !previous.latestEventId);
      // The parent may only approve the currently presented, configured policy.
      const event = await appendConsentEvent(session, {
        guardianId: parent._id, studentId, consentType: CONSENT_SCOPE,
        // A guardian can revoke an older consent without accepting a newer policy.
        textVersion: b.decision === "revoke" ? (previous?.policyVersion ?? b.policyVersion) : version,
        textSha256: b.decision === "revoke" ? (previous?.textSha256 ?? null) : textSha256,
        status: b.decision === "grant" ? "granted" : "revoked",
        method: "authenticated_parent_portal", relationshipId: link!._id,
        actorId: parent._id, reason: b.decision === "grant" ? "guardian_grant" : "guardian_revoke",
      });
      await c("guardianConsents").updateOne({ _id: key }, { $set: {
        guardianId: parent._id, studentId, scope: CONSENT_SCOPE,
        policyVersion: event.textVersion, textSha256: event.textSha256,
        status: event.status, method: event.method,
        acknowledgedAt: event.recordedAt, latestEventId: `${event.consentId}:${event.sequence}`, legacyHistoryIncomplete,
        ...(b.decision === "revoke" ? { revokedAt: event.recordedAt } : { revokedAt: null }),
      } }, { upsert: true, session });
      // Student-wide fail-closed barrier: another guardian's older grant cannot
      // silently keep consent-dependent processing active after revocation.
      await c("users").updateOne({ _id: studentId, role: "student" }, { $set: {
        consentProcessingSuspended: b.decision === "revoke",
        consentProcessingChangedAt: event.recordedAt,
      } }, { session });
      await c("auditLogs").insertOne({ _id: id(), actorId: parent._id, action: b.decision === "grant" ? "guardian_consent_granted" : "guardian_consent_revoked", resourceId: studentId, createdAt: now() }, { session });
      return { status: event.status, scope: CONSENT_SCOPE, policyVersion: event.textVersion, recordedAt: event.recordedAt };
    });
  });

  // Permission-checked immutable event history, never accept an arbitrary consentId from clients.
  app.get("/api/privacy/children/:studentId/consent/history", async (r) => {
    const actor = await user(r);
    const { studentId } = z.object({ studentId: uuid }).parse(r.params);
    if (actor.role !== "super_admin" && actor._id !== studentId) {
      if (actor.role !== "parent") fail(403, "دسترسی به تاریخچه رضایت مجاز نیست");
      const relation = await c("parentLinks").findOne({ studentId, parentId: actor._id });
      if (!relation) fail(403, "رابطه سرپرستی یافت نشد");
    }
    const filter = { studentId, ...(actor.role === "parent" ? { guardianId: actor._id } : {}) };
    const events = await c("guardianConsentEvents").find(filter).sort({ consentId: 1, sequence: 1 }).limit(500).toArray();
    const byConsent = new Map<string, typeof events>();
    for (const event of events) byConsent.set(event.consentId, [...(byConsent.get(event.consentId) ?? []), event]);
    const state = await c("guardianConsents").find(filter).toArray();
    const historyComplete = state.every(current => {
      const group = byConsent.get(current._id) ?? [];
      return current.legacyHistoryIncomplete !== true && group.length > 0 && current.latestEventId === `${current._id}:${group[group.length - 1].sequence}`;
    });
    const truncated = events.length === 500;
    const integrityVerified = !truncated && historyComplete && [...byConsent.values()].every(group => validateConsentHistory(group, consentAuditKey()));
    return { studentId, integrityVerified, historyComplete, truncated,
      events: events.map(e => ({ consentType: e.consentType, textVersion: e.textVersion, textSha256: e.textSha256,
        recordedAt: e.recordedAt, method: e.method, status: e.status, sequence: e.sequence,
        actorId: e.actorId, relationshipId: e.relationshipId, reason: e.reason })) };
  });

  app.get("/api/privacy/consent/status", async (r) => {
    const actor = await user(r);
    if (actor.role !== "student") fail(403, "این مسیر مخصوص دانش‌آموز است");
    const version = consentPolicyVersion();
    const digest = consentTextFingerprint();
    const links = await c("parentLinks").find({ studentId: actor._id, status: "verified" }).toArray();
    const consents = await c("guardianConsents").find({ studentId: actor._id, status: "granted", policyVersion: version, scope: CONSENT_SCOPE }).toArray();
    const allowed = !consentProcessingSuspended(actor) && links.some(link => consents.some(c => isValidGuardianConsent(link, c, link.parentId, actor._id, version) && !requiresFreshConsent(c, version, digest)));
    return { required: studentConsentRequired(), allowed, requiresReconsent: !allowed,
      policyVersion: version, textSha256: digest };
  });

  app.post("/api/privacy/deletion-requests", async (r) => {
    const actor = await user(r);
    const b = z.object({ subjectId: uuid.optional(), reason: z.string().trim().max(500).optional() }).strict().parse(r.body);
    const subjectId = b.subjectId ?? actor._id;
    if (subjectId !== actor._id) {
      if (actor.role !== "parent") fail(403, "درخواست حذف داده شخص دیگر مجاز نیست");
      await verifiedGuardian(subjectId, actor._id);
    }
    const subject = await c("users").findOne({ _id: subjectId, disabledAt: { $exists: false } });
    if (!subject || (subjectId !== actor._id && subject.role !== "student")) fail(404, "حساب یافت نشد");
    const requestId = id();
    await c("dataDeletionRequests").insertOne({ _id: requestId, requesterId: actor._id, subjectId,
      status: "pending_review", requestedAt: now(), reason: b.reason ?? null,
      // Do not imply a legal right to erase overrides statutory retention duties.
      legalDecision: null });
    await ctx.audit(actor._id, "request_data_deletion", requestId);
    return { requestId, status: "pending_review" };
  });

  app.get("/api/privacy/deletion-requests/:requestId", async (r) => {
    const actor = await user(r);
    const { requestId } = z.object({ requestId: uuid }).parse(r.params);
    const item = await c("dataDeletionRequests").findOne({ _id: requestId, ...(actor.role === "super_admin" ? {} : { requesterId: actor._id }) });
    if (!item) fail(404, "درخواست یافت نشد");
    return { requestId: item._id, status: item.status, requestedAt: item.requestedAt, completedAt: item.completedAt ?? null,
      retentionCategories: item.retentionCategories ?? [], externalTasks: item.externalTasks ?? [] };
  });

  // Read-only subject data inventory for the privacy reviewer. Deliberately
  // returns COUNTS, not records, PII or content. No external API calls.
  app.get("/api/privacy/deletion-requests/:requestId/inventory", async (r) => {
    await user(r, "super_admin");
    const { requestId } = z.object({ requestId: uuid }).parse(r.params);
    const item = await c("dataDeletionRequests").findOne({ _id: requestId });
    if (!item) fail(404, "درخواست یافت نشد");
    const subjectId = item.subjectId as string;
    const assignments = await c("assignments").find({ studentId: subjectId }).project({ _id: 1 }).toArray();
    const assignmentIds = assignments.map(a => a._id);
    const attempts = assignmentIds.length ? await c("attempts").find({ assignmentId: { $in: assignmentIds } }).project({ _id: 1 }).toArray() : [];
    const counts: Record<string, number> = {};
    for (const [name, filter] of [
      ["users", { _id: subjectId }], ["sessions", { userId: subjectId }],
      ["enrollments", { studentId: subjectId }], ["relations", { studentId: subjectId }],
      ["parentLinks", { $or: [{ studentId: subjectId }, { parentId: subjectId }] }],
      ["assignments", { studentId: subjectId }], ["attempts", { assignmentId: { $in: assignmentIds } }],
      ["evaluations", { attemptId: { $in: attempts.map(a => a._id) } }],
      ["hintEvents", { assignmentId: { $in: assignmentIds } }],
      ["hintReports", { studentId: subjectId }],
      ["learningEvidence", { studentId: subjectId }],
      ["mistakeRecords", { studentId: subjectId }],
      ["masteryRecords", { studentId: subjectId }],
      ["courseRequests", { studentId: subjectId }],
      ["guardianConsents", { studentId: subjectId }],
      ["dataDeletionRequests", { subjectId }],
    ] as const) counts[name] = await c(name).countDocuments(filter);
    return { requestId, counts, externalSystemsRequireManualVerification: ["sms", "smtp", "ai", "backups", "object_storage"],
      note: "وجود داده در سامانه‌های بیرونی از طریق این درخواست تأیید نمی‌شود" };
  });

  app.post("/api/privacy/deletion-requests/:requestId/execute", async (r) => {
    const admin = await user(r, "super_admin");
    const { requestId } = z.object({ requestId: uuid }).parse(r.params);
    const b = z.object({ legalReviewReference: reference, retentionDecisionReference: reference,
      decision: z.literal("erase_account_retain_educational_history") }).strict().parse(r.body);
    // No blanket cascade: educational evidence, audit, backups, external processors
    // need a documented retention/legal decision and their own removal workflows.
    return ctx.transaction(async (session) => {
      const req = await c("dataDeletionRequests").findOne({ _id: requestId, status: "pending_review" }, { session });
      if (!req) fail(409, "درخواست در انتظار بررسی یافت نشد");
      if (req.subjectId === admin._id) fail(403, "تأیید حذف حساب خود مجاز نیست");
      const subject = await c("users").findOne({ _id: req.subjectId }, { session });
      if (!subject) fail(404, "حساب یافت نشد");
      const locked = await c("dataDeletionRequests").updateOne({ _id: requestId, status: "pending_review" },
        { $set: { status: "processing", reviewedBy: admin._id, legalReviewReference: b.legalReviewReference, retentionDecisionReference: b.retentionDecisionReference } }, { session });
      if (!locked.modifiedCount) fail(409, "درخواست هم‌زمان پردازش شده است");
      // Real account erasure: invalidate sessions and tokens before any later request.
      for (const [name, filter] of [
        ["sessions", { userId: req.subjectId }], ["passwordResetTokens", { userId: req.subjectId }],
        ["emailVerificationTokens", { userId: req.subjectId }], ["parentLinks", { $or: [{ parentId: req.subjectId }, { studentId: req.subjectId }] }],
      ] as const) await c(name).deleteMany(filter, { session });
      await c("users").updateOne({ _id: req.subjectId }, { $unset: {
        name: "", email: "", phone: "", passwordHash: "", emailVerified: "", phoneVerified: "",
      }, $set: { disabledAt: now(), erasedAt: now(), displayName: "حساب حذف‌شده" }, $inc: { securityRevision: 1 } }, { session });
      const retentionCategories = ["educational_records", "assessment_responses", "audit_trail", "legal_obligations"];
      const externalTasks = ["sms_provider", "email_provider", "ai_provider_if_used", "backups_and_object_storage"];
      await c("dataDeletionRequests").updateOne({ _id: requestId }, { $set: {
        status: "partially_executed_retention_and_external_pending", completedAt: null,
        retentionCategories, externalTasks, lastProcessedAt: now(),
      } }, { session });
      await c("auditLogs").insertOne({ _id: id(), actorId: admin._id, action: "data_deletion_account_erased_with_holds", resourceId: requestId, createdAt: now() }, { session });
      return { requestId, status: "partially_executed_retention_and_external_pending", retentionCategories, externalTasks };
    });
  });
  app.post("/api/privacy/deletion-requests/:requestId/finalize", async (r) => {
    const admin = await user(r, "super_admin");
    const { requestId } = z.object({ requestId: uuid }).parse(r.params);
    const b = z.object({ externalCompletionReference: reference, retentionRegisterReference: reference }).strict().parse(r.body);
    const updated = await c("dataDeletionRequests").updateOne({ _id: requestId, status: "partially_executed_retention_and_external_pending" },
      { $set: { status: "completed_with_documented_retention", completedAt: now(), externalCompletionReference: b.externalCompletionReference, retentionRegisterReference: b.retentionRegisterReference, finalizedBy: admin._id } });
    if (!updated.modifiedCount) fail(409, "درخواست آماده پایان نیست");
    await ctx.audit(admin._id, "finalize_data_deletion_with_retention", requestId);
    return { requestId, status: "completed_with_documented_retention" };
  });
}

export async function ensureStudentConsent(ctx: Context, studentId: string) {
  if (!studentConsentRequired()) return;
  const version = consentPolicyVersion();
  const digest = consentTextFingerprint();
  const student = await ctx.c("users").findOne({ _id: studentId, role: "student", disabledAt: { $exists: false } });
  if (consentProcessingSuspended(student))
    ctx.fail(403, "پردازش وابسته به رضایت متوقف شده است");
  const links = await ctx.c("parentLinks").find({ studentId, status: "verified", verifiedAt: { $type: "string" } }).toArray();
  const consents = await ctx.c("guardianConsents").find({ studentId, scope: CONSENT_SCOPE, policyVersion: version, status: "granted" }).toArray();
  if (!links.some(link => consents.some(c => isValidGuardianConsent(link, c, link.parentId, studentId, version) && !requiresFreshConsent(c, version, digest))))
    ctx.fail(403, "پردازش آموزشی تا تکمیل رضایت معتبر سرپرست مجاز نیست");
}
