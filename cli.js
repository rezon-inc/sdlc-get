#!/usr/bin/env node
/* sdlc-get — ID/パスワード入力で sdlc-orchestrator を導入するブートストラップ。
 * 使い方: npx github:rezon-inc/sdlc-get [展開先dir]
 * 仕組み: 同梱 token.enc（読取専用デプロイトークンをパスワードで AES-256-GCM 暗号化）を
 *         入力されたID/パスワードで復号し、成功したら private リポジトリを clone する。
 *         トークン平文はディスクに残さない（cloneのremote URLも導入後に無害化する）。
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const readline = require("readline");

// 2026-10-23：`npx github:rezon-inc/sdlc-get skills` で Rezon の業務スキル（rezon-skills：営業開始など）を入れる。2回目からは最新にして入れ直す
const SKILLS = process.argv[2] === "skills";
const REPO = SKILLS ? "https://github.com/rezon-inc/rezon-skills.git" : "https://github.com/rezon-inc/system-dev-orchestrator.git";
const ENC_PATH = path.join(__dirname, "token.enc");

function die(msg) { console.error("NG: " + msg); process.exit(1); }

function ask(question, mute) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (mute) {
      const orig = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (s) => { if (s.includes(question)) orig(s); else orig("*"); };
    }
    rl.question(question, (ans) => { rl.close(); if (mute) process.stdout.write("\n"); resolve(ans.trim()); });
  });
}

function decrypt(id, password) {
  const box = JSON.parse(fs.readFileSync(ENC_PATH, "utf8"));
  const key = crypto.scryptSync(password, Buffer.from(box.salt, "base64"), 32, { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  d.setAAD(Buffer.from(id, "utf8"));
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]).toString("utf8");
}

(async () => {
  if (!fs.existsSync(ENC_PATH)) die("token.enc が未配置。管理者がまだ配布を有効化していない");
  const target = SKILLS ? path.join(require("os").homedir(), "Documents", "作業", "rezon-skills") : path.resolve(process.argv[2] || "system-dev-orchestrator");
  const update = SKILLS && fs.existsSync(path.join(target, ".git"));
  if (!update && fs.existsSync(target) && fs.readdirSync(target).length > 0) die(`${target} は空でない`);

  const id = await ask("ID: ");
  const pw = await ask("Password: ", true);
  let token;
  try { token = decrypt(id, pw); } catch { die("IDまたはパスワードが違います"); }

  console.log("認証OK。導入中…");
  const url = REPO.replace("https://", `https://x-access-token:${token}@`);
  if (update) {
    const p = spawnSync("git", ["-C", target, "pull", "--ff-only", url, "main"], { stdio: ["ignore", "inherit", "inherit"] });
    if (p.status !== 0) die("更新に失敗（git pull）。管理者に連絡");
    const ins = spawnSync("bash", [path.join(target, "install.sh")], { stdio: "inherit" }); process.exit(ins.status || 0);
  }
  if (SKILLS) fs.mkdirSync(path.dirname(target), { recursive: true });
  const r = spawnSync("git", ["clone", "--depth", "1", url, target], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) die("clone失敗（トークン失効の可能性。管理者に連絡）");
  spawnSync("git", ["remote", "set-url", "origin", REPO], { cwd: target });

  if (SKILLS) { const ins = spawnSync("bash", [path.join(target, "install.sh")], { stdio: "inherit" }); process.exit(ins.status || 0); }
  console.log(`OK: ${target} に導入した。次の手順:
  1) cd ${path.relative(process.cwd(), target) || "."}
  2) pip3 install -r requirements.txt
  3) claude               # /sdlc new <顧客名> で開始（例は examples/test-shoji）`);
})();
