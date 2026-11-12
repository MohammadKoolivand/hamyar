import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";
import { initializeDiscoverySettings } from "../../src/server/discovery-settings";

test("public filters persist admin edits, reject other roles and preserve archives across startup", async () => {
  const f = await fixture();
  try {
    const initial = (await f.request("/api/discovery-filters")).json();
    assert.equal(initial.fields.length, 7);
    const payload = {
      revision: initial.revision,
      key: "level",
      action: "label",
      label: "مقطع تحصیلی",
    };
    assert.equal(
      (await f.request("/api/admin/discovery-filters", payload)).statusCode,
      401,
    );
    assert.equal(
      (await f.request("/api/admin/discovery-filters", payload, f.teacher))
        .statusCode,
      403,
    );
    assert.equal(
      (await f.request("/api/admin/discovery-filters", payload, f.student))
        .statusCode,
      403,
    );
    await f
      .c("users")
      .updateOne({ email: "t@test.dev" }, { $set: { role: "super_admin" } });
    const renamed = await f.post(
      "/api/admin/discovery-filters",
      payload,
      f.teacher,
    );
    assert.equal(
      renamed.fields.find((field: { key: string }) => field.key === "level")
        .label,
      "مقطع تحصیلی",
    );
    assert.equal(
      (await f.request("/api/admin/discovery-filters", payload, f.teacher))
        .statusCode,
      409,
    );
    const added = await f.post(
      "/api/admin/discovery-filters",
      {
        revision: renamed.revision,
        key: "level",
        action: "save",
        option: {
          value: "ابتدایی",
          label: "دورهٔ ابتدایی",
          parents: {},
          order: 0,
          active: true,
        },
      },
      f.teacher,
    );
    const option = added.fields
      .find((field: { key: string }) => field.key === "level")
      .options.find((option: { value: string }) => option.value === "ابتدایی");
    const archived = await f.post(
      "/api/admin/discovery-filters",
      {
        revision: added.revision,
        key: "level",
        action: "archive",
        id: option.id,
      },
      f.teacher,
    );
    await initializeDiscoverySettings(f.db);
    const publicView = (await f.request("/api/discovery-filters")).json();
    assert.equal(publicView.fields[0].label, "مقطع تحصیلی");
    assert.equal(
      publicView.fields[0].options.some(
        (row: { id: string }) => row.id === option.id,
      ),
      false,
    );
    const restored = await f.post(
      "/api/admin/discovery-filters",
      {
        revision: archived.revision,
        key: "level",
        action: "save",
        option: { ...option, active: true },
      },
      f.teacher,
    );
    assert.equal(
      restored.fields[0].options.find(
        (row: { id: string }) => row.id === option.id,
      ).active,
      true,
    );
    assert.equal(
      await f
        .c("auditLogs")
        .countDocuments({ action: "discovery_filter_archive" }),
      1,
    );
  } finally {
    await f.close();
  }
});
