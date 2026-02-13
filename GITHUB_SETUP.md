# 关联 GitHub 仓库 sgpropertypro

## 已完成

- [x] Git 初始化
- [x] `.gitignore` 创建（已排除 venv、.env、node_modules 等）
- [x] 首次提交

## 你需要完成的步骤

### 1. 在 GitHub 创建仓库

1. 打开 https://github.com/new
2. 仓库名称填写：**sgpropertypro**
3. 可见性选择：Public 或 Private
4. **不要**勾选 "Add a README file"（本地已有代码）
5. 点击 "Create repository"

### 2. 添加远程并推送

在终端执行（把 `YOUR_USERNAME` 换成你的 GitHub 用户名）：

```bash
cd /Users/bytedance/Dropbox/beining/code/propertyassistance

# 添加远程（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/sgpropertypro.git

# 推送到 GitHub
git push -u origin main
```

### 3. 配置 Git 用户信息（若未配置）

若推送时提示 author 相关信息，可先设置：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的GitHub邮箱或 noreply 邮箱"
```

---

完成后可删除本文件：`rm GITHUB_SETUP.md`
