import { fetchUserInfo, searchUsers } from "~features/xiaohongshu/api/client"
import { parseUserUrl, sleep } from "~features/xiaohongshu/api/parsers"
import { BLOGGER_COLUMNS } from "~features/xiaohongshu/columns/blogger"
import { TaskRunner } from "~shared/task-runner"

export type BloggerCollectCondition = {
  name?: string
  collectBy: "keyword" | "links"
  keyword?: string
  keywords?: string[]
  urls?: string[]
  limit?: number
}

export class BloggerCollector extends TaskRunner<BloggerCollectCondition> {
  readonly type = "blogger"
  readonly allColumns = BLOGGER_COLUMNS

  getTotal() {
    const c = this.condition
    if (c.collectBy === "keyword") {
      return (c.limit || 100) * (c.keywords?.length || 1)
    }
    return c.urls?.length || 0
  }

  async execute() {
    const c = this.condition
    if (c.collectBy === "keyword") {
      const keywords = c.keywords || (c.keyword ? [c.keyword] : [])
      for (const keyword of keywords) {
        await this.collectByKeyword(keyword, c.limit || 100)
      }
    } else {
      await this.collectByLinks(c.urls || [])
    }
  }

  private async addRecord(
    data: Record<string, unknown>,
    pageUrl: string,
    keyword?: string
  ) {
    const record: Record<string, unknown> = {}
    this.fillRecord(
      { data, api: "blogger", pageUrl, keyword },
      record
    )
    this.records.push(record)
    await sleep()
  }

  private async collectByKeyword(keyword: string, limit: number) {
    let page = 1
    let collected = 0

    while (collected < limit) {
      const result = await searchUsers({
        keyword,
        page,
        page_size: 20
      })

      const users = result.users || []
      if (!users.length) break

      for (const user of users.slice(0, limit - collected)) {
        const userUrl = `https://www.xiaohongshu.com/user/profile/${user.id}?xsec_token=${user.xsec_token}&xsec_source=pc_search`
        const info = await fetchUserInfo({ target_user_id: user.id as string })
        const basic = (info as { basic_info?: Record<string, unknown> }).basic_info || user
        await this.addRecord(basic, userUrl, keyword)
        collected++
      }

      page++
      if (!result.has_more) break
      await sleep()
    }
  }

  private async collectByLinks(urls: string[]) {
    for (const url of urls) {
      const user = parseUserUrl(url)
      const info = await fetchUserInfo({ target_user_id: user.id })
      const basic = (info as { basic_info?: Record<string, unknown> }).basic_info
      if (basic) {
        await this.addRecord(basic, url)
      }
    }
  }
}
