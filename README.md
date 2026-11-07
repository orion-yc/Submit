# Submit

Submit 是一个 Chrome Manifest V3 扩展，用于在 BOSS 直聘职位列表里筛选职位、确认沟通状态并管理本地投递记录。扩展页面与职位页采用原生 JavaScript 模块；可选的本地同步服务使用 C++17 编写。

## 项目布局

```text
app/
  background/   后台消息入口、存储仓库和本机服务客户端
  content/      BOSS 页面适配、任务执行与页面工作台
  core/         设置校验、职位规则、记录格式和消息协议
  popup/        扩展弹窗与样式
backend/
  include/      服务接口
  src/          HTTP、路由、文件存储和启动入口
branding/       娃娃主题品牌图像
tests/          匹配、迁移、记录与 CSV 测试
tools/          扩展结构和模块检查
data/           本地同步服务的数据文件
```

## 加载扩展

1. 打开 Chrome 的 `chrome://extensions/` 页面并启用开发者模式。
2. 选择“加载已解压的扩展程序”，然后选择此项目根目录，例如 `E:\Develop\Submit`。
3. 重新加载 Submit，并刷新 BOSS 直聘职位列表页。
4. 在工具栏打开 Submit，设置关键词和筛选条件后启动任务。任务状态和跳过原因会显示在职位页右下角。

## 可选的 C++ 服务

扩展离线时仍会将设置和记录保存在 Chrome 本地存储。启动本地服务后，扩展会自动在本机同步数据。

需要 CMake 和 C++17 编译器：

```powershell
cmake -S backend -B backend/build
cmake --build backend/build --config Release
```

在项目根目录运行：

```powershell
.\backend\build\Release\submit_service.exe
```

服务监听 `127.0.0.1:8888`。根地址显示服务状态；健康接口为 `/api/health`。设置和记录接口由扩展内部调用。

## 检查与测试

安装 Node.js 后在项目根目录执行：

```powershell
npm test
npm run check
```

`npm test` 检查设置迁移、筛选结果、招呼语模板和记录导出。`npm run check` 检查扩展资源、JavaScript 语法和端口配置。

## 数据与隐私

- Chrome 本地状态保存在扩展的 `chrome.storage` 中。
- C++ 服务仅绑定本机回环地址，数据文件位于启动目录下的 `data/config.json` 和 `data/records.ndjson`。
- 清理项目时请保留 `data/`，其中存放本机配置和投递记录。

## 使用边界

扩展只在用户已登录的 BOSS 直聘职位页运行。新任务默认只检查少量职位；首次使用可以设置一条关键词并关闭自定义招呼语，先检查筛选结果和职位页工作台。只有页面明确确认进入沟通流程后，职位才会写入记录；聊天页面不会盲目重复发送已发过的招呼语。
