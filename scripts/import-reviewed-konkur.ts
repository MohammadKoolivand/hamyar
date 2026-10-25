// One-off, user-authorized local import. The manifest and copyrighted source assets
// remain under ignored .private; reruns never duplicate or overwrite question versions.
import { readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { connect, collection } from "../src/server/db";
import { buildApp } from "../src/server/app";
import { questionSchema } from "../src/server/domain";
import { configuredProvider } from "../src/server/ai/provider";
import type { QuestionVisual } from "../src/lib/question-visuals";
const directory = process.argv[2],
  ownerId = process.argv[3];
if (!directory || !ownerId)
  throw new Error(
    "Usage: import-reviewed-konkur.ts <reviewed-directory> <owner-id>",
  );
const questions = JSON.parse(
  await readFile(`${directory}/questions.json`, "utf8"),
) as {
  number: number;
  page: number;
  image: string;
  width: number;
  height: number;
  key: number;
  extractedText: string;
}[];
const curated = JSON.parse(
  await readFile(`${directory}/curated.json`, "utf8"),
) as Record<
  string,
  {
    book: string;
    topic: string;
    skill: string;
    statement: string;
    hints: string[];
    solution: string;
  }
>;
if (
  questions.length !== 105 ||
  questions.some((q, i) => q.number !== i + 1 || q.key < 1 || q.key > 4)
)
  throw new Error("Unreviewed/incomplete manifest");
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
const uuid = (s: string) => {
  const h = hash(s);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const sourcePdf = await readFile(`${directory}/source.pdf`),
  keyPdf = await readFile(`${directory}/key.pdf`),
  fingerprint = hash(sourcePdf);
const sourceUrl =
  "https://dl.konkur.in/2026/08/Konkur1405-Riazi-%5Bwww.konkur.in%5D.pdf";
const keyUrl =
  "https://dl.konkur.in/2026/08/Key1405-Riazi-%5Bwww.konkur.in%5D.pdf";
const { client, db } = await connect();
const c = (name: string) => collection(db, name);
let cookie = "";
const loginEmail = process.env.IMPORT_TEACHER_EMAIL,
  loginPassword = process.env.IMPORT_TEACHER_PASSWORD;
if (!loginEmail || !loginPassword) {
  await client.close();
  throw new Error(
    "Normal teacher login required: IMPORT_TEACHER_EMAIL and IMPORT_TEACHER_PASSWORD",
  );
}
let app: Awaited<ReturnType<typeof buildApp>> | undefined;
try {
  const teacher = await c("users").findOne({
    _id: ownerId,
    role: "teacher",
  });
  if (!teacher) throw new Error("Teacher account does not exist");
  app = await buildApp(db, configuredProvider());
  await app.ready();
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: loginEmail, password: loginPassword },
  });
  if (login.statusCode !== 200 || login.json()._id !== ownerId)
    throw new Error(
      "Authenticated teacher does not match requested import owner",
    );
  cookie = "session=" + login.cookies.find((c) => c.name === "session")!.value;
  async function post(url: string, body: object, key: string) {
    const response = await app!.inject({
      method: "POST",
      url,
      headers: { cookie, "idempotency-key": key },
      payload: body,
    });
    if (response.statusCode !== 200)
      throw new Error(`${url}: ${response.statusCode} ${response.body}`);
    return response.json();
  }
  const examIds: Record<string, string> = {};
  for (const booklet of ["121A", "122A"]) {
    const e = await post(
      "/api/exam-imports",
      {
        title: `کنکور ریاضی ۱۴۰۵ — ${booklet} — ${booklet === "121A" ? "۴۰ سؤال ریاضی" : "۳۵ فیزیک و ۳۰ شیمی"}`,
        subject: booklet === "121A" ? "ریاضی" : "فیزیک و شیمی",
        grade: "دهم تا دوازدهم",
        track: "ریاضی و فیزیک",
        year: 1405,
        source: {
          family: "konkur",
          group: "mathematics",
          bookletCode: booklet,
          sourceTitle: "دفترچه ارائه‌شده کاربر — konkur.in",
          sourceUrl,
        },
      },
      `konkur-${fingerprint.slice(0, 30)}-${booklet}`,
    );
    examIds[booklet] = e._id;
    const stored = await c("examImports").findOne({ _id: e._id });
    if (stored?.state === "collecting") {
      for (const [kind, data, name] of [
        ["question", sourcePdf, "Konkur1405-Riazi.pdf"],
        ["answer", keyPdf, "Key1405-Riazi.pdf"],
      ] as const) {
        const res = await app.inject({
          method: "POST",
          url: `/api/exam-imports/${e._id}/files/${kind}`,
          headers: {
            cookie,
            "content-type": "application/pdf",
            "x-file-name": name,
            "idempotency-key": `file-${hash(data).slice(0, 40)}-${booklet}-${kind}`,
          },
          payload: data,
        });
        if (res.statusCode !== 200) throw new Error(res.body);
      }
      await c("examImports").updateOne(
        { _id: e._id },
        {
          $set: {
            state: "review",
            importFingerprint: fingerprint,
            keySourceUrl: keyUrl,
            keySha256: hash(keyPdf),
            extractionNotice:
              "ورود کنترل‌شده بنا به درخواست کاربر؛ برش تصویر اصل هر سؤال و کلید دفترچه تطبیق داده شده‌اند. متن PDF برای بازسازی فرمول‌ها استفاده نشده است. فقط ۱۰۵ سؤال موجود در فایل وارد شده است.",
          },
        },
      );
    }
  }
  const report: {
    number: number;
    versionId: string;
    assetId: string;
    examId: string;
    curated: boolean;
  }[] = [];
  let created = 0;
  for (const item of questions) {
    const booklet = item.number <= 40 ? "121A" : "122A",
      examId = examIds[booklet];
    const itemId = uuid(`${ownerId}:${fingerprint}:item:${item.number}`),
      assetId = uuid(`${ownerId}:${fingerprint}:asset:${item.number}`);
    const png = await readFile(item.image),
      sha256 = hash(png),
      oldAsset = await c("questionAssets").findOne({ _id: assetId });
    if (oldAsset && oldAsset.sha256 !== sha256)
      throw new Error(`Immutable source image changed for ${item.number}`);
    await c("questionAssets").updateOne(
      { _id: assetId },
      {
        $setOnInsert: {
          ownerId,
          data: new Binary(png),
          mime: "image/png",
          sha256,
          width: item.width,
          height: item.height,
          sourceExamId: examId,
          page: item.page,
          number: item.number,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    const old = await c("examImportItems").findOne({ _id: itemId });
    if (old?.state === "approved") {
      report.push({
        number: item.number,
        versionId: old.questionVersionId,
        assetId,
        examId,
        curated: !!curated[item.number],
      });
      continue;
    }
    const detail = curated[item.number],
      subject =
        item.number <= 40 ? "ریاضی" : item.number <= 75 ? "فیزیک" : "شیمی";
    const options = ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"];
    const visuals: QuestionVisual[] = [
      {
        kind: "image",
        assetId,
        width: item.width,
        height: item.height,
        caption: `اصل سؤال ${item.number} ${subject} کنکور ریاضی ۱۴۰۵ — ${booklet}`,
      },
    ];
    let topicId: string | undefined;
    const skillIds: string[] = [];
    if (detail) {
      const topic = await c("curriculum").findOne({
        ownerId,
        kind: "topic",
        catalogBookId: detail.book,
        title: detail.topic,
      });
      if (!topic) throw new Error(`Missing verified topic ${detail.topic}`);
      topicId = String(topic._id);
      const skillId = uuid(`${ownerId}:konkur1405:skill:${detail.skill}`);
      await c("curriculum").updateOne(
        { _id: skillId },
        {
          $setOnInsert: {
            ownerId,
            kind: "skill",
            title: detail.skill,
            parentId: topic.parentId ?? topicId,
          },
        },
        { upsert: true },
      );
      skillIds.push(skillId);
    }
    const q = questionSchema.parse({
      statement: detail
        ? `کنکور ریاضی ۱۴۰۵، سؤال ${item.number} (${subject})\n${detail.statement}`
        : `کنکور ریاضی ۱۴۰۵ — سؤال ${item.number} ${subject}. متن و چهار گزینه دقیق سؤال در تصویر اصل دفترچه آمده است.`,
      ...(topicId
        ? { classification: "topic", topicId }
        : { classification: "free" }),
      skillIds,
      type: "choice",
      reference: options[item.key - 1],
      options,
      hints: detail?.hints ?? [],
      visuals,
    });
    await c("examImportItems").updateOne(
      { _id: itemId },
      {
        $setOnInsert: {
          ownerId,
          examId,
          state: "pending",
          createdAt: new Date().toISOString(),
          originalNumber: item.number,
          question: q,
          sourceImageSha256: sha256,
          sourcePage: item.page,
          extractedTextForAudit: item.extractedText,
        },
      },
      { upsert: true },
    );
    const result = await post(
      `/api/exam-imports/${examId}/items/${itemId}/review`,
      {
        action: "approve",
        confirmed: true,
        originalNumber: item.number,
        question: q,
      },
      `review-konkur-${fingerprint.slice(0, 24)}-${item.number}`,
    );
    await c("questionVersions").updateOne(
      { _id: result.questionVersionId },
      {
        $set: {
          importReview: {
            preparedBy: "assistant-on-explicit-user-request",
            developmentTest: true,
            sourcePage: item.page,
            keyUrl,
            keySha256: hash(keyPdf),
            referenceBasis: "provided-key-matching-booklet",
            semanticTopicReviewed: !!detail,
            ...(detail ? { checkedSolution: detail.solution } : {}),
            sourceImageSha256: sha256,
          },
        },
      },
    );
    report.push({
      number: item.number,
      versionId: result.questionVersionId,
      assetId,
      examId,
      curated: !!detail,
    });
    created++;
  }
  await c("auditLogs").insertOne({
    _id: randomUUID(),
    actorId: ownerId,
    action: "user_requested_konkur_import",
    resourceId: fingerprint,
    createdAt: new Date().toISOString(),
    counts: { math: 40, physics: 35, chemistry: 30 },
    curated: Object.keys(curated).map(Number),
    sourceUrl,
    keyUrl,
  });
  await writeFile(
    `${directory}/import-result.json`,
    JSON.stringify(
      {
        ownerId,
        examIds,
        total: report.length,
        created,
        curated: report.filter((q) => q.curated),
        questions: report,
        sourceSha256: fingerprint,
        keySha256: hash(keyPdf),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      total: report.length,
      created,
      curated: report.filter((q) => q.curated).length,
      examIds,
    }),
  );
} finally {
  if (app && cookie)
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie },
      payload: {},
    });
  await app?.close();
  await client.close();
}
