#!/usr/bin/env node
/* seal-token.js — token.enc を生成する（管理者専用・管理者のMacでのみ実行可能）。
 *
 * 前提（このMacのKeychainにのみ存在する2つの秘密）:
 *   security add-generic-password -s rezon-sdlc-dist     -a <ID> -w '<パスワード>' -U
 *   security add-generic-password -s rezon-sdlc-dist-pat -a deploy -w '<fine-grained PAT>' -U
 *     PAT要件: rezon-inc/system-dev-orchestrator のみ / Contents: Read-only / 有効期限を設定
 *
 * パスワード変更の手順（この2つが揃うMac以外では実行できない＝変更はこのPC限定）:
 *   1) Keychain の rezon-sdlc-dist を新パスワードで -U 上書き
 *   2) node seal-token.js && git commit -am "rotate" && git push
 */
const fs = require("fs");
const crypto = require("crypto");
const { execSync } = require("child_process");

function kc(service) {
  return execSync(`security find-generic-password -s ${service} -w`).toString().trim();
}
function kcAccount(service) {
  const out = execSync(`security find-generic-password -s ${service}`).toString();
  return /"acct"<blob>="([^"]+)"/.exec(out)[1];
}

const id = kcAccount("rezon-sdlc-dist");
const password = kc("rezon-sdlc-dist");
const pat = kc("rezon-sdlc-dist-pat");

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
const c = crypto.createCipheriv("aes-256-gcm", key, iv);
c.setAAD(Buffer.from(id, "utf8"));
const data = Buffer.concat([c.update(pat, "utf8"), c.final()]);

fs.writeFileSync("token.enc", JSON.stringify({
  v: 1, kdf: "scrypt-32768", salt: salt.toString("base64"),
  iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"),
  data: data.toString("base64"),
}, null, 2) + "\n");
console.log(`OK: token.enc を生成（ID=${id}）。git commit & push で配布反映。`);
