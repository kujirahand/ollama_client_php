# Ollama Client for PHP

OllamaのAPIにアクセスして、PHPから簡単にLLMを利用できるWebアプリケーションです。

## 特徴

- **シンプルなPHP実装**: フレームワークを使わずに軽量な実装
- **ユーザー認証**: ユーザー毎の設定管理とチャット履歴
- **プロンプトテンプレート**: よく使うプロンプトを保存・再利用
- **モデル管理**: Ollamaの利用可能モデルの一覧と詳細情報
- **レスポンシブUI**: モダンで美しいWebインターフェース
- **SQLiteデータベース**: 軽量なデータベースで簡単セットアップ

## 必要環境

- PHP 7.4以上
- SQLite3拡張
- cURL拡張
- Ollama（ローカルまたはリモート）

## インストール

1. リポジトリをクローン:
```bash
git clone https://github.com/kujirahand/ollama_client_php.git
cd ollama_client_php
```

2. Webサーバーのドキュメントルートに`app`フォルダを配置

3. ブラウザでアクセス

## 初期ログイン情報

- **ユーザー名**: admin
- **パスワード**: admin123

## 使用方法

### 1. ログイン
初期アカウントでログインするか、新規ユーザーを登録してください。

### 2. Ollama設定
設定画面でOllamaのURLを設定してください（デフォルト: http://localhost:11434）

### 3. モデル選択
チャット画面でLLMモデルを選択してチャットを開始できます。

### 4. テンプレート作成
よく使うプロンプトをテンプレートとして保存し、チャット時に簡単に挿入できます。

## 機能一覧

### チャット機能
- Ollamaとのリアルタイムチャット
- チャット履歴の保存と表示
- メッセージのコピー機能
- モデル選択

### プロンプトテンプレート
- テンプレートの作成・編集・削除
- テンプレートからの簡単挿入
- モデル別テンプレート管理

### モデル管理
- 利用可能モデルの一覧表示
- モデル詳細情報の表示
- モデルサイズと更新日の確認

### ユーザー管理
- ユーザー認証（ログイン・ログアウト）
- ユーザー情報の編集
- デフォルトモデルの設定
- パスワード変更

### 設定機能
- OllamaのURL設定
- デフォルトモデル設定
- ユーザー情報編集

## API仕様

APIは`app/api.php`で実装されており、以下のエンドポイントが利用可能です：

- `POST api.php?action=login` - ログイン
- `POST api.php?action=logout` - ログアウト
- `POST api.php?action=register` - ユーザー登録
- `GET api.php?action=user` - ユーザー情報取得
- `PUT api.php?action=user` - ユーザー情報更新
- `GET api.php?action=chat` - チャット履歴取得
- `POST api.php?action=chat` - チャット送信
- `POST api.php?action=chat-stream` - チャットストリーミング
- `POST api.php?action=save-chat` - チャット履歴保存
- `GET api.php?action=models` - モデル一覧取得
- `POST api.php?action=model-info` - モデル詳細情報取得
- `GET api.php?action=templates` - テンプレート一覧取得
- `POST api.php?action=templates` - テンプレート作成
- `PUT api.php?action=templates` - テンプレート更新
- `DELETE api.php?action=templates` - テンプレート削除
- `GET api.php?action=ollama-status` - Ollama接続状態確認

## データベース構造

SQLiteデータベースには以下のテーブルが作成されます：

- `users` - ユーザー情報
- `chat_history` - チャット履歴
- `prompt_templates` - プロンプトテンプレート

## セキュリティ

- パスワードはSALT付きでハッシュ化して保存
- セッション管理による認証
- SQLインジェクション対策（PDO使用）
- データベースファイルへの直接アクセス禁止

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。
Ollama client for PHP
