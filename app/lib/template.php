<?php
/**
 * Template Engine for Ollama Chat Client
 * 
 * シンプルなテンプレートエンジンクラス
 * 将来的な拡張機能のための基盤
 */

class TemplateEngine {
    private $templateDir;
    private $variables = [];
    private $debugMode = false;
    
    public function __construct($templateDir = 'templates', $debugMode = false) {
        $this->templateDir = $templateDir;
        $this->debugMode = $debugMode;
    }
    
    /**
     * テンプレート変数を設定
     */
    public function assign($key, $value) {
        $this->variables[$key] = $value;
    }
    
    /**
     * 複数の変数を一度に設定
     */
    public function assignArray($variables) {
        $this->variables = array_merge($this->variables, $variables);
    }
    
    /**
     * テンプレートファイルを読み込んで変数を置換
     */
    public function render($templateName) {
        $templatePath = $this->templateDir . '/' . $templateName;
        
        if (!file_exists($templatePath)) {
            throw new Exception("テンプレートファイルが見つかりません: $templatePath");
        }
        
        $template = file_get_contents($templatePath);
        
        if ($template === false) {
            throw new Exception("テンプレートファイルの読み込みに失敗しました: $templatePath");
        }
        
        // インクルード処理を実行
        $template = $this->processIncludes($template);
        
        // 条件分岐とループ処理を実行
        $template = $this->processConditions($template);
        $template = $this->processLoops($template);
        
        // 変数の置換
        foreach ($this->variables as $key => $value) {
            // デバッグモードの場合、null値をログに記録
            if ($this->debugMode && $value === null) {
                error_log("Template Debug: Variable '$key' is null");
            }
            
            // null値、配列、オブジェクトを適切に処理
            if ($value === null) {
                $replacementValue = '';
            } elseif (is_array($value) || is_object($value)) {
                $replacementValue = json_encode($value, JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $replacementValue = $value ? 'true' : 'false';
            } else {
                $replacementValue = (string)$value;
            }
            $template = str_replace('{' . $key . '}', $replacementValue, $template);
        }
        
        // 安全な変数置換も実行
        $template = $this->safeReplace($template);
        
        return $template;
    }
    
    /**
     * 複数のテンプレートを組み合わせてレンダリング
     */
    public function renderLayout($headerTemplate, $contentTemplate, $footerTemplate) {
        $header = $this->render($headerTemplate);
        $content = $this->render($contentTemplate);
        $footer = $this->render($footerTemplate);
        
        return $header . $content . $footer;
    }
    
    /**
     * テンプレートを直接出力
     */
    public function display($templateName) {
        echo $this->render($templateName);
    }
    
    /**
     * インクルード処理
     */
    public function processIncludes($template) {
        // {include:filename} の処理
        $pattern = '/\{include:([^}]+)\}/';
        $template = preg_replace_callback($pattern, function($matches) {
            $includeFile = $matches[1];
            $includePath = $this->templateDir . '/' . $includeFile;
            
            if (file_exists($includePath)) {
                $includeContent = file_get_contents($includePath);
                if ($includeContent !== false) {
                    // インクルードされたファイル内でも変数置換を実行
                    return $this->processVariableReplacement($includeContent);
                }
            }
            
            // ファイルが見つからない場合は空文字列を返す
            return '';
        }, $template);
        
        return $template;
    }
    
    /**
     * 変数置換の処理（インクルード用）
     */
    private function processVariableReplacement($template) {
        foreach ($this->variables as $key => $value) {
            if ($value === null) {
                $replacementValue = '';
            } elseif (is_array($value) || is_object($value)) {
                $replacementValue = json_encode($value, JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $replacementValue = $value ? 'true' : 'false';
            } else {
                $replacementValue = (string)$value;
            }
            $template = str_replace('{' . $key . '}', $replacementValue, $template);
        }
        return $template;
    }

    /**
     * 条件分岐の処理
     */
    public function processConditions($template) {
        // {if:variable}...{/if:variable} の処理
        $pattern = '/\{if:(\w+)\}(.*?)\{\/if:\1\}/s';
        $template = preg_replace_callback($pattern, function($matches) {
            $variable = $matches[1];
            $content = $matches[2];
            return isset($this->variables[$variable]) && $this->variables[$variable] ? $content : '';
        }, $template);
        
        // {unless:variable}...{/unless:variable} の処理
        $pattern = '/\{unless:(\w+)\}(.*?)\{\/unless:\1\}/s';
        $template = preg_replace_callback($pattern, function($matches) {
            $variable = $matches[1];
            $content = $matches[2];
            return !isset($this->variables[$variable]) || !$this->variables[$variable] ? $content : '';
        }, $template);
        
        return $template;
    }
    
    /**
     * ループ処理
     */
    public function processLoops($template) {
        // {each:array}...{/each:array} の処理
        $pattern = '/\{each:(\w+)\}(.*?)\{\/each:\1\}/s';
        $template = preg_replace_callback($pattern, function($matches) {
            $variable = $matches[1];
            $content = $matches[2];
            $result = '';
            
            if (isset($this->variables[$variable]) && is_array($this->variables[$variable])) {
                foreach ($this->variables[$variable] as $item) {
                    $itemContent = $content;
                    // {this} を現在のアイテムに置換
                    $itemContent = str_replace('{this}', $item, $itemContent);
                    $result .= $itemContent;
                }
            }
            
            return $result;
        }, $template);
        
        return $template;
    }
    
    /**
     * エスケープ処理
     */
    public function escape($value) {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * 安全な変数置換（HTMLエスケープ付き）
     */
    public function safeReplace($template) {
        foreach ($this->variables as $key => $value) {
            if ($value !== null && is_string($value)) {
                $template = str_replace('{safe:' . $key . '}', $this->escape($value), $template);
            } elseif ($value !== null) {
                // 文字列以外の値は文字列に変換してからエスケープ
                $template = str_replace('{safe:' . $key . '}', $this->escape((string)$value), $template);
            } else {
                // null値の場合は空文字列に置換
                $template = str_replace('{safe:' . $key . '}', '', $template);
            }
        }
        return $template;
    }
}
