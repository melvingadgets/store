const test = require("node:test");
const assert = require("node:assert/strict");

const nodemailer = require("nodemailer");
const envModule = require("../dist/config/env");
const { sendVerificationEmail } = require("../dist/utils/EmailVerification");
const { stubMethod, stubProperty } = require("./helpers/testUtils");

test("sendVerificationEmail short-circuits when mail config is disabled", async () => {
  const restoreFlag = stubProperty(envModule, "hasMailConfig", false);

  try {
    const sent = await sendVerificationEmail({
      email: "user@example.com",
      verificationToken: "token-123",
      userName: "Mel",
    });

    assert.equal(sent, false);
  } finally {
    restoreFlag();
  }
});

test("sendVerificationEmail builds and sends the verification email", async () => {
  const calls = [];
  const restoreFlag = stubProperty(envModule, "hasMailConfig", true);
  const restoreTransport = stubMethod(nodemailer, "createTransport", (config) => {
    calls.push({ config });
    return {
      sendMail: async (payload) => {
        calls.push({ payload });
      },
    };
  });

  try {
    const sent = await sendVerificationEmail({
      email: "user@example.com",
      verificationToken: "token-123",
      userName: "Mel",
    });

    assert.equal(sent, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].payload.to, "user@example.com");
    assert.match(calls[1].payload.subject, /Verify your Mel Store account/);
    assert.match(calls[1].payload.html, /verify-account\/token-123/);
  } finally {
    restoreFlag();
    restoreTransport();
  }
});
