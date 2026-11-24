/** Shared companion safety helpers (server-side only). */

export const CRISIS_PATTERN =
  /自杀|自尽|不想活|结束生命|伤害自己|割腕|跳楼|轻生|活不下去|打死自己/

/** Soft-block contact / rendezvous leakage in private human chat. */
export const CONTACT_LEAK_PATTERN =
  /(?:\+?86[-\s]?)?1[3-9]\d{9}|微信|vx|v信|加我|QQ[:：\s]?\d{5,}|qq号|邮箱|@[\w.-]+\.[a-z]{2,}|https?:\/\/|www\./i

export const HUMAN_CRISIS_TIP =
  '系统提示：对话中出现了可能需要现实帮助的内容。请温和倾听，不要尝试专业危机干预；若情况紧急，请鼓励对方联系身边可信的人或当地紧急援助渠道。本产品不是心理咨询或紧急援助服务。'

export function containsCrisis(text: string): boolean {
  return CRISIS_PATTERN.test(text)
}

export function containsContactLeak(text: string): boolean {
  return CONTACT_LEAK_PATTERN.test(text)
}
