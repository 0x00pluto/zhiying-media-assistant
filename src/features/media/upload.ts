const CHUNK_THRESHOLD = 20 * 1024 * 1024

async function parseFeishuResponse(response: Response) {
  const json = await response.json()
  const { code, msg, error, data } = json as {
    code: number
    msg?: string
    error?: string | { message?: string }
    data?: unknown
  }

  if (code !== 0) {
    let message = "文件上传失败"
    if (typeof error === "string") message = error
    else if (typeof error === "object" && error?.message) message = error.message
    else if (msg) message = msg
    throw new Error(message)
  }

  return data
}

async function withRetry<T>(fn: () => Promise<T>, retries = 5, baseDelay = 200) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt >= retries) throw error
      const delay = baseDelay * 2 ** attempt + Math.random() * 100
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error("重试次数超过最大重试次数")
}

async function uploadAll(options: {
  file: Blob
  file_name: string
  parent_type: string
  parent_node: string
  token: string
}) {
  const controller = new AbortController()
  const form = new FormData()
  form.append("file_name", options.file_name)
  form.append("parent_type", options.parent_type)
  form.append("parent_node", options.parent_node)
  form.append("size", options.file.size.toString())
  form.append("file", options.file, options.file_name)

  const timer = setTimeout(() => controller.abort(), 120000)
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
    {
      method: "POST",
      signal: controller.signal,
      body: form,
      headers: { Authorization: `Bearer ${options.token}` }
    }
  ).finally(() => clearTimeout(timer))

  return parseFeishuResponse(response)
}

async function uploadPrepare(options: {
  token: string
  file_name: string
  parent_type: string
  parent_node: string
  size: number
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_prepare",
    {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        file_name: options.file_name,
        parent_type: options.parent_type,
        parent_node: options.parent_node,
        size: options.size
      }),
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  ).finally(() => clearTimeout(timer))

  return parseFeishuResponse(response) as {
    upload_id: string
    block_size: number
    block_num: number
  }
}

async function uploadPart(options: {
  upload_id: string
  file_name: string
  seq: number
  file: Blob
  token: string
}) {
  const controller = new AbortController()
  const form = new FormData()
  form.append("upload_id", options.upload_id)
  form.append("seq", options.seq.toString())
  form.append("size", options.file.size.toString())
  form.append("file", options.file, options.file_name)

  const timer = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_part",
    {
      method: "POST",
      signal: controller.signal,
      body: form,
      headers: { Authorization: `Bearer ${options.token}` }
    }
  ).finally(() => clearTimeout(timer))

  return parseFeishuResponse(response)
}

async function uploadFinish(options: {
  upload_id: string
  block_num: number
  token: string
}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_finish",
    {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        upload_id: options.upload_id,
        block_num: options.block_num
      }),
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    }
  ).finally(() => clearTimeout(timer))

  return parseFeishuResponse(response)
}

export async function feishuUpload(options: {
  url: string
  file_name: string
  parent_type: string
  parent_node: string
  token: string
}) {
  const blob = await fetch(options.url).then((res) => res.blob())

  if (blob.size < CHUNK_THRESHOLD) {
    return withRetry(() =>
      uploadAll({
        file: blob,
        file_name: options.file_name,
        parent_type: options.parent_type,
        parent_node: options.parent_node,
        token: options.token
      })
    )
  }

  const prepared = await withRetry(() =>
    uploadPrepare({
      token: options.token,
      file_name: options.file_name,
      parent_type: options.parent_type,
      parent_node: options.parent_node,
      size: blob.size
    })
  )

  let offset = 0
  let seq = 0
  while (offset < blob.size) {
    const end = offset + prepared.block_size
    const chunk = blob.slice(offset, end)
    await withRetry(() =>
      uploadPart({
        upload_id: prepared.upload_id,
        file_name: options.file_name,
        seq: seq++,
        file: chunk,
        token: options.token
      })
    )
    offset = end
  }

  return withRetry(() =>
    uploadFinish({
      upload_id: prepared.upload_id,
      block_num: prepared.block_num,
      token: options.token
    })
  )
}
