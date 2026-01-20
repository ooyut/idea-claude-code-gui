# 多平台开发问题与解决方案指南

本文档整理了 CodeMoss 多平台（IDEA、Tauri、Web、VSCode）开发过程中遇到的问题和解决方案，供后续开发参考。

---

## 目录

1. [架构设计问题](#一架构设计问题)
2. [web-server 相关问题](#二web-server-相关问题)
3. [WebSocket 连接问题](#三websocket-连接问题)
4. [Tauri 相关问题](#四tauri-相关问题)
5. [SDK 依赖相关问题](#五sdk-依赖相关问题)
6. [跨平台适配器模式](#六跨平台适配器模式)
7. [VSCode 端开发建议](#七vscode-端开发建议)
8. [关键文件清单](#八关键文件清单)

---

## 一、架构设计问题

### 问题 1：代码重复，各平台 Handler 逻辑相似

**现象**：IDEA Handler 和 web-server 服务有大量重复代码（~40% 重复率）

**解决方案**：采用混合架构（Hybrid Architecture）

- IDEA 保留平台特有的 Handler（如 DiffHandler、FileHandler、PermissionHandler）
- 通用逻辑转发到 web-server（MCP、Agent、Skill、Session 管理等）
- 创建 `ProxyHandler` + `WebServerClient` 进行 HTTP 转发

```
┌─────────────────────────────────────────┐
│           Platform Adapter              │
│  (IDEA / VSCode / Tauri / Web)          │
├─────────────────────────────────────────┤
│  平台特有 Handler  │  ProxyHandler      │
│  (IDE API 相关)    │  (转发到 web-server)│
└────────────────────┼────────────────────┘
                     │ HTTP
                     ▼
┌─────────────────────────────────────────┐
│              web-server                  │
│  /api/v1/mcp, /agents, /skills, ...     │
└─────────────────────────────────────────┘
```

**相关文件**：
- `docs/HYBRID_ARCHITECTURE_PLAN.md` - 详细架构设计
- `src/main/java/.../proxy/ProxyHandler.java` - IDEA 代理处理器
- `src/main/java/.../proxy/WebServerClient.java` - HTTP 客户端

---

## 二、web-server 相关问题

### 问题 2：web-server 启动后浏览器打不开

**现象**：`open` 包在某些环境下无法正常打开浏览器

**解决方案**：使用原生 `spawn` 替代 `open` 包

```typescript
// web-server/src/index.ts
import { spawn } from 'child_process';

// 替换 open(url) 为：
function openBrowser(url: string) {
  if (process.platform === 'darwin') {
    spawn('open', [url]);
  } else if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', url]);
  } else {
    spawn('xdg-open', [url]);
  }
}
```

### 问题 3：web-server API 路由不完整

**现象**：服务存在但路由未注册，前端调用 404

**解决方案**：检查 `server.ts` 是否注册了所有路由

```typescript
// web-server/src/server.ts
// 确保所有路由都已注册
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/workspace', workspaceRouter);
app.use('/api/v1/sessions', sessionsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/providers', providersRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/mcp', mcpRouter);           // 容易遗漏
app.use('/api/v1/agents', agentsRouter);     // 容易遗漏
app.use('/api/v1/skills', skillsRouter);     // 容易遗漏
app.use('/api/v1/dependencies', dependenciesRouter); // 容易遗漏
```

**排查步骤**：
1. 检查 `routes/` 目录是否存在对应文件
2. 检查 `server.ts` 是否 import 并注册
3. 使用 `curl http://localhost:3456/api/v1/health` 测试

---

## 三、WebSocket 连接问题

### 问题 4：WebSocket 连接失败，无法确定原因

**现象**：前端连接 WebSocket 失败，日志不够详细

**解决方案**：在 WebAdapter 中添加详细日志

```typescript
// webview/src/adapters/WebAdapter.ts
export class WebAdapter implements PlatformAdapter {
  private ws: WebSocket | null = null;

  connect() {
    const wsUrl = this.buildWebSocketUrl();
    console.log('[WebAdapter] Attempting WebSocket connection to:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebAdapter] WebSocket connected successfully');
    };

    this.ws.onerror = (error) => {
      console.error('[WebAdapter] WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('[WebAdapter] WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
    };

    this.ws.onmessage = (event) => {
      console.log('[WebAdapter] Message received:', event.data.substring(0, 100));
    };
  }
}
```

### 问题 5：WebSocket URL 构建错误

**现象**：协议或端口不正确导致连接失败

**解决方案**：正确构建 WebSocket URL

```typescript
private buildWebSocketUrl(): string {
  // 根据当前页面协议选择 ws 或 wss
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  console.log('[WebAdapter] Built WebSocket URL:', wsUrl);
  return wsUrl;
}
```

**常见错误**：
- 使用 `http:` 而不是 `ws:`
- 硬编码端口导致与实际不符
- 忘记处理 HTTPS 场景

---

## 四、Tauri 相关问题

### 问题 6：Tauri 启动 web-server 失败，无日志

**现象**：server 进程启动但无法看到输出

**解决方案**：在 `lib.rs` 中捕获 stdout/stderr

```rust
// src-tauri/src/lib.rs
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::thread;

fn start_server() -> Result<(), String> {
    let mut child = Command::new("node")
        .arg("dist/index.js")
        .current_dir(&server_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn server: {}", e))?;

    // 捕获 stdout
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    println!("[Server stdout] {}", line);
                }
            }
        });
    }

    // 捕获 stderr
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!("[Server stderr] {}", line);
                }
            }
        });
    }

    Ok(())
}
```

### 问题 7：Tauri 找不到 Node.js

**现象**：macOS 上 PATH 环境变量不包含 Node.js 路径

**原因**：Tauri 应用作为 GUI 程序启动时，不会继承 shell 的 PATH 配置

**解决方案**：显式设置 PATH 环境变量

```rust
fn start_server() -> Result<(), String> {
    // 获取当前 PATH
    let path = std::env::var("PATH").unwrap_or_default();

    // 添加常见的 Node.js 安装路径
    let additional_paths = if cfg!(target_os = "macos") {
        "/usr/local/bin:/opt/homebrew/bin:/opt/local/bin"
    } else if cfg!(target_os = "windows") {
        "C:\\Program Files\\nodejs"
    } else {
        "/usr/local/bin"
    };

    let new_path = format!("{}:{}", additional_paths, path);

    let mut command = Command::new("node");
    command.env("PATH", new_path);
    // ...
}
```

### 问题 8：Tauri 打包后资源路径错误

**现象**：开发环境正常，打包后找不到文件

**解决方案**：使用 Tauri 的资源解析 API

```rust
use tauri::Manager;

#[tauri::command]
fn get_resource_path(app: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| e.to_string())?;

    Ok(resource_path.to_string_lossy().to_string())
}
```

---

## 五、SDK 依赖相关问题

### 问题 9：SDK 依赖加载不出来

**可能原因**：
1. Node.js 未安装或不在 PATH
2. `~/.codemoss/dependencies/` 目录不存在
3. SDK 包未正确安装

**解决方案**：

```typescript
// web-server/src/services/dependency-service.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// 1. 检查 Node.js 环境
export function checkNodeEnvironment(): NodeEnvironmentStatus {
  try {
    const version = execSync('node --version', {
      encoding: 'utf-8',
      timeout: 5000
    }).trim();
    return { available: true, version };
  } catch (error) {
    return {
      available: false,
      error: 'Node.js is not installed or not in PATH'
    };
  }
}

// 2. 检查 SDK 安装路径
export function checkSdkInstalled(sdkId: string): SdkCheckResult {
  const DEPENDENCIES_DIR = path.join(os.homedir(), '.codemoss', 'dependencies');
  const sdkPath = path.join(DEPENDENCIES_DIR, sdkId);

  // 检查多个可能的包路径
  const packagePaths = [
    path.join(sdkPath, 'node_modules', '@anthropic-ai', 'claude-code', 'package.json'),
    path.join(sdkPath, 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json'),
  ];

  for (const pkgPath of packagePaths) {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        installed: true,
        version: pkg.version,
        path: sdkPath
      };
    }
  }

  return { installed: false };
}
```

### 问题 10：SDK 依赖加载出来了但页面一直 Loading

**可能原因**：
1. 前端回调函数未正确注册
2. 后端返回数据格式不正确
3. 异步调用未正确处理
4. 错误未被捕获导致 loading 状态未重置

**解决方案**：

```typescript
// 前端：确保有正确的回调和错误处理
// webview/src/hooks/useDependencies.ts
export function useDependencies() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DependencyStatus | null>(null);

  useEffect(() => {
    // 注册回调
    window.updateDependencyStatus = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.success) {
          setStatus(parsed.data);
          setError(null);
        } else {
          setError(parsed.error || '加载依赖状态失败');
        }
      } catch (e) {
        console.error('Failed to parse dependency status:', e);
        setError('解析依赖状态失败');
      } finally {
        setLoading(false); // 关键：无论成功失败都要设置 loading 为 false
      }
    };

    // 设置超时保护
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('加载超时，请重试');
      }
    }, 30000);

    // 请求依赖状态
    adapter.sendMessage('check_dependencies', {});

    return () => {
      clearTimeout(timeout);
      delete window.updateDependencyStatus;
    };
  }, []);

  return { loading, error, status };
}
```

```typescript
// 后端：确保返回正确格式
// web-server/src/routes/dependencies.ts
router.get('/', async (req, res) => {
  try {
    const nodeStatus = checkNodeEnvironment();
    const sdkStatus = checkAllSdkStatus();

    // 统一的响应格式
    res.json({
      success: true,
      data: {
        node: nodeStatus,
        sdks: sdkStatus,
      },
    });
  } catch (error) {
    // 错误时也要返回标准格式
    res.status(500).json({
      success: false,
      error: 'DEPENDENCIES_CHECK_ERROR',
      message: error.message,
    });
  }
});
```

---

## 六、跨平台适配器模式

### 问题 11：不同平台通信方式不同

**现象**：
- IDEA：JsBridge（JCEF）
- VSCode：postMessage（Webview API）
- Tauri：Tauri Commands
- Web：WebSocket + HTTP

**解决方案**：统一适配器接口

```typescript
// webview/src/adapters/types.ts
export interface PlatformAdapter {
  // 发送消息到后端
  sendMessage(type: string, content: any): void;

  // 接收后端消息
  onMessage(callback: (type: string, content: any) => void): void;

  // 获取平台标识
  getPlatform(): 'idea' | 'vscode' | 'tauri' | 'web';

  // 可选：连接/断开
  connect?(): void;
  disconnect?(): void;
}
```

```typescript
// webview/src/adapters/VSCodeAdapter.ts
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

export class VSCodeAdapter implements PlatformAdapter {
  private vscode = acquireVsCodeApi();
  private messageCallback: ((type: string, content: any) => void) | null = null;

  constructor() {
    // 监听来自 Extension 的消息
    window.addEventListener('message', (event) => {
      const { type, content } = event.data;
      if (this.messageCallback) {
        this.messageCallback(type, content);
      }
    });
  }

  sendMessage(type: string, content: any): void {
    this.vscode.postMessage({ type, content });
  }

  onMessage(callback: (type: string, content: any) => void): void {
    this.messageCallback = callback;
  }

  getPlatform(): 'vscode' {
    return 'vscode';
  }
}
```

```typescript
// webview/src/adapters/TauriAdapter.ts
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export class TauriAdapter implements PlatformAdapter {
  private messageCallback: ((type: string, content: any) => void) | null = null;

  constructor() {
    // 监听来自 Rust 后端的事件
    listen('backend-message', (event) => {
      const { type, content } = event.payload as any;
      if (this.messageCallback) {
        this.messageCallback(type, content);
      }
    });
  }

  sendMessage(type: string, content: any): void {
    invoke('handle_message', { type, content });
  }

  onMessage(callback: (type: string, content: any) => void): void {
    this.messageCallback = callback;
  }

  getPlatform(): 'tauri' {
    return 'tauri';
  }
}
```

```typescript
// webview/src/adapters/index.ts
import { PlatformAdapter } from './types';
import { IdeaAdapter } from './IdeaAdapter';
import { VSCodeAdapter } from './VSCodeAdapter';
import { TauriAdapter } from './TauriAdapter';
import { WebAdapter } from './WebAdapter';

export function createAdapter(): PlatformAdapter {
  // 检测运行环境
  if (window.__TAURI__) {
    return new TauriAdapter();
  }
  if (typeof acquireVsCodeApi !== 'undefined') {
    return new VSCodeAdapter();
  }
  if (window.cefQuery) {
    return new IdeaAdapter();
  }
  return new WebAdapter();
}

export const adapter = createAdapter();
```

---

## 七、VSCode 端开发建议

基于以上经验，VSCode 端开发时注意：

### 架构选择

| 方案 | 优点 | 缺点 | 推荐场景 |
|-----|------|------|---------|
| 内嵌 web-server | 代码复用率高 | 需要管理进程 | 功能完整的插件 |
| 纯 Extension API | 无外部依赖 | 需要重写服务层 | 轻量级插件 |
| 混合方案 | 灵活 | 复杂度较高 | 推荐 |

### 推荐的混合方案

```
┌─────────────────────────────────────────────────────┐
│                  VSCode Extension                    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Webview     │  │ Extension   │  │ web-server  │  │
│  │ (React UI)  │◄─┤ Host        │◄─┤ (Node.js)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│        │               │                  │          │
│        │ postMessage   │ spawn/manage     │          │
│        └───────────────┴──────────────────┘          │
└─────────────────────────────────────────────────────┘
```

### Extension Host 核心代码

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

let serverProcess: ChildProcess | null = null;

export function activate(context: vscode.ExtensionContext) {
  // 启动 web-server
  startWebServer(context);

  // 注册 Webview Provider
  const provider = new CodeMossViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codemoss.chatView', provider)
  );
}

function startWebServer(context: vscode.ExtensionContext) {
  const serverPath = path.join(context.extensionPath, 'web-server', 'dist', 'index.js');

  serverProcess = spawn('node', [serverPath], {
    env: {
      ...process.env,
      PORT: '3456',
      HOST: 'localhost'
    }
  });

  serverProcess.stdout?.on('data', (data) => {
    console.log(`[web-server] ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    console.error(`[web-server] ${data}`);
  });
}

export function deactivate() {
  if (serverProcess) {
    serverProcess.kill();
  }
}
```

### Webview Provider 核心代码

```typescript
// src/CodeMossViewProvider.ts
import * as vscode from 'vscode';

export class CodeMossViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // 处理来自 Webview 的消息
    webviewView.webview.onDidReceiveMessage(async (message) => {
      const { type, content } = message;

      switch (type) {
        case 'check_dependencies':
          const status = await this.checkDependencies();
          webviewView.webview.postMessage({
            type: 'dependency_status',
            content: status
          });
          break;
        // ... 其他消息处理
      }
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'index.js')
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div id="root"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}
```

---

## 八、关键文件清单

开发 VSCode 端时可复用的文件：

### 服务层（100% 复用）

```
web-server/src/services/
├── dependency-service.ts    # SDK 依赖检查
├── mcp-service.ts          # MCP 服务器管理
├── agent-service.ts        # Agent 管理
├── skill-service.ts        # Skill 管理
├── sessions-service.ts     # 会话管理
├── settings-service.ts     # 设置管理
└── provider-service.ts     # Provider 管理
```

### 路由层（100% 复用）

```
web-server/src/routes/
├── health.ts
├── sessions.ts
├── settings.ts
├── providers.ts
├── mcp.ts
├── agents.ts
├── skills.ts
└── dependencies.ts
```

### 前端组件（100% 复用）

```
webview/src/
├── components/          # 所有 UI 组件
├── hooks/              # React hooks
├── stores/             # 状态管理
├── utils/              # 工具函数
└── styles/             # 样式文件
```

### 需要新建/修改的文件

```
vscode-extension/
├── src/
│   ├── extension.ts           # 插件入口
│   ├── CodeMossViewProvider.ts # Webview Provider
│   └── serverManager.ts       # web-server 进程管理
├── webview/
│   └── src/adapters/
│       └── VSCodeAdapter.ts   # VSCode 适配器（新建）
└── package.json               # VSCode 插件配置
```

---

## 附录：快速排查清单

### 依赖加载问题排查

- [ ] Node.js 是否安装？`node --version`
- [ ] PATH 是否包含 Node.js？`which node`
- [ ] `~/.codemoss/dependencies/` 目录是否存在？
- [ ] SDK 包是否正确安装？检查 `node_modules` 目录
- [ ] 前端回调函数是否注册？检查 `window.updateDependencyStatus`
- [ ] 后端响应格式是否正确？检查 `success` 和 `data` 字段
- [ ] 是否有超时保护？检查 `finally` 块中的 `setLoading(false)`

### WebSocket 连接问题排查

- [ ] 服务器是否启动？`curl http://localhost:3456/api/v1/health`
- [ ] WebSocket URL 是否正确？检查协议和端口
- [ ] CORS 是否配置？检查 `cors()` 中间件
- [ ] 防火墙是否阻止？检查端口访问

### 打包后问题排查

- [ ] 资源路径是否使用相对路径？
- [ ] 是否使用了正确的资源解析 API？
- [ ] 环境变量是否正确设置？
- [ ] 日志输出是否正常？

---

*文档版本: 1.0.0*
*创建日期: 2026-01-19*
*适用项目: CodeMoss 多平台开发*
