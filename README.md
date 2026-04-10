# 简易代理

## 安装
| <a href="https://microsoftedge.microsoft.com/addons/detail/mdoojhdlkngkgcgkefkbmfaahpclojen"><img src="https://github.com/user-attachments/assets/755ede26-33d5-41eb-9000-9ba903886041" title="Microsoft Edge" width="64" height="64"></a> | <a href="https://addons.mozilla.org/firefox/addon/easy-proxy/"><img src="https://github.com/user-attachments/assets/e2bb973f-5106-4eae-8d1d-4a3dd25b01e5" title="Mozilla Firefox" width="64" height="64"></a> | TBA |
| - | - | - |

## 关于
- 这是一个简单易用的自动代理扩展
- 可以通过设置添加代理服务器跟对应规则
- 可以通过设置导出代理规则或PAC自动代理脚本
- 可以通过工具栏图标查询当前页面的可代理规则
- 可以通过工具栏图标添加代理规则或临时代理规则
- 可以通过[PAC 脚本压缩工具](//jc3213.github.io/webware/html/minifier.html)压缩PAC脚本大小

## 用户手册
- 通过`设置`添加并管理代理档案
    - `Ctrl`+`S`：保存设置
    - `Ctrl`+`A`：管理自动代理错误清单
    - 点击`导出`可导出用户设置以方便部署到其他电脑
    - 点击`导入`以导入用户设置
        - 如果导入设置后无法立刻生效，请禁用扩展再启用即可修复
    - 点击`🧲`可重新排序当前代理档案下的规则池
    - 点击`💾`可以将代理档案导出为`PAC`文件
- 点击`工具栏`菜单会显示已获取的当前页面可用的匹配规则
    - 工具栏菜单支持快捷键
    - `Tab`： 切换域名规则
    - `ESC`：恢复规则至默认状态
    - `Ctrl`+`S`或`Enter ⏎`：提交规则变化
    - `Ctrl`+`E`: 清理临时规则
    - `Ctrl`+`Q`：打开`设置`窗口
    - 代理规则的状态可以通过鼠标滚轮快速修改
- 火狐必须勾选隐私模式才能正常工作

## 界面截图
![设置：初始化](https://github.com/user-attachments/assets/d2f7f366-3515-4f04-bd05-2f10bf30ae82)
![设置：样例](https://github.com/user-attachments/assets/f924d1b2-c38c-4c95-b9f6-3b3158f2c3ef)
![工具栏：通用规则](https://github.com/user-attachments/assets/f11ed72e-be7a-4681-809a-3e3e15771694)
![工具栏：域名规则](https://github.com/user-attachments/assets/cdd730e6-acb3-41dd-bbd8-60429599377d)

