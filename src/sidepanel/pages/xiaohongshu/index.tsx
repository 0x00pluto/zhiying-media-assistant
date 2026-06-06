import { Card } from "antd"

import {
  NOTE_BATCH_COLLECT_DISABLED_HINT,
  useNoteBatchCollectEnabled
} from "~features/xiaohongshu/use-note-batch-enabled"
import { MenuItem } from "~sidepanel/components/menu-item"

type Props = {
  onNavigate: (path: string) => void
}

export function XiaohongshuHome({ onNavigate }: Props) {
  const { enabled: noteBatchEnabled } = useNoteBatchCollectEnabled()

  return (
    <div>
      <Card className="sidepanel-card" title="批量采集" variant="borderless">
        <MenuItem
          icon={<span>U</span>}
          label="采集博主数据"
          onClick={() => onNavigate("/xiaohongshu/batch-collect/blogger")}
        />
        {noteBatchEnabled ? (
          <MenuItem
            icon={<span>N</span>}
            label="采集笔记数据"
            onClick={() => onNavigate("/xiaohongshu/batch-collect/note")}
          />
        ) : (
          <p
            style={{
              margin: "8px 0 0",
              padding: "10px 12px",
              borderRadius: 8,
              background: "#f9fafb",
              color: "#6b7280",
              fontSize: 12,
              lineHeight: 1.5
            }}>
            采集笔记数据（暂不可用）：{NOTE_BATCH_COLLECT_DISABLED_HINT}
          </p>
        )}
        <MenuItem
          icon={<span>C</span>}
          label="采集评论数据"
          onClick={() => onNavigate("/xiaohongshu/batch-collect/comment")}
        />
      </Card>

      <Card className="sidepanel-card" title="其他功能" variant="borderless">
        <MenuItem
          icon={<span>L</span>}
          label="链接转换"
          onClick={() => onNavigate("/xiaohongshu/other/url-transform")}
        />
      </Card>

      <Card className="sidepanel-card" title="数据中心" variant="borderless">
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
    </div>
  )
}
