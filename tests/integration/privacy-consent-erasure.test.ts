import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fixture } from "../helpers/fixture";

// Each fixture uses an isolated database. Policy flag is enabled only after its
// setup (the legacy fixture pre-populates student data for test convenience).
test("independent guardian review, scoped consent, revocation and stale links", async () => {
  const f = await fixture();
  const oldRequired = process.env.STUDENT_CONSENT_REQUIRED;
  const oldVersion = process.env.STUDENT_CONSENT_POLICY_VERSION;
  try {
    const studentId = f.assignment.studentId;
    const adminId = randomUUID();
    const rawToken = randomBytes(32).toString("hex");
    await f.c("users").insertOne({ _id: adminId, role: "super_admin", name: "Reviewer" });
    await f.c("sessions").insertOne({ _id: randomUUID(), userId: adminId,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"), securityRevision: 0,
      expiresAt: new Date(Date.now() + 600000) });
    const admin = `session=${rawToken}`;
    const invitation = await f.post("/api/invitations", {
      email: "guardian-privacy@test.dev", role: "parent", studentId,
    }, f.teacher);
    await f.post("/api/invitations/accept", {
      email: "guardian-privacy@test.dev", password: "StrongPass123!", name: "Guardian", token: invitation.token,
    });
    const login = await f.request("/api/auth/login", { email: "guardian-privacy@test.dev", password: "StrongPass123!" });
    const parent = `session=${login.cookies[0].value}`;
    const guardian = await f.c("users").findOne({ email: "guardian-privacy@test.dev" });
    const link = await f.c("parentLinks").findOne({ parentId: guardian!._id, studentId });
    process.env.STUDENT_CONSENT_REQUIRED = "true";
    process.env.STUDENT_CONSENT_POLICY_VERSION = "ir-reviewed-v1";
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 403);
    const prematureConsent = await f.request(`/api/privacy/children/${studentId}/consent`, {
      decision: "grant", policyVersion: "ir-reviewed-v1", scope: "educational-processing:v1",
    }, parent);
    assert.equal(prematureConsent.statusCode, 403);
    const unauthorizedReview = await f.request(`/api/privacy/guardian-links/${link!._id}/review`, {
      decision: "verified", evidenceReference: "external:evidence-0001", legalBasisReference: "legal:review-0001",
    }, f.teacher);
    assert.equal(unauthorizedReview.statusCode, 403);
    await f.post(`/api/privacy/guardian-links/${link!._id}/review`, {
      decision: "verified", evidenceReference: "external:evidence-0001", legalBasisReference: "legal:review-0001",
    }, admin);
    await f.post(`/api/privacy/children/${studentId}/consent`, {
      decision: "grant", policyVersion: "ir-reviewed-v1", scope: "educational-processing:v1",
    }, parent);
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 200);
    const historyPath = `/api/privacy/children/${studentId}/consent/history`;
    const firstHistory = await f.request(historyPath, undefined, parent);
    assert.equal(firstHistory.statusCode, 200);
    assert.equal(firstHistory.json().events[0].textVersion, "ir-reviewed-v1");
    assert.equal(firstHistory.json().events[0].method, "authenticated_parent_portal");
    assert.equal(firstHistory.json().integrityVerified, true);
    assert.equal((await f.request(historyPath, undefined, f.teacher)).statusCode, 403);
    // A changed approved version invalidates the old grant until renewed.
    process.env.STUDENT_CONSENT_POLICY_VERSION = "ir-reviewed-v2";
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 403);
    assert.equal((await f.request('/api/privacy/consent/status', undefined, f.student)).json().requiresReconsent, true);
    await f.post(`/api/privacy/children/${studentId}/consent`, {
      decision: "grant", policyVersion: "ir-reviewed-v2", scope: "educational-processing:v1",
    }, parent);
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 200);
    const secondHistory = (await f.request(historyPath, undefined, parent)).json();
    assert.equal(secondHistory.events.length, 2);
    assert.deepEqual(secondHistory.events.map((e: { textVersion: string }) => e.textVersion), ["ir-reviewed-v1", "ir-reviewed-v2"]);
    assert.equal(secondHistory.integrityVerified, true);
    // A teacher or unrelated student cannot revoke consent by changing the ID.
    const forbidden = await f.request(`/api/privacy/children/${studentId}/consent`, {
      decision: "revoke", policyVersion: "ir-reviewed-v2", scope: "educational-processing:v1",
    }, f.teacher);
    assert.equal(forbidden.statusCode, 403);
    const unrelated = await f.request(`/api/privacy/children/${randomUUID()}/consent`, {
      decision: "revoke", policyVersion: "ir-reviewed-v2", scope: "educational-processing:v1",
    }, parent);
    assert.equal(unrelated.statusCode, 403);
    // Revocation must work even after the text version changes; no new
    // consent may be demanded merely to withdraw the old one.
    process.env.STUDENT_CONSENT_POLICY_VERSION = "ir-reviewed-v3";
    await f.post(`/api/privacy/children/${studentId}/consent`, {
      decision: "revoke", policyVersion: "ir-reviewed-v2", scope: "educational-processing:v1",
    }, parent);
    assert.equal((await f.c("users").findOne({ _id: studentId }))?.consentProcessingSuspended, true);
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 403);
    assert.equal((await f.request('/api/privacy/consent/status', undefined, f.student)).json().allowed, false);
    const lastHistory = (await f.request(historyPath, undefined, parent)).json();
    assert.deepEqual(lastHistory.events.map((e: { status: string }) => e.status), ["granted", "granted", "revoked"]);
    assert.equal(lastHistory.integrityVerified, true);
    assert.equal((await f.request(`/api/students/${studentId}/progress`, undefined, f.teacher)).statusCode, 403);
    // Historical assessments remain in storage; revocation is not deletion.
    assert.ok(await f.c("assignments").findOne({ _id: f.assignment._id }));
    // Only a new verified consent on the current policy can resume processing.
    assert.equal((await f.request(`/api/privacy/children/${studentId}/consent`, {
      decision: "grant", policyVersion: "ir-reviewed-v2", scope: "educational-processing:v1",
    }, parent)).statusCode, 409);
    await f.post(`/api/privacy/children/${studentId}/consent`, {
      decision: "grant", policyVersion: "ir-reviewed-v3", scope: "educational-processing:v1",
    }, parent);
    assert.equal((await f.request(f.path, undefined, f.student)).statusCode, 200);
    const completeHistory = (await f.request(historyPath, undefined, parent)).json();
    assert.deepEqual(completeHistory.events.map((e: { status: string }) => e.status),
      ["granted", "granted", "revoked", "granted"]);
    assert.equal(completeHistory.integrityVerified, true);
  } finally {
    if (oldRequired === undefined) delete process.env.STUDENT_CONSENT_REQUIRED;
    else process.env.STUDENT_CONSENT_REQUIRED = oldRequired;
    if (oldVersion === undefined) delete process.env.STUDENT_CONSENT_POLICY_VERSION;
    else process.env.STUDENT_CONSENT_POLICY_VERSION = oldVersion;
    await f.close();
  }
});

test("deletion request is owner-scoped; review executes account erasure, not history erasure", async () => {
  const f = await fixture();
  try {
    const studentId = f.assignment.studentId;
    const otherStudent = randomUUID();
    await f.c("users").insertOne({ _id: otherStudent, role: "student", name: "Other" });
    assert.equal((await f.request("/api/privacy/deletion-requests", { subjectId: otherStudent }, f.student)).statusCode, 403);
    const request = await f.post("/api/privacy/deletion-requests", { reason: "erase my account" }, f.student);
    assert.equal(request.status, "pending_review");
    assert.equal((await f.request(`/api/privacy/deletion-requests/${request.requestId}`, undefined, f.teacher)).statusCode, 404);
    assert.equal((await f.request(`/api/privacy/deletion-requests/${request.requestId}/inventory`, undefined, f.student)).statusCode, 403);
    assert.equal((await f.request(`/api/privacy/deletion-requests/${request.requestId}/execute`, {
      decision: "erase_account_retain_educational_history", legalReviewReference: "legal:review-0001", retentionDecisionReference: "legal:retention-0001",
    }, f.student)).statusCode, 403);
    const adminId = randomUUID(), token = randomBytes(32).toString("hex");
    await f.c("users").insertOne({ _id: adminId, role: "super_admin", name: "Reviewer" });
    await f.c("sessions").insertOne({ _id: randomUUID(), userId: adminId,
      tokenHash: createHash("sha256").update(token).digest("hex"), securityRevision: 0,
      expiresAt: new Date(Date.now() + 600000) });
    const admin = `session=${token}`;
    const inventory = await f.request(`/api/privacy/deletion-requests/${request.requestId}/inventory`, undefined, admin);
    assert.equal(inventory.statusCode, 200);
    assert.ok(inventory.json().counts.assignments >= 1);
    const executed = await f.post(`/api/privacy/deletion-requests/${request.requestId}/execute`, {
      decision: "erase_account_retain_educational_history", legalReviewReference: "legal:review-0001", retentionDecisionReference: "legal:retention-0001",
    }, admin);
    assert.equal(executed.status, "partially_executed_retention_and_external_pending");
    assert.equal((await f.request("/api/auth/me", undefined, f.student)).statusCode, 401);
    const student = await f.c("users").findOne({ _id: studentId });
    assert.equal(student?.email, undefined);
    assert.ok(student?.disabledAt);
    assert.ok(await f.c("assignments").findOne({ _id: f.assignment._id }));
    assert.equal((await f.request(`/api/privacy/deletion-requests/${request.requestId}/execute`, {
      decision: "erase_account_retain_educational_history", legalReviewReference: "legal:review-0001", retentionDecisionReference: "legal:retention-0001",
    }, admin)).statusCode, 409);
  } finally { await f.close(); }
});
