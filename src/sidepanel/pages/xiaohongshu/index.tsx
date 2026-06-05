import { Card } from "antd"

import { MenuItem } from "~sidepanel/components/menu-item"
import { PlatformSwitcher } from "~sidepanel/components/platform-switcher"

type Props = {
  onNavigate: (path: string) => void
}

export function XiaohongshuHome({ onNavigate }: Props) {
  return (
    <div>
      <Card className="sidepanel-card" title="批量采集" bordered={false}>
        <MenuItem
          icon={<span>U</span>}
          label="采集博主数据"
          onClick={() => onNavigate("/xiaohongshu/batch-collect/blogger")}
        />
        <MenuItem
          icon={<span>N</span>}
          label="采集笔记数据"
          onClick={() => onNavigate("/xiaohongshu/batch-collect/note")}
        />
        <MenuItem
          icon={<span>C</span>}
          label="采集评论数据"
          onClick={() => onNavigate("/xiaohongshu/batch-collect/comment")}
        />
      </Card>

      <Card className="sidepanel-card" title="其他功能" bordered={false}>
        <MenuItem
          icon={<span>L</span>}
          label="链接转换"
          onClick={() => onNavigate("/xiaohongshu/other/url-transform")}
        />
      </Card>

      <Card className="sidepanel-card" title="数据中心" bordered={false}>
        <MenuItem
          icon={<span>A</span>}
          label="账号管理"
          onClick={() => onNavigate("/general/data-center/account")}
        />
        <MenuItem
          icon={<span>H</span>}
          label="采集历史"
          onClick={() => onNavigate("/general/data-center/collect-history")}
        />
        <MenuItem
          icon={<span>T</span>}
          label="任务闹钟"
          onClick={() => onNavigate("/general/data-center/task-alarm")}
        />
      </Card>

      <Card className="sidepanel-card" title="其他平台" bordered={false}>
        <PlatformSwitcher />
      </Card>
    </div>
  )
}
