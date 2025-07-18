# Ollama Client for PHP

このドキュメントは、Ollama Client for PHPの仕様を説明します。

## 概要

LLMを手軽に利用できるOllamaのAPIにアクセスして、PHPから簡単にLLMを利用できるクライアントライブラリです。

なお、画面はHTML/JavaScriptで実装してください。
PHPはできるだけ、APIの実装に専念してください。

PHPのフレームワークは利用せずに、シンプルなPHPスクリプトで実装してください。
但しAPIのルーティングのために、`api.php`というファイルを用意し、APIのエンドポイントを定義してください。

データベースには、SQLiteを利用してください。

## ユーザーログイン画面

ユーザー毎にLLMのモデルを設定できるようにするため、ユーザー毎にログインできるようにしてください。

## ユーザー編集画面

ユーザーの情報を編集する画面です。
ユーザー名とデフォルトのLLMのモデル名を編集できるようにしてください。
ユーザー名とパスワードでログインできるようにしてください。
ユーザー情報は、データベースに保存されます。
パスワードは、ハッシュ化して保存してください。SALTを記録するフィールドも作成して、ユーザー登録時に、SALTも保存してください。

## チャット画面

OllamaのLLMとチャットをする画面です。
最初に表示される画面です。

画面上部に入力ボックスがあり、ユーザーがメッセージを入力すると、その下にLLMの応答が表示されます。メッセージは、コピーできるようにしてください。

ユーザーが送信したメッセージと、LLMの応答は、データベースに保存されます。

後述のテンプレート画面で入力したテンプレートをコンボボックスで選んで挿入できるようにしてください。

また、LLMのモデル名を選択できるようにし、選択したモデル名でチャットを行えるようにしてください。

モデルは変更したらデフォルトとしてユーザー毎に記憶してください。

## プロンプトテンプレート作成画面

テンプレートはユーザー毎に保存します。
プロンプトのテンプレートを作成する画面です。複数のテンプレートを保存できるようにしてください。テンプレートの編集が手軽にできるようにしてください。

プロンプトテンプレートは、次の内容を保存できるようにしてください。

- ユーザーID
- テンプレートタイトル
- テンプレートの内容
- 対象となるLLMのモデル名
- 作成日時
- 更新日時

## 設定画面

デフォルトのLLMのモデル名を設定する画面です。
Ollamaからモデルの一覧を取得して、選択できるようにしてください。
OllamaのURLを指定できるようにしてください。デフォルトは、`http://localhost:11434` とします。

## モデル取得画面

Ollamaからモデルの一覧を取得して、表示する画面です。
モデル名をクリックすると、モデルの詳細情報が表示されるようにしてください。
https://ollama.com/search からモデルの一覧を取得して、表示してください。

### システムプロンプト

システムプロンプトを指定できるようにしたいです。usesテーブルにシステムプロンプトを記録するフィールドを追加して、設定画面でシステムプロンプトを編集する機能を付けてください。
