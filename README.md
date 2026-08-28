# Agent Skills

コーディングエージェント向けの個人用スキル集です。Git の変更を安全にコミットするスキルと、変更を多角的に検証するレビュースキルを収録しています。

## Skills

### `commit`

作業ツリーを確認し、意図した変更だけをステージして、1つのローカルコミットを作成します。

- 既にステージされている変更を尊重
- 未追跡ファイルや無関係な変更、機密情報の混入を確認
- リポジトリの履歴に合うコミットメッセージを生成
- フックを迂回せず、push や amend は実行しない

```text
$commit
```

### `adversarial-review`

現在の変更に対して懐疑的なレビューをバックグラウンドエージェントへ委譲し、その指摘を親エージェントが独立して再検証します。

```text
$adversarial-review
$adversarial-review --scope working-tree
$adversarial-review --scope branch
$adversarial-review --base origin/main security and data integrity
```

利用できるオプションは次のとおりです。

| オプション | 内容 |
| --- | --- |
| `--scope auto` | 変更があれば作業ツリー、なければベースブランチとの差分をレビュー（既定値） |
| `--scope working-tree` | staged、unstaged、untracked の変更をレビュー |
| `--scope branch` | 自動検出したベースブランチとのマージ差分をレビュー |
| `--base <ref>` | 指定した ref とのマージベースから `HEAD` までをレビュー |

オプション以外のテキストは、レビューで重視する観点としてそのまま渡されます。このスキルはレビュー専用であり、指摘された問題の修正やコミットは行いません。

## Structure

```text
skills/
├── commit/
│   ├── SKILL.md
│   └── agents/openai.yaml
└── adversarial-review/
    ├── SKILL.md
    ├── agents/openai.yaml
    └── references/reviewer.md
```

- `SKILL.md`: スキルの発動条件と実行手順
- `agents/openai.yaml`: UI 表示名、説明、既定プロンプトなどのメタデータ
- `references/`: スキルから参照する補助指示

## Design principles

- Git 操作ではユーザーの既存の変更を尊重する
- レビュー系スキルは読み取り専用に保つ
- 指摘は差分とリポジトリ内の根拠に基づくものに限定する
- レビューの委譲結果を鵜呑みにせず、親エージェントが再検証する
- エラーや曖昧な状態では、安全性を弱めて処理を続行しない
