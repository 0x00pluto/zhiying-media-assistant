export const NOTE_DETAIL_AVATAR_SELECTOR =
  "#noteContainer div.interaction-container div.author-container .info img.avatar-item"

export const NOTE_DETAIL_CONTENT_SELECTOR =
  "#noteContainer div.interaction-container div.note-content"

export function findNoteDetailAvatarElement() {
  if (typeof document === "undefined") return null
  return document.querySelector(NOTE_DETAIL_AVATAR_SELECTOR)
}

export function findNoteDetailAnchorElement() {
  if (typeof document === "undefined") return null
  return document.querySelector(NOTE_DETAIL_CONTENT_SELECTOR)
}
