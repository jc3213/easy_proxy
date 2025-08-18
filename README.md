# 简易代理

## 安装
| <a href="https://microsoftedge.microsoft.com/addons/detail/mdoojhdlkngkgcgkefkbmfaahpclojen"><img src="https://github.com/user-attachments/assets/755ede26-33d5-41eb-9000-9ba903886041" title="Microsoft Edge" width="64" height="64"></a> | <a href="https://addons.mozilla.org/firefox/addon/easy-proxy/"><img src="https://github.com/user-attachments/assets/e2bb973f-5106-4eae-8d1d-4a3dd25b01e5" title="Mozilla Firefox" width="64" height="64"></a> | TBA |
| - | - | - |

## 关于
- 一个简单易用的自动代理扩展
- 可以通过设置添加代理服务器跟对应规则
- 可以通过设置导出代理规则或PAC自动代理脚本
- 可以通过工具栏图标查询当前页面的可代理规则
- 可以通过工具栏图标添加代理规则或临时代理规则

## 用户手册
- 通过`设置`添加并管理代理档案
    - `Ctrl`+`S`：保存设置
    - `Ctrl`+`Q`：进阶设置
    - 点击`导出`可导出用户设置以方便部署到其他电脑
    - 点击`导入`以导入用户设置
        - 如果导入设置后无法立刻生效，请禁用扩展再启用即可修复
    - 点击`🧲`可重新排序当前代理档案下的规则池
    - 点击`💾`可以将代理档案导出为`PAC`文件
- 点击`工具栏`菜单会显示已获取的当前页面可用的匹配规则
    - 工具栏菜单支持快捷键
    - `Tab`： 切换域名规则
    - `ESC`：恢复规则默认
    - `空格` 或 `回车`：添加所选规则
    - `退格`: 清理临时规则
    - 代理规则的状态可以通过鼠标滚轮快速修改
- 火狐必须勾选隐私模式才能正常工作

## 界面截图
<img width="1280" height="800" alt="Options - Empty" src="https://github.com/user-attachments/assets/62a6c02f-f38b-41d1-934f-b6fe27de01dd" />
<img width="1280" height="800" alt="Options - Advanced" src="https://github.com/user-attachments/assets/68acc25b-1eff-4887-8587-7c8c538781aa" />
<img width="1280" height="800" alt="Toolbar" src="https://github.com/user-attachments/assets/644a7433-6bff-45aa-bf8e-6f9610812b59" />
<img width="1280" height="800" alt="Toolbar - Switch" src="https://github.com/user-attachments/assets/ebaefe27-9f97-4098-8ac0-b6d8e5cf2437" />
<img width="1280" height="800" alt="Toolbar - Proxy Rule" src="https://github.com/user-attachments/assets/ae48e74b-d673-4a41-a6f8-de54e316b7ec" />
