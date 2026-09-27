---
name: playwright
description: Operate websites and verify browser behavior with Playwright MCP through the existing Windows Chrome profile from WSL2. Use for browser automation, UI checks, and browser-based data acquisition; not for creating or running a project's Playwright test suite.
---

# Playwright

WSL2 から Windows 側の Google Chrome を操作する。設定済みの `playwright` MCP を優先し、
ネイティブツールが利用できないセッションでは同梱ランチャーの gateway モードを使う。

## 接続するブラウザー

- Windows Chrome の既存プロファイルと、インストール済みの Playwright Extension を使う。
  Linux Chrome / Chromium、隔離プロファイル、Chrome DevTools MCP、`--autoConnect` には切り替えない。
- 既定のプロファイルは `Default`。別のプロファイルを指定する依頼では、対応する拡張と
  トークンを確認し、`--profile-dir-name` と `--token-file` を合わせて指定する。
- ログインや MFA が必要な場合は、Windows Chrome での操作をユーザーに依頼する。
  既存トークンで接続できる場合、接続許可の確認を繰り返さない。
- 接続できない場合は Windows Chrome の起動状態、拡張、MCP 設定、次のファイルの存在を確認する。
  未導入の構成要素を報告し、別ブラウザーへの切り替えや再インストールは行わない。

| 用途 | Windows 側の既定パス |
| --- | --- |
| MCP 本体 | `%LOCALAPPDATA%\PlaywrightMCP\node_modules\@playwright\mcp\cli.js` |
| 接続トークン | `%LOCALAPPDATA%\PlaywrightMCP\extension-token.txt` |

トークンは Windows プロセス内だけで読み取り、MCP 子プロセスの環境変数
`PLAYWRIGHT_MCP_EXTENSION_TOKEN` に渡す。値を表示したり、WSL 側で読み取ったり、引数・チャット・
Git に保存したりしない。認証情報や Cookie はブラウザー内に保持する。
ランチャーは子プロセスの stderr を抑制し、プロトコル出力中のトークンを伏せる。

## ブラウザーの操作

使用前にツールのスキーマを確認する。`browser_tabs` でこの接続のタブを取得し、対象タブを選択する。
接続ごとにタブのグループが異なるため、既存タブが見えない場合は同じプロファイルにタブを作る。
タブ番号や操作対象の参照は最新の snapshot から取得し、別接続の値を使い回さない。

ダウンロードは Chrome の通常の保存先に届くことがある。MCP がダウンロードエラーを返した場合も、
実ファイルの到着と完了を確認する。ツールのエラーだけを理由に、同じダウンロードを再度クリックしない。

## gateway モード

ネイティブの `playwright` MCP ツールが利用できない場合だけ、次のコマンドを対話型の exec セッションで起動する。

```bash
node "$HOME/.agents/skills/playwright/scripts/windows-playwright-mcp.mjs" --gateway
```

stdin を開いたまま `{"ready":true}` を待つ。これは MCP 初期化の完了であり、Chrome との接続は
`browser_tabs` で確認する。JSON を1行ずつ送り、各応答を待ってから次の操作を送る。

```json
{"method":"tools/list"}
{"name":"browser_tabs","arguments":{"action":"list"}}
{"name":"browser_snapshot","arguments":{}}
```

終了時は `exit` を送る。EOF や割り込みでも MCP を切断し、Chrome 自体は開いたままにする。

## 出力先とオプション

snapshot やログの既定出力先は `${XDG_CACHE_HOME:-~/.cache}/playwright-mcp/run-*`。
起動ごとに別ディレクトリを作り、終了後も確認用に保持する。作業中のリポジトリには出力しない。
保存先を指定する場合は `--output-dir=<Windows 絶対パス>` を使う。

`--windows-node` は WSL 上の実行ファイルパス、`--mcp-entry` と `--token-file` は Windows パスを受け取る。
詳細は同梱ランチャーの `--help` と、必要に応じて
[公式拡張の手順](https://github.com/microsoft/playwright/blob/main/packages/extension/README.md)を参照する。

ランチャー変更時は、次の既存テストと実接続・再接続・正常終了を確認する。

```bash
node --test "$HOME/.agents/skills/playwright/scripts/windows-playwright-mcp.test.mjs"
```
