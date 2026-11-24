# 1.0.5

**中文**

更新英文版 README

**English**

- Updated the English README.

# 1.0.4

**中文**

适配立创EDA专业版 V3.2.166:
- 修复焊盘/过孔到线间距(第14项)对旋转IC焊盘的大面积误报:该版本 getState_Rotation() 返回单位由弧度改为度数,已按度/弧度归一化兼容
- 修复同网络走线被误判为间距不足:该版本网络API(getAllPrimitivesByNet/getConnectedPrimitives)退化返空、getState_Net 对自动网络名不一致,改以物理相接判同网络;并修正 netById 构建的拼写错误(pris 修正为 prims)

**English**

Compatibility with EasyEDA Pro V3.2.166:
- Fixed widespread false positives in pad/via-to-trace spacing (check #14) for rotated IC pads: in this version, `getState_Rotation()` returns degrees instead of radians; both units are now normalized and handled.
- Fixed same-net traces being incorrectly flagged as insufficient spacing: in this version, the net APIs (`getAllPrimitivesByNet` / `getConnectedPrimitives`) regress and return empty, and `getState_Net` is inconsistent for auto-generated net names. Same-net detection now uses physical connectivity. Also fixed a typo in the `netById` construction (`pris` → `prims`).

# 1.0.3

**中文**

结果窗「检测项目」列新增鼠标悬停说明
修复最小IC引脚间距对顶/底层重叠焊盘的误报(如内孔 SMA 偏脚)

**English**

- Added hover tooltips to the "Check Item" column in the results window.
- Fixed false positives in the minimum IC pin pitch check for overlapping pads on the top/bottom layers (e.g., offset pins of an in-hole SMA connector).

# 1.0.2

**中文**

修复同网络焊盘间距检查(长圆焊盘圆弧端、重叠漏检)与 BGA 球间距 0.5mm pitch 误报

**English**

- Fixed the same-net pad spacing check (arc ends of oblong pads, missed overlapping cases) and the false positive in the BGA ball pitch check at 0.5 mm pitch.

# 1.0.1

**中文**

更新README和extension.json信息

**English**

- Updated README and extension.json information.

# 1.0.0

**中文**

初始版本

**English**

- Initial release.
