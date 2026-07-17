# 1.0.4

适配立创EDA专业版 V3.2.166:
- 修复焊盘/过孔到线间距(第14项)对旋转IC焊盘的大面积误报:该版本 getState_Rotation() 返回单位由弧度改为度数,已按度/弧度归一化兼容
- 修复同网络走线被误判为间距不足:该版本网络API(getAllPrimitivesByNet/getConnectedPrimitives)退化返空、getState_Net 对自动网络名不一致,改以物理相接判同网络;并修正 netById 构建的拼写错误(pris 修正为 prims)

# 1.0.3

结果窗「检测项目」列新增鼠标悬停说明
修复最小IC引脚间距对顶/底层重叠焊盘的误报(如内孔 SMA 偏脚)

# 1.0.2

修复同网络焊盘间距检查(长圆焊盘圆弧端、重叠漏检)与 BGA 球间距 0.5mm pitch 误报

# 1.0.1

更新README和extension.json信息

# 1.0.0

初始版本
