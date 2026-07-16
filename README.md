# sdlc-get

社内FDE向け: **ID / パスワードの入力だけ**で sdlc-orchestrator（システム開発ライフサイクル自動化パイプライン）を導入するインストーラ。

```bash
npx github:rezon-inc/sdlc-get
# ID:       （管理者から共有されたID）
# Password: （管理者から共有されたパスワード）
# → ./system-dev-orchestrator に導入される
```

必要要件: Node 18+ / git / Python 3.10+ / [Claude Code](https://claude.com/claude-code)

## 仕組み（なぜ安全か）
- 本体リポジトリは private。このリポジトリには**パスワードで暗号化された読取専用デプロイトークン**（`token.enc`, AES-256-GCM + scrypt）だけが置かれる。
- 正しい ID/パスワードを入力すると復号に成功し、clone が走る。トークン平文は端末に保存されない。
- 秘密の正本（パスワードとトークン）は管理者のMacの Keychain にのみ存在し、パスワード変更・ローテーション（`seal-token.js`）はそのMacでしか実行できない。

問い合わせ: Rezon COO（野村）
