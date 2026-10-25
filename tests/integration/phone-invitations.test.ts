import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "../helpers/fixture";

async function login(
  f: Awaited<ReturnType<typeof fixture>>,
  identifier: string,
) {
  const reply = await f.request("/api/auth/login", {
    email: identifier,
    password: "StrongPass123!",
  });
  assert.equal(reply.statusCode, 200, reply.body);
  return "session=" + reply.cookies[0].value;
}

test("mobile invitations normalize Iran formats, bind accounts and protect tokens", async () => {
  const f = await fixture();
  try {
    const invite = await f.post(
      "/api/invitations",
      { phone: "+98 912 345 6789" },
      f.teacher,
    );
    const body = {
      name: "دانش‌آموز موبایل",
      phone: "۰۹۱۲۳۴۵۶۷۸۹",
      password: "StrongPass123!",
      token: invite.token,
    };
    assert.equal(
      (
        await f.request("/api/invitations/accept", {
          ...body,
          phone: "09121111111",
        })
      ).statusCode,
      400,
    );
    await f.post("/api/invitations/accept", body);
    assert.equal(
      (await f.request("/api/invitations/accept", body)).statusCode,
      400,
    );
    const cookie = await login(f, "00989123456789");
    const me = (await f.request("/api/auth/me", undefined, cookie)).json();
    assert.equal(me.phone, "09123456789");
    assert.equal(me.email, undefined);
    assert.equal(me.role, "student");
    const parent = await f.post(
      "/api/invitations",
      { phone: "۰۹۱۳۱۲۳۴۵۶۷", role: "parent", studentId: me._id },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      name: "ولی موبایل",
      phone: "+989131234567",
      password: "StrongPass123!",
      token: parent.token,
    });
    const parentCookie = await login(f, "09131234567");
    const children = (
      await f.request("/api/children", undefined, parentCookie)
    ).json();
    assert.equal(children[0]._id, me._id);
    const parents = (
      await f.request(`/api/students/${me._id}/parents`, undefined, f.teacher)
    ).json();
    assert.equal(parents[0].phone, "09131234567");
    await f.post(
      `/api/students/${me._id}/parents/${parents[0]._id}/revoke`,
      {},
      f.teacher,
    );
    assert.equal(
      (await f.request("/api/children", undefined, parentCookie)).json().length,
      0,
    );
    for (const phone of ["123", "02112345678", "+12025550123", "0912abc6789"]) {
      assert.equal(
        (await f.request("/api/invitations", { phone }, f.teacher)).statusCode,
        400,
      );
    }
    const another = await f.post(
      "/api/invitations",
      { phone: "09121111111" },
      f.teacher,
    );
    await f.post("/api/invitations/accept", {
      name: "دوم",
      phone: "09121111111",
      password: "StrongPass123!",
      token: another.token,
    });
    const disabled = await f.post(
      "/api/invitations",
      { phone: me.phone },
      f.teacher,
    );
    await f.db
      .collection("users")
      .updateOne(
        { _id: me._id },
        { $set: { disabledAt: new Date().toISOString() } },
      );
    assert.equal(
      (
        await f.request("/api/invitations/accept", {
          ...body,
          token: disabled.token,
        })
      ).statusCode,
      401,
    );
  } finally {
    await f.close();
  }
});

test("existing email student can claim a phone-bound invite without a duplicate account", async () => {
  const f = await fixture();
  try {
    const before = await f.db.collection("users").countDocuments();
    const invite = await f.post(
      "/api/invitations",
      { phone: "09120000001" },
      f.teacher,
    );
    assert.equal(
      (
        await f.request(
          "/api/invitations/claim",
          { token: invite.token, phone: "09120000002" },
          f.student,
        )
      ).statusCode,
      400,
    );
    await f.post(
      "/api/invitations/claim",
      { token: invite.token, phone: "+989120000001" },
      f.student,
    );
    assert.equal(await f.db.collection("users").countDocuments(), before);
    const me = (
      await f.request("/api/auth/me", undefined, await login(f, "09120000001"))
    ).json();
    assert.equal(me.email, "s@test.dev");
    assert.equal(me.phone, "09120000001");
    const different = await f.post(
      "/api/invitations",
      { phone: "09120000003" },
      f.teacher,
    );
    assert.equal(
      (
        await f.request(
          "/api/invitations/claim",
          { token: different.token, phone: "09120000003" },
          f.student,
        )
      ).statusCode,
      400,
    );
  } finally {
    await f.close();
  }
});
